package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/valyala/fasthttp"
)

type creditPlanSpec struct {
	Plan         string
	LookupKey    string
	DefaultPrice string
	EnvPrice     string
	Credits      float64
	Rank         int
}

var creditPlans = []creditPlanSpec{
	{"credits_maker", "mg_credits_maker_monthly", "price_1UMlGhHS07k89Tt2q60lGAzE", "STRIPE_CREDITS_MAKER_PRICE_ID", 3000, 1},
	{"credits_studio", "mg_credits_studio_monthly", "price_1UMlGiHS07k89Tt2LNhjr1WF", "STRIPE_CREDITS_STUDIO_PRICE_ID", 10500, 2},
	{"credits_scale", "mg_credits_scale_monthly", "price_1UMlGiHS07k89Tt2GSELuCxB", "STRIPE_CREDITS_SCALE_PRICE_ID", 33000, 3},
}

func creditPlanByName(plan string) (creditPlanSpec, bool) {
	plan = strings.ToLower(strings.TrimSpace(plan))
	plan = strings.ReplaceAll(plan, "-", "_")
	if !strings.HasPrefix(plan, "credits_") && plan != "" {
		plan = "credits_" + plan
	}
	plan = strings.TrimSuffix(plan, "_monthly")
	for _, p := range creditPlans {
		if p.Plan == plan {
			return p, true
		}
	}
	return creditPlanSpec{}, false
}

func (p creditPlanSpec) priceID() string {
	return strings.TrimPrefix(strings.TrimSpace(getEnv(p.EnvPrice, p.DefaultPrice)), "/")
}

func creditPlanByPriceID(priceID string) (creditPlanSpec, bool) {
	priceID = strings.TrimPrefix(strings.TrimSpace(priceID), "/")
	if priceID == "" {
		return creditPlanSpec{}, false
	}
	for _, p := range creditPlans {
		if p.priceID() == priceID {
			return p, true
		}
	}
	return creditPlanSpec{}, false
}

func isCreditPlan(plan string) bool {
	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(plan)), "credits_") {
		return false
	}
	_, ok := creditPlanByName(plan)
	return ok
}

type invoiceLedger interface {
	GetUserByStripeSubscription(subscriptionID, customerID string) (*User, error)
	CreditStripeCheckout(userID, stripeCustomerID, sessionID, paymentIntentID string, usdAmount, cuteAmount float64) (bool, float64, error)
}

func creditBalanceVia(ledger invoiceLedger, userID, customerID, grantID string, cuteAmount float64) bool {
	usd := cuteAmount * getCUTEPriceUSD()
	credited, balance, err := ledger.CreditStripeCheckout(userID, customerID, grantID, "", usd, cuteAmount)
	if err != nil {
		log.Printf("stripe credit plan grant %s error: %v", grantID, err)
		return false
	}
	if credited {
		log.Printf("stripe credit plan grant user=%s grant=%s credits=%.0f balance=%.2f", userID, grantID, cuteAmount, balance)
	}
	return credited
}

func (inv stripeInvoice) subscriptionID() string {
	if inv.Subscription != "" {
		return inv.Subscription
	}
	if inv.Parent != nil && inv.Parent.SubscriptionDetails != nil {
		return inv.Parent.SubscriptionDetails.Subscription
	}
	return ""
}

func (inv stripeInvoice) priceIDs() []string {
	var ids []string
	for _, l := range inv.Lines.Data {
		if l.Price.ID != "" {
			ids = append(ids, l.Price.ID)
		}
		if l.Pricing != nil && l.Pricing.PriceDetails != nil && l.Pricing.PriceDetails.Price != "" {
			ids = append(ids, l.Pricing.PriceDetails.Price)
		}
	}
	return ids
}

func processStripeInvoicePaid(ledger invoiceLedger, invoice stripeInvoice) {
	subID := invoice.subscriptionID()
	if subID == "" {
		return
	}
	for _, pid := range invoice.priceIDs() {
		spec, ok := creditPlanByPriceID(pid)
		if !ok {
			continue
		}
		if invoice.BillingReason != "subscription_create" && invoice.BillingReason != "subscription_cycle" {
			return
		}
		user, err := ledger.GetUserByStripeSubscription(subID, invoice.Customer)
		if err != nil {
			log.Printf("stripe invoice %s credit plan user lookup failed: %v", invoice.ID, err)
			return
		}
		creditBalanceVia(ledger, user.ID, invoice.Customer, "subscription-invoice:"+invoice.ID, spec.Credits)
		return
	}
	if invoice.BillingReason == "subscription_create" {
		return
	}
	user, err := ledger.GetUserByStripeSubscription(subID, invoice.Customer)
	if err != nil {
		log.Printf("stripe invoice %s subscription user lookup failed: %v", invoice.ID, err)
		return
	}
	if isCreditPlan(user.SubscriptionPlan) {
		return
	}
	cute := subscriptionCreditGrantUSD(user.SubscriptionPlan) / getCUTEPriceUSD()
	creditBalanceVia(ledger, user.ID, invoice.Customer, "subscription-invoice:"+invoice.ID, cute)
}

var (
	errCouponAlreadyUsed = errors.New("retention discount already used")
	errCouponNotForPlan  = errors.New("retention discount is not available for credit plans")
)

type retentionStore interface {
	ClaimRetentionCoupon(customerID, userID string) (bool, error)
	ReleaseRetentionCoupon(customerID string) error
}

type couponApplier interface {
	applyRetentionCoupon(customerID string) error
}

func offerRetentionCoupon(store retentionStore, applier couponApplier, user *User) error {
	if isCreditPlan(user.SubscriptionPlan) {
		return errCouponNotForPlan
	}
	claimed, err := store.ClaimRetentionCoupon(user.StripeCustomerID, user.ID)
	if err != nil {
		return err
	}
	if !claimed {
		return errCouponAlreadyUsed
	}
	if err := applier.applyRetentionCoupon(user.StripeCustomerID); err != nil {
		if rerr := store.ReleaseRetentionCoupon(user.StripeCustomerID); rerr != nil {
			log.Printf("retention claim release failed customer=%s: %v", user.StripeCustomerID, rerr)
		}
		return err
	}
	return nil
}

func (s *stripeService) activeSubscription(customerID string) (*stripeSubscription, error) {
	var subscriptions struct {
		Data []stripeSubscription `json:"data"`
	}
	path := "/v1/subscriptions?" + url.Values{"customer": {customerID}, "status": {"all"}}.Encode()
	if err := s.get(path, &subscriptions); err != nil {
		return nil, fmt.Errorf("list subscriptions: %w", err)
	}
	for i := range subscriptions.Data {
		sub := subscriptions.Data[i]
		if sub.Status == "active" || sub.Status == "trialing" || sub.Status == "past_due" {
			return &sub, nil
		}
	}
	return nil, errNoEligibleSubscription
}

func (sub *stripeSubscription) priceID() string {
	if len(sub.Items.Data) > 0 {
		return sub.Items.Data[0].Price.ID
	}
	return ""
}

func (s *stripeService) pauseSubscription(customerID string, fallbackPeriodEnd time.Time) (time.Time, error) {
	sub, err := s.activeSubscription(customerID)
	if err != nil {
		return time.Time{}, err
	}
	if sub.PauseCollection != nil {
		return time.Time{}, errors.New("subscription already paused")
	}
	periodEnd := stripePeriodEnd(sub.CurrentPeriodEnd)
	if sub.CurrentPeriodEnd <= 0 {
		periodEnd = fallbackPeriodEnd
	}
	if periodEnd.Before(time.Now()) {
		periodEnd = time.Now()
	}
	resumes := periodEnd.Add(15 * 24 * time.Hour)
	vals := url.Values{
		"pause_collection[behavior]":   {"void"},
		"pause_collection[resumes_at]": {fmt.Sprint(resumes.Unix())},
	}
	if err := s.post("/v1/subscriptions/"+url.PathEscape(sub.ID), vals, nil, &struct{}{}); err != nil {
		return time.Time{}, fmt.Errorf("pause subscription: %w", err)
	}
	return resumes, nil
}

func (s *stripeService) downgradeToMaker(customerID string) error {
	sub, err := s.activeSubscription(customerID)
	if err != nil {
		return err
	}
	cur, ok := creditPlanByPriceID(sub.priceID())
	if !ok {
		return errCouponNotForPlan
	}
	maker, _ := creditPlanByName("credits_maker")
	if cur.Rank <= maker.Rank {
		return errors.New("already on the lowest plan")
	}
	if len(sub.Items.Data) == 0 || sub.Items.Data[0].ID == "" {
		return errors.New("subscription item missing")
	}
	vals := url.Values{
		"items[0][id]":         {sub.Items.Data[0].ID},
		"items[0][price]":      {maker.priceID()},
		"proration_behavior":   {"none"},
		"metadata[plan]":       {maker.Plan},
		"metadata[price_id]":   {maker.priceID()},
		"cancel_at_period_end": {"false"},
	}
	if err := s.post("/v1/subscriptions/"+url.PathEscape(sub.ID), vals, nil, &struct{}{}); err != nil {
		return fmt.Errorf("downgrade subscription: %w", err)
	}
	return nil
}

var cancelReasons = map[string]bool{
	"too_expensive":     true,
	"not_using":         true,
	"missing_features":  true,
	"quality":           true,
	"technical_issues":  true,
	"found_alternative": true,
	"temporary":         true,
	"other":             true,
}

func normalizeCancelSurvey(reason, detail string) (string, string, error) {
	reason = strings.ToLower(strings.TrimSpace(reason))
	if !cancelReasons[reason] {
		return "", "", errors.New("valid cancellation reason required")
	}
	detail = strings.TrimSpace(detail)
	if r := []rune(detail); len(r) > 1000 {
		detail = string(r[:1000])
	}
	return reason, detail, nil
}

func cancelOptionsFor(user *User, couponClaimed bool) map[string]interface{} {
	plan := user.SubscriptionPlan
	if spec, ok := creditPlanByName(plan); ok && isCreditPlan(plan) {
		return map[string]interface{}{
			"kind":             "credit_plan",
			"plan":             spec.Plan,
			"coupon_available": false,
			"can_pause":        true,
			"can_downgrade":    spec.Rank > 1,
		}
	}
	return map[string]interface{}{
		"kind":             "standard",
		"plan":             plan,
		"coupon_available": !couponClaimed,
		"can_pause":        false,
		"can_downgrade":    false,
	}
}

func churnAuthUser(ctx *fasthttp.RequestCtx) (*User, bool) {
	user, _, err := stripeAuthenticatedCustomer(ctx)
	if err != nil {
		status := 401
		switch err.Error() {
		case "no subscription found":
			status = 400
		case "stripe payments not configured":
			status = 503
		}
		jsonError(ctx, status, err.Error())
		return nil, false
	}
	return user, true
}

func recordSurvey(user *User, reason, detail, outcome string) {
	if err := dbConn.RecordCancelSurvey(user.ID, user.StripeCustomerID, user.SubscriptionPlan, reason, detail, outcome); err != nil {
		log.Printf("cancel survey save error user=%s: %v", user.ID, err)
	}
}

type cancelRequest struct {
	Reason string `json:"reason"`
	Detail string `json:"detail"`
}

func parseCancelRequest(ctx *fasthttp.RequestCtx) (string, string, bool) {
	var req cancelRequest
	if len(ctx.PostBody()) > 0 {
		_ = json.Unmarshal(ctx.PostBody(), &req)
	}
	reason, detail, err := normalizeCancelSurvey(req.Reason, req.Detail)
	if err != nil {
		jsonError(ctx, 400, err.Error())
		return "", "", false
	}
	return reason, detail, true
}

func handleStripeCancelOptions(ctx *fasthttp.RequestCtx) {
	user, ok := churnAuthUser(ctx)
	if !ok {
		return
	}
	claimed, err := dbConn.RetentionCouponClaimed(user.StripeCustomerID, user.ID)
	if err != nil {
		jsonError(ctx, 500, "failed to load options")
		return
	}
	jsonResponse(ctx, 200, cancelOptionsFor(user, claimed))
}

func handleStripePause(ctx *fasthttp.RequestCtx) {
	if !ctx.IsPost() {
		jsonError(ctx, 405, "method not allowed")
		return
	}
	user, ok := churnAuthUser(ctx)
	if !ok {
		return
	}
	if !isCreditPlan(user.SubscriptionPlan) {
		jsonError(ctx, 403, "pause is only available on credit plans")
		return
	}
	reason, detail, ok := parseCancelRequest(ctx)
	if !ok {
		return
	}
	resumes, err := stripeSvc.pauseSubscription(user.StripeCustomerID, user.SubscriptionPeriodEnd)
	if err != nil {
		if errors.Is(err, errNoEligibleSubscription) {
			jsonError(ctx, 400, "no active subscription found")
			return
		}
		log.Printf("stripe pause error: %v", err)
		jsonError(ctx, 502, "failed to pause subscription")
		return
	}
	recordSurvey(user, reason, detail, "paused")
	jsonResponse(ctx, 200, map[string]interface{}{"success": true, "resumes_at": resumes.UTC().Format(time.RFC3339), "message": "Billing paused for one cycle. Your credits never expire."})
}

func handleStripeDowngrade(ctx *fasthttp.RequestCtx) {
	if !ctx.IsPost() {
		jsonError(ctx, 405, "method not allowed")
		return
	}
	user, ok := churnAuthUser(ctx)
	if !ok {
		return
	}
	if !isCreditPlan(user.SubscriptionPlan) {
		jsonError(ctx, 403, "downgrade is only available on credit plans")
		return
	}
	reason, detail, ok := parseCancelRequest(ctx)
	if !ok {
		return
	}
	if err := stripeSvc.downgradeToMaker(user.StripeCustomerID); err != nil {
		if errors.Is(err, errNoEligibleSubscription) {
			jsonError(ctx, 400, "no active subscription found")
			return
		}
		log.Printf("stripe downgrade error: %v", err)
		jsonError(ctx, 502, "failed to downgrade subscription")
		return
	}
	recordSurvey(user, reason, detail, "downgraded")
	jsonResponse(ctx, 200, map[string]interface{}{"success": true, "message": "Switched to Maker from your next billing date."})
}

func churnEmailsEnabled() bool {
	v := strings.ToLower(strings.TrimSpace(os.Getenv("CHURN_EMAILS_ENABLED")))
	return v == "1" || v == "true" || v == "yes" || v == "on"
}

var winbackConfig *DripConfig

func loadWinbackConfig() *DripConfig {
	data, err := os.ReadFile("emails/winback_config.json")
	if err != nil {
		data, err = os.ReadFile("../emails/winback_config.json")
		if err != nil {
			log.Printf("winback config not found: %v", err)
			return nil
		}
	}
	cfg := &DripConfig{}
	if err := json.Unmarshal(data, cfg); err != nil || len(cfg.Emails) == 0 {
		log.Printf("winback config invalid: %v", err)
		return nil
	}
	return cfg
}

func startWinbackScheduler() {
	if !churnEmailsEnabled() {
		return
	}
	winbackConfig = loadWinbackConfig()
	if winbackConfig == nil {
		return
	}
	log.Printf("Win-back email chain enabled: %d emails", len(winbackConfig.Emails))
	go winbackSchedulerLoop()
}

func winbackSchedulerLoop() {
	time.Sleep(45 * time.Second)
	for {
		runWinbackPass(time.Now(), sendWinbackEmail)
		time.Sleep(30 * time.Minute)
	}
}

type winbackCandidate struct {
	User     User
	CycleEnd time.Time
	LastStep int
}

func nextWinbackEmail(cfg *DripConfig, lastStep int, cycleEnd, now time.Time) (DripEmail, bool) {
	days := now.Sub(cycleEnd).Hours() / 24
	for _, e := range cfg.Emails {
		if e.ID <= lastStep {
			continue
		}
		if float64(e.DelayDays) <= days {
			return e, true
		}
		return DripEmail{}, false
	}
	return DripEmail{}, false
}

func processWinbackEmails(now time.Time, send func(*User, DripEmail) error) {
	if dbConn == nil {
		return
	}
	processWinbackEmailsWith(dbConn, now, send)
}

func processWinbackEmailsWith(dbConn *DB, now time.Time, send func(*User, DripEmail) error) {
	if !churnEmailsEnabled() || winbackConfig == nil || dbConn == nil {
		return
	}
	cands, err := dbConn.ListWinbackCandidates()
	if err != nil {
		log.Printf("Winback scheduler: list error: %v", err)
		return
	}
	for _, c := range cands {
		e, ok := nextWinbackEmail(winbackConfig, c.LastStep, c.CycleEnd, now)
		if !ok {
			continue
		}
		if out, err := dbConn.IsEmailOptedOut(c.User.Email); err != nil || out {
			continue
		}
		claimed, err := dbConn.ClaimWinbackSend(c.User.Email, e.ID, winbackLease)
		if err != nil || !claimed {
			continue
		}
		u := c.User
		if err := send(&u, e); err != nil {
			log.Printf("Winback scheduler: %v", err)
			continue
		}
		if err := dbConn.MarkWinbackSent(u.Email, e.ID); err != nil {
			log.Printf("Winback scheduler: mark sent %s #%d: %v", u.Email, e.ID, err)
		}
	}
}

func sendWinbackEmail(user *User, e DripEmail) error {
	html, err := loadEmailTemplate(e.Template)
	if err != nil {
		return err
	}
	unsub, err := signedUnsubscribeURL(user.Email)
	if err != nil {
		return fmt.Errorf("send winback %d: %w", e.ID, err)
	}
	html = strings.ReplaceAll(html, "{{.UnsubscribeURL}}", unsub)
	html = personalizeTemplate(html, user)
	if err := sendEmailWithUnsub(user.Email, e.Subject, html, unsub); err != nil {
		return fmt.Errorf("send winback %d to %s: %w", e.ID, user.Email, err)
	}
	log.Printf("Sent winback email #%d (%s) to %s", e.ID, e.Subject, user.Email)
	return nil
}
