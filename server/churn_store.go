package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"
	"time"
)

const (
	winbackLease       = 30 * time.Minute
	winbackLockKey     = 7305110421
	cancelReconcileAge = 45 * 24 * time.Hour
)

var errNoUnsubscribeSecret = errors.New("UNSUBSCRIBE_SECRET not set")

func unsubscribeSecret() []byte {
	return []byte(strings.TrimSpace(os.Getenv("UNSUBSCRIBE_SECRET")))
}

func unsubscribeMAC(secret []byte, email string) string {
	m := hmac.New(sha256.New, secret)
	m.Write([]byte("unsub:" + email))
	return hex.EncodeToString(m.Sum(nil))
}

func signedUnsubscribeURL(email string) (string, error) {
	secret := unsubscribeSecret()
	if len(secret) == 0 {
		return "", errNoUnsubscribeSecret
	}
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return "", errors.New("empty email")
	}
	q := url.Values{"e": {base64.RawURLEncoding.EncodeToString([]byte(email))}, "t": {unsubscribeMAC(secret, email)}}
	return "https://manifoldgen.com/unsubscribe?" + q.Encode(), nil
}

func verifyUnsubscribeToken(encEmail, tok string) (string, bool) {
	secret := unsubscribeSecret()
	if len(secret) == 0 || encEmail == "" || tok == "" {
		return "", false
	}
	raw, err := base64.RawURLEncoding.DecodeString(encEmail)
	if err != nil {
		return "", false
	}
	email := string(raw)
	if !hmac.Equal([]byte(unsubscribeMAC(secret, email)), []byte(tok)) {
		return "", false
	}
	return email, true
}

type cancelRecord struct {
	SubscriptionID string
	CustomerID     string
	Plan           string
	Source         string
	Reason         string
	Detail         string
	EndsAt         time.Time
}

func cancelSourceFor(sub stripeSubscription) string {
	reason := ""
	if sub.CancellationDetails != nil {
		reason = sub.CancellationDetails.Reason
	}
	switch reason {
	case "payment_failed", "payment_disputed":
		return "dunning"
	}
	if sub.Metadata["cancel_source"] == "app" {
		return "app"
	}
	if reason == "cancellation_requested" {
		return "portal"
	}
	return "app"
}

func subscriptionPeriodEndUnix(sub stripeSubscription) int64 {
	if sub.CurrentPeriodEnd > 0 {
		return sub.CurrentPeriodEnd
	}
	if len(sub.Items.Data) > 0 {
		return sub.Items.Data[0].CurrentPeriodEnd
	}
	return 0
}

func cancellationFromSubscription(eventType string, sub stripeSubscription, now time.Time) (cancelRecord, string) {
	rec := cancelRecord{SubscriptionID: sub.ID, CustomerID: sub.Customer, Source: cancelSourceFor(sub)}
	if sub.CancellationDetails != nil {
		rec.Reason = strings.ToLower(strings.TrimSpace(sub.CancellationDetails.Feedback))
		rec.Detail = strings.TrimSpace(sub.CancellationDetails.Comment)
	}
	if len(sub.Items.Data) > 0 {
		rec.Plan = stripePlanFromPriceID(sub.Items.Data[0].Price.ID)
	}
	if rec.Plan == "" && sub.Metadata != nil {
		rec.Plan = sub.Metadata["plan"]
	}
	ended := eventType == "customer.subscription.deleted" || sub.Status == "canceled" || sub.Status == "incomplete_expired"
	if ended {
		switch {
		case sub.EndedAt > 0:
			rec.EndsAt = time.Unix(sub.EndedAt, 0).UTC()
		case sub.CanceledAt > 0:
			rec.EndsAt = time.Unix(sub.CanceledAt, 0).UTC()
		default:
			rec.EndsAt = now.UTC()
		}
		return rec, "cancel"
	}
	pending := sub.CancelAtPeriodEnd || sub.CancelAt > 0 ||
		(sub.CancellationDetails != nil && sub.CancellationDetails.Reason != "")
	if !pending {
		return rec, "rescind"
	}
	switch {
	case sub.CancelAt > 0:
		rec.EndsAt = time.Unix(sub.CancelAt, 0).UTC()
	case subscriptionPeriodEndUnix(sub) > 0:
		rec.EndsAt = time.Unix(subscriptionPeriodEndUnix(sub), 0).UTC()
	default:
		return rec, "ignore"
	}
	return rec, "cancel"
}

func handleStripeSubscriptionCancellation(eventType string, raw json.RawMessage) {
	if dbConn == nil {
		return
	}
	var sub stripeSubscription
	if err := json.Unmarshal(raw, &sub); err != nil || sub.ID == "" {
		return
	}
	applyCancellation(dbConn, eventType, sub, time.Now())
}

type cancellationStore interface {
	RecordCancellation(rec cancelRecord) (bool, error)
	RescindCancellation(subscriptionID string) error
}

func applyCancellation(store cancellationStore, eventType string, sub stripeSubscription, now time.Time) {
	rec, kind := cancellationFromSubscription(eventType, sub, now)
	switch kind {
	case "cancel":
		ok, err := store.RecordCancellation(rec)
		if err != nil {
			log.Printf("cancellation record error subscription=%s: %v", sub.ID, err)
		} else if !ok {
			log.Printf("cancellation not recorded subscription=%s: no matching user", sub.ID)
		}
	case "rescind":
		if err := store.RescindCancellation(sub.ID); err != nil {
			log.Printf("cancellation rescind error subscription=%s: %v", sub.ID, err)
		}
	}
}

func (db *DB) RecordCancellation(rec cancelRecord) (bool, error) {
	db.mu.Lock()
	defer db.mu.Unlock()
	res, err := db.conn.Exec(
		`INSERT INTO subscription_cancellations (stripe_subscription_id, user_id, stripe_customer_id, plan, source, reason, detail, ends_at)
		 SELECT $1, u.id, COALESCE(NULLIF($2, ''), u.stripe_customer_id, ''), COALESCE(NULLIF($3, ''), u.subscription_plan, ''), $4,
		        COALESCE(NULLIF($5, ''), (SELECT reason FROM cancel_surveys s WHERE s.user_id = u.id ORDER BY created_at DESC LIMIT 1), ''), $6, $7
		 FROM users u
		 WHERE u.stripe_subscription_id = $1 OR (u.stripe_customer_id = $2 AND $2 <> '')
		 ORDER BY (u.stripe_subscription_id = $1) DESC
		 LIMIT 1
		 ON CONFLICT (stripe_subscription_id) DO UPDATE SET
		   ends_at = EXCLUDED.ends_at,
		   rescinded = FALSE,
		   source = COALESCE(NULLIF(EXCLUDED.source, ''), subscription_cancellations.source),
		   reason = COALESCE(NULLIF(EXCLUDED.reason, ''), subscription_cancellations.reason),
		   detail = COALESCE(NULLIF(EXCLUDED.detail, ''), subscription_cancellations.detail),
		   plan = COALESCE(NULLIF(EXCLUDED.plan, ''), subscription_cancellations.plan),
		   updated_at = NOW()`,
		rec.SubscriptionID, rec.CustomerID, rec.Plan, rec.Source, rec.Reason, rec.Detail, rec.EndsAt,
	)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n > 0, nil
}

func (db *DB) RescindCancellation(subscriptionID string) error {
	db.mu.Lock()
	defer db.mu.Unlock()
	_, err := db.conn.Exec(
		`UPDATE subscription_cancellations SET rescinded = TRUE, updated_at = NOW()
		 WHERE stripe_subscription_id = $1 AND NOT rescinded AND ends_at > NOW()`,
		subscriptionID,
	)
	return err
}

func (db *DB) IsEmailOptedOut(email string) (bool, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	email = strings.ToLower(strings.TrimSpace(email))
	var n int
	err := db.conn.QueryRow(
		`SELECT (SELECT COUNT(*) FROM email_optouts WHERE email = $1) + (SELECT COUNT(*) FROM users WHERE LOWER(email) = $1 AND unsubscribed)`,
		email,
	).Scan(&n)
	return n > 0, err
}

func (db *DB) ListWinbackCandidates() ([]winbackCandidate, error) {
	db.mu.RLock()
	defer db.mu.RUnlock()
	rows, err := db.conn.Query(
		`WITH c AS (
		   SELECT DISTINCT ON (user_id) user_id, stripe_subscription_id AS sub_id, ends_at
		   FROM subscription_cancellations
		   WHERE NOT rescinded AND ends_at < NOW() AND ends_at > NOW() - INTERVAL '45 days'
		   ORDER BY user_id, ends_at DESC
		 )
		 SELECT ` + userSelectColumns + `, c.ends_at,
		        COALESCE((SELECT MAX(step) FROM winback_claims w WHERE w.recipient = LOWER(users.email) AND w.status = 'sent'), 0)
		 FROM users JOIN c ON c.user_id = users.id
		 WHERE users.email != '' AND NOT users.unsubscribed
		   AND NOT EXISTS (SELECT 1 FROM email_optouts o WHERE o.email = LOWER(users.email))
		   AND (COALESCE(users.subscription_status, '') NOT IN ('active', 'trialing', 'past_due') OR users.stripe_subscription_id = c.sub_id)`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []winbackCandidate
	for rows.Next() {
		var c winbackCandidate
		if err := scanUser(rows, &c.User, &c.CycleEnd, &c.LastStep); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (db *DB) ClaimWinbackSend(recipient string, step int, lease time.Duration) (bool, error) {
	recipient = strings.ToLower(strings.TrimSpace(recipient))
	res, err := db.conn.Exec(
		`INSERT INTO winback_claims (recipient, step, status, claimed_at) VALUES ($1, $2, 'sending', NOW())
		 ON CONFLICT (recipient, step) DO UPDATE SET claimed_at = NOW(), attempts = winback_claims.attempts + 1
		 WHERE winback_claims.status = 'sending' AND winback_claims.claimed_at < NOW() - make_interval(secs => $3)`,
		recipient, step, lease.Seconds(),
	)
	if err != nil {
		return false, err
	}
	n, _ := res.RowsAffected()
	return n == 1, nil
}

func (db *DB) MarkWinbackSent(recipient string, step int) error {
	recipient = strings.ToLower(strings.TrimSpace(recipient))
	_, err := db.conn.Exec(
		`UPDATE winback_claims SET status = 'sent', sent_at = NOW() WHERE recipient = $1 AND step = $2`,
		recipient, step,
	)
	return err
}

func (db *DB) TryRunnerLock(key int64) (func(), bool, error) {
	conn, err := db.conn.Conn(context.Background())
	if err != nil {
		return nil, false, err
	}
	var got bool
	if err := conn.QueryRowContext(context.Background(), `SELECT pg_try_advisory_lock($1)`, key).Scan(&got); err != nil || !got {
		conn.Close()
		return nil, false, err
	}
	return func() {
		_, _ = conn.ExecContext(context.Background(), `SELECT pg_advisory_unlock($1)`, key)
		conn.Close()
	}, true, nil
}

type subscriptionLister interface {
	listCanceledSubscriptions(sinceUnix int64, startingAfter string) ([]stripeSubscription, bool, error)
}

func (s *stripeService) listCanceledSubscriptions(sinceUnix int64, startingAfter string) ([]stripeSubscription, bool, error) {
	q := url.Values{"status": {"canceled"}, "limit": {"100"}, "current_period_end[gte]": {fmt.Sprint(sinceUnix)}}
	if startingAfter != "" {
		q.Set("starting_after", startingAfter)
	}
	var out struct {
		Data    []stripeSubscription `json:"data"`
		HasMore bool                 `json:"has_more"`
	}
	if err := s.get("/v1/subscriptions?"+q.Encode(), &out); err != nil {
		return nil, false, err
	}
	return out.Data, out.HasMore, nil
}

func reconcileRecentCancellations(store cancellationStore, lister subscriptionLister, now time.Time) (int, error) {
	since := now.Add(-cancelReconcileAge)
	seen, after := 0, ""
	for page := 0; page < 20; page++ {
		subs, more, err := lister.listCanceledSubscriptions(since.Unix(), after)
		if err != nil {
			return seen, err
		}
		for _, sub := range subs {
			after = sub.ID
			rec, kind := cancellationFromSubscription("customer.subscription.deleted", sub, now)
			if kind != "cancel" || rec.EndsAt.Before(since) {
				continue
			}
			ok, err := store.RecordCancellation(rec)
			if err != nil {
				return seen, err
			}
			if ok {
				seen++
			}
		}
		if !more || len(subs) == 0 {
			break
		}
	}
	return seen, nil
}

func runWinbackPass(now time.Time, send func(*User, DripEmail) error) {
	if dbConn == nil {
		return
	}
	release, ok, err := dbConn.TryRunnerLock(winbackLockKey)
	if err != nil {
		log.Printf("Winback scheduler: lock error: %v", err)
		return
	}
	if !ok {
		return
	}
	defer release()
	if stripeSvc != nil {
		if n, err := reconcileRecentCancellations(dbConn, stripeSvc, now); err != nil {
			log.Printf("Winback scheduler: reconcile error: %v", err)
		} else if n > 0 {
			log.Printf("Winback scheduler: reconciled %d cancellations", n)
		}
	}
	processWinbackEmails(now, send)
}
