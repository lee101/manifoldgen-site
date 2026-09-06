package main

import (
	"database/sql"
	"fmt"
	"log"
	"regexp"
	"strings"

	"github.com/valyala/fasthttp"
)

const referralRewardUSD = 5.0

var referralCodePattern = regexp.MustCompile(`^[a-z0-9]{8,20}$`)

type ReferralDashboard struct {
	Code      string  `json:"code"`
	InviteURL string  `json:"invite_url"`
	Joined    int     `json:"joined"`
	Rewarded  int     `json:"rewarded"`
	EarnedUSD float64 `json:"earned_usd"`
	RewardUSD float64 `json:"reward_usd"`
}

func referralCodeFromRequest(ctx *fasthttp.RequestCtx) string {
	code := strings.ToLower(strings.TrimSpace(string(ctx.Request.Header.Cookie("mg_ref"))))
	if !referralCodePattern.MatchString(code) {
		return ""
	}
	return code
}

func newReferralCode() string {
	code := strings.ToLower(strings.ReplaceAll(newUUID(), "-", ""))
	if len(code) > 10 {
		code = code[:10]
	}
	return code
}

func (db *DB) EnsureReferralCode(userID string) (string, error) {
	db.mu.Lock()
	defer db.mu.Unlock()

	var code string
	err := db.conn.QueryRow("SELECT code FROM referral_codes WHERE user_id = $1", userID).Scan(&code)
	if err == nil {
		return code, nil
	}
	if err != sql.ErrNoRows {
		return "", err
	}
	for attempt := 0; attempt < 5; attempt++ {
		code = newReferralCode()
		if _, err = db.conn.Exec(`INSERT INTO referral_codes (user_id, code, created_at) VALUES ($1, $2, NOW())`, userID, code); err == nil {
			return code, nil
		}
		// A concurrent request may have created this user's code first.
		if lookupErr := db.conn.QueryRow("SELECT code FROM referral_codes WHERE user_id = $1", userID).Scan(&code); lookupErr == nil {
			return code, nil
		}
	}
	return "", fmt.Errorf("create referral code: %w", err)
}

func (db *DB) AttachReferralByCode(refereeUserID, code string) (bool, error) {
	code = strings.ToLower(strings.TrimSpace(code))
	if !referralCodePattern.MatchString(code) {
		return false, nil
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	result, err := db.conn.Exec(`
		INSERT INTO referrals (id, referrer_user_id, referee_user_id, status, created_at)
		SELECT $1, rc.user_id, $2, 'pending', NOW()
		FROM referral_codes rc
		WHERE rc.code = $3 AND rc.user_id <> $2
		ON CONFLICT (referee_user_id) DO NOTHING`, newUUID(), refereeUserID, code)
	if err != nil {
		return false, err
	}
	rows, err := result.RowsAffected()
	return rows == 1, err
}

func (db *DB) ReferralStats(userID string) (ReferralDashboard, error) {
	code, err := db.EnsureReferralCode(userID)
	if err != nil {
		return ReferralDashboard{}, err
	}
	db.mu.RLock()
	defer db.mu.RUnlock()
	stats := ReferralDashboard{Code: code, RewardUSD: referralRewardUSD}
	err = db.conn.QueryRow(`
		SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'rewarded'),
		       COALESCE(SUM(reward_usd) FILTER (WHERE status = 'rewarded'), 0)
		FROM referrals WHERE referrer_user_id = $1`, userID).Scan(&stats.Joined, &stats.Rewarded, &stats.EarnedUSD)
	return stats, err
}

// RewardReferral converts a pending referral exactly once. It deliberately
// leaves total_deposited unchanged because these credits are promotional, not cash.
func (db *DB) RewardReferral(refereeUserID string, cutePrice float64) (bool, error) {
	if cutePrice <= 0 {
		return false, fmt.Errorf("invalid credit price")
	}
	db.mu.Lock()
	defer db.mu.Unlock()
	tx, err := db.conn.Begin()
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	var referralID, referrerUserID string
	err = tx.QueryRow(`SELECT id, referrer_user_id FROM referrals WHERE referee_user_id = $1 AND status = 'pending' FOR UPDATE`, refereeUserID).Scan(&referralID, &referrerUserID)
	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	cuteAmount := referralRewardUSD / cutePrice
	balances := map[string]float64{}
	for _, userID := range []string{referrerUserID, refereeUserID} {
		var balance float64
		if err := tx.QueryRow("UPDATE users SET credits = credits + $1, updated_at = NOW() WHERE id = $2 RETURNING credits", cuteAmount, userID).Scan(&balance); err != nil {
			return false, err
		}
		balances[userID] = balance
	}
	for _, row := range []struct{ userID, description string }{
		{referrerUserID, "Referral reward: invited creator made their first purchase"},
		{refereeUserID, "Referral welcome reward: first purchase completed"},
	} {
		if _, err := tx.Exec(`INSERT INTO billing_events
			(id, user_id, event_type, amount, cute_amount, usd_amount, description, credits_after, created_at)
			VALUES ($1, $2, 'referral_bonus', $3, $3, $4, $5, $6, NOW())`,
			newUUID(), row.userID, cuteAmount, referralRewardUSD, row.description, balances[row.userID]); err != nil {
			return false, err
		}
	}
	if _, err := tx.Exec("UPDATE referrals SET status = 'rewarded', reward_usd = $1, rewarded_at = NOW() WHERE id = $2", referralRewardUSD, referralID); err != nil {
		return false, err
	}
	if err := tx.Commit(); err != nil {
		return false, err
	}
	return true, nil
}

func captureReferralForNewUser(ctx *fasthttp.RequestCtx, user *User, created bool) {
	if !created || user == nil {
		return
	}
	code := referralCodeFromRequest(ctx)
	if code == "" {
		return
	}
	if attached, err := dbConn.AttachReferralByCode(user.ID, code); err != nil {
		log.Printf("referral attach failed user=%s: %v", user.ID, err)
	} else if attached {
		log.Printf("referral attached referee=%s", user.ID)
	}
}

func awardReferralAfterPurchase(userID string) {
	awarded, err := dbConn.RewardReferral(userID, getCUTEPriceUSD())
	if err != nil {
		log.Printf("referral reward failed referee=%s: %v", userID, err)
	} else if awarded {
		log.Printf("referral reward granted referee=%s usd_each=%.2f", userID, referralRewardUSD)
	}
}

func handleReferrals(ctx *fasthttp.RequestCtx) {
	apiKey := strings.TrimSpace(strings.TrimPrefix(string(ctx.Request.Header.Peek("Authorization")), "Bearer "))
	if apiKey == "" {
		jsonError(ctx, 401, "api key required")
		return
	}
	user, err := dbConn.GetUserByAPIKey(apiKey)
	if err != nil {
		jsonError(ctx, 401, "invalid API key")
		return
	}
	stats, err := dbConn.ReferralStats(user.ID)
	if err != nil {
		log.Printf("referral dashboard failed user=%s: %v", user.ID, err)
		jsonError(ctx, 500, "failed to load referrals")
		return
	}
	stats.InviteURL = strings.TrimRight(defaultPublicURL(ctx), "/") + "/?ref=" + stats.Code
	jsonResponse(ctx, 200, stats)
}
