package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/valyala/fasthttp"
)

var (
	pgOnce sync.Once
	pgDSN  string
	pgErr  error
	pgCmd  *exec.Cmd
	pgDir  string
)

func TestMain(m *testing.M) {
	code := m.Run()
	if pgCmd != nil {
		_ = pgCmd.Process.Kill()
		_, _ = pgCmd.Process.Wait()
		_ = os.RemoveAll(pgDir)
	}
	os.Exit(code)
}

func startTempPG() (string, error) {
	bin := ""
	for _, v := range []string{"17", "18", "16", "15"} {
		if _, err := os.Stat("/usr/lib/postgresql/" + v + "/bin/initdb"); err == nil {
			bin = "/usr/lib/postgresql/" + v + "/bin"
			break
		}
	}
	if bin == "" {
		return "", fmt.Errorf("postgres binaries not found")
	}
	dir, err := os.MkdirTemp("", "mgpg")
	if err != nil {
		return "", err
	}
	pgDir = dir
	data := filepath.Join(dir, "data")
	if out, err := exec.Command(bin+"/initdb", "-D", data, "-U", "t", "--auth=trust", "-E", "UTF8").CombinedOutput(); err != nil {
		return "", fmt.Errorf("initdb: %v %s", err, out)
	}
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", err
	}
	port := l.Addr().(*net.TCPAddr).Port
	l.Close()
	pgCmd = exec.Command(bin+"/postgres", "-D", data, "-p", fmt.Sprint(port), "-c", "listen_addresses=127.0.0.1", "-k", dir, "-c", "fsync=off")
	if err := pgCmd.Start(); err != nil {
		return "", err
	}
	dsn := fmt.Sprintf("postgres://t@127.0.0.1:%d/postgres?sslmode=disable", port)
	for i := 0; i < 100; i++ {
		c, err := sql.Open("postgres", dsn)
		if err == nil && c.Ping() == nil {
			c.Close()
			return dsn, nil
		}
		time.Sleep(100 * time.Millisecond)
	}
	return "", fmt.Errorf("postgres did not start")
}

func tempDB(t *testing.T) *DB {
	t.Helper()
	pgOnce.Do(func() { pgDSN, pgErr = startTempPG() })
	if pgErr != nil {
		t.Skip(pgErr)
	}
	return openFresh(t)
}

func openFresh(t *testing.T) *DB {
	t.Helper()
	admin, err := sql.Open("postgres", pgDSN)
	if err != nil {
		t.Fatal(err)
	}
	name := fmt.Sprintf("t_%d", time.Now().UnixNano())
	if _, err := admin.Exec("CREATE DATABASE " + name); err != nil {
		t.Fatal(err)
	}
	admin.Close()
	dsn := strings.Replace(pgDSN, "/postgres?", "/"+name+"?", 1)
	db, err := NewDB(dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	t.Setenv("TEST_DSN", dsn)
	return db
}

func extraHandle(t *testing.T) *DB {
	t.Helper()
	db, err := NewDB(os.Getenv("TEST_DSN"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func addUser(t *testing.T, db *DB, id, email, sub, cust, status string) {
	t.Helper()
	_, err := db.conn.Exec(
		`INSERT INTO users (id, wallet_address, email, api_key, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_plan)
		 VALUES ($1, $1, $2, $1, $3, $4, $5, 'creator')`, id, email, cust, sub, status)
	if err != nil {
		t.Fatal(err)
	}
}

func subJSON(t *testing.T, s string) stripeSubscription {
	t.Helper()
	var sub stripeSubscription
	if err := json.Unmarshal([]byte(s), &sub); err != nil {
		t.Fatal(err)
	}
	return sub
}

func TestWinbackClaimExactlyOnceUnderParallelClaims(t *testing.T) {
	db := tempDB(t)
	handles := []*DB{db, extraHandle(t), extraHandle(t), extraHandle(t)}
	var wins int32
	var wg sync.WaitGroup
	for i := 0; i < 64; i++ {
		wg.Add(1)
		go func(h *DB) {
			defer wg.Done()
			ok, err := h.ClaimWinbackSend("A@Example.com", 1, winbackLease)
			if err != nil {
				t.Error(err)
			}
			if ok {
				atomic.AddInt32(&wins, 1)
			}
		}(handles[i%4])
	}
	wg.Wait()
	if wins != 1 {
		t.Fatalf("claims won = %d", wins)
	}
	if ok, _ := db.ClaimWinbackSend("a@example.com", 1, winbackLease); ok {
		t.Fatal("reclaimed within lease")
	}
	if ok, _ := db.ClaimWinbackSend("a@example.com", 2, winbackLease); !ok {
		t.Fatal("other step must be claimable")
	}
	back := func(step int) {
		if _, err := db.conn.Exec(`UPDATE winback_claims SET claimed_at = NOW() - INTERVAL '31 minutes' WHERE step = $1`, step); err != nil {
			t.Fatal(err)
		}
	}
	back(1)
	wins = 0
	for i := 0; i < 32; i++ {
		wg.Add(1)
		go func(h *DB) {
			defer wg.Done()
			if ok, _ := h.ClaimWinbackSend("a@example.com", 1, winbackLease); ok {
				atomic.AddInt32(&wins, 1)
			}
		}(handles[i%4])
	}
	wg.Wait()
	if wins != 1 {
		t.Fatalf("lease retry wins = %d", wins)
	}
	back(1)
	if err := db.MarkWinbackSent("a@example.com", 1); err != nil {
		t.Fatal(err)
	}
	back(1)
	if ok, _ := db.ClaimWinbackSend("a@example.com", 1, winbackLease); ok {
		t.Fatal("sent step retried")
	}
}

func TestWinbackPassSendsOnceAcrossRunners(t *testing.T) {
	t.Setenv("CHURN_EMAILS_ENABLED", "1")
	db := tempDB(t)
	handles := []*DB{db, extraHandle(t), extraHandle(t)}
	addUser(t, db, "u1", "u1@example.com", "sub_1", "cus_1", "canceled")
	if _, err := db.RecordCancellation(cancelRecord{SubscriptionID: "sub_1", CustomerID: "cus_1", Source: "portal", EndsAt: time.Now().Add(-72 * time.Hour)}); err != nil {
		t.Fatal(err)
	}
	winbackConfig = loadWinbackConfig()
	old := dbConn
	defer func() { dbConn = old }()
	var sent int32
	var wg sync.WaitGroup
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func(h *DB) {
			defer wg.Done()
			processWinbackEmailsWith(h, time.Now(), func(*User, DripEmail) error {
				atomic.AddInt32(&sent, 1)
				time.Sleep(50 * time.Millisecond)
				return nil
			})
		}(handles[i%3])
	}
	wg.Wait()
	if sent != 1 {
		t.Fatalf("sent = %d", sent)
	}
	var st string
	_ = db.conn.QueryRow(`SELECT status FROM winback_claims WHERE recipient='u1@example.com' AND step=1`).Scan(&st)
	if st != "sent" {
		t.Fatalf("status = %q", st)
	}
}

func TestWinbackFailedSendRetriedOnlyAfterLease(t *testing.T) {
	t.Setenv("CHURN_EMAILS_ENABLED", "1")
	db := tempDB(t)
	addUser(t, db, "u1", "u1@example.com", "sub_1", "cus_1", "canceled")
	_, _ = db.RecordCancellation(cancelRecord{SubscriptionID: "sub_1", CustomerID: "cus_1", Source: "app", EndsAt: time.Now().Add(-72 * time.Hour)})
	winbackConfig = loadWinbackConfig()
	var n int32
	fail := func(*User, DripEmail) error { atomic.AddInt32(&n, 1); return fmt.Errorf("smtp down") }
	processWinbackEmailsWith(db, time.Now(), fail)
	processWinbackEmailsWith(db, time.Now(), fail)
	if n != 1 {
		t.Fatalf("retried within lease: %d", n)
	}
	_, _ = db.conn.Exec(`UPDATE winback_claims SET claimed_at = NOW() - INTERVAL '31 minutes'`)
	processWinbackEmailsWith(db, time.Now(), func(*User, DripEmail) error { atomic.AddInt32(&n, 1); return nil })
	if n != 2 {
		t.Fatalf("not retried after lease: %d", n)
	}
}

func TestWinbackSkipsOptedOut(t *testing.T) {
	t.Setenv("CHURN_EMAILS_ENABLED", "1")
	db := tempDB(t)
	addUser(t, db, "u1", "U1@example.com", "sub_1", "cus_1", "canceled")
	addUser(t, db, "u2", "u2@example.com", "sub_2", "cus_2", "canceled")
	for _, s := range []string{"sub_1", "sub_2"} {
		_, _ = db.RecordCancellation(cancelRecord{SubscriptionID: s, CustomerID: "cus_" + s[4:], Source: "portal", EndsAt: time.Now().Add(-72 * time.Hour)})
	}
	if err := db.UnsubscribeEmail("u1@EXAMPLE.com"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.conn.Exec(`UPDATE users SET unsubscribed = FALSE`); err != nil {
		t.Fatal(err)
	}
	winbackConfig = loadWinbackConfig()
	var got []string
	processWinbackEmailsWith(db, time.Now(), func(u *User, _ DripEmail) error { got = append(got, u.ID); return nil })
	if len(got) != 1 || got[0] != "u2" {
		t.Fatalf("sent to %v", got)
	}
}

func TestCancellationEventsRecorded(t *testing.T) {
	db := tempDB(t)
	addUser(t, db, "u1", "u1@example.com", "sub_1", "cus_1", "active")
	addUser(t, db, "u2", "u2@example.com", "sub_2", "cus_2", "past_due")
	addUser(t, db, "u3", "u3@example.com", "sub_3", "cus_3", "active")
	end := time.Now().Add(24 * time.Hour).Unix()
	_, _ = db.conn.Exec(`INSERT INTO cancel_surveys (id, user_id, reason, outcome) VALUES ('s1', 'u3', 'too_expensive', 'canceled')`)

	portal := subJSON(t, fmt.Sprintf(`{"id":"sub_1","customer":"cus_1","status":"active","cancel_at_period_end":true,"current_period_end":%d,"cancellation_details":{"reason":"cancellation_requested","feedback":"too_expensive","comment":"pricey"}}`, end))
	applyCancellation(db, "customer.subscription.updated", portal, time.Now())
	applyCancellation(db, "customer.subscription.updated", portal, time.Now())
	dun := subJSON(t, `{"id":"sub_2","customer":"cus_2","status":"canceled","ended_at":1700000000,"cancellation_details":{"reason":"payment_failed"}}`)
	applyCancellation(db, "customer.subscription.deleted", dun, time.Now())
	app := subJSON(t, fmt.Sprintf(`{"id":"sub_3","customer":"cus_3","status":"active","cancel_at_period_end":true,"current_period_end":%d,"cancellation_details":{"reason":"cancellation_requested"},"metadata":{"cancel_source":"app"}}`, end))
	applyCancellation(db, "customer.subscription.updated", app, time.Now())

	type row struct{ src, reason, detail string }
	get := func(id string) row {
		var r row
		if err := db.conn.QueryRow(`SELECT source, reason, detail FROM subscription_cancellations WHERE stripe_subscription_id=$1`, id).Scan(&r.src, &r.reason, &r.detail); err != nil {
			t.Fatalf("%s: %v", id, err)
		}
		return r
	}
	if r := get("sub_1"); r != (row{"portal", "too_expensive", "pricey"}) {
		t.Fatalf("sub_1 %+v", r)
	}
	if r := get("sub_2"); r.src != "dunning" {
		t.Fatalf("sub_2 %+v", r)
	}
	if r := get("sub_3"); r.src != "app" || r.reason != "too_expensive" {
		t.Fatalf("sub_3 %+v", r)
	}
	var n int
	_ = db.conn.QueryRow(`SELECT COUNT(*) FROM subscription_cancellations`).Scan(&n)
	if n != 3 {
		t.Fatalf("rows = %d", n)
	}

	undo := subJSON(t, `{"id":"sub_1","customer":"cus_1","status":"active","cancel_at_period_end":false}`)
	applyCancellation(db, "customer.subscription.updated", undo, time.Now())
	var resc bool
	_ = db.conn.QueryRow(`SELECT rescinded FROM subscription_cancellations WHERE stripe_subscription_id='sub_1'`).Scan(&resc)
	if !resc {
		t.Fatal("not rescinded")
	}
	applyCancellation(db, "customer.subscription.updated", portal, time.Now())
	_ = db.conn.QueryRow(`SELECT rescinded FROM subscription_cancellations WHERE stripe_subscription_id='sub_1'`).Scan(&resc)
	if resc {
		t.Fatal("re-cancel did not clear rescind")
	}
}

func TestReconcileIdempotentAndFillsMissed(t *testing.T) {
	db := tempDB(t)
	addUser(t, db, "u1", "u1@example.com", "sub_1", "cus_1", "canceled")
	addUser(t, db, "u2", "u2@example.com", "sub_2", "cus_2", "canceled")
	recent := time.Now().Add(-5 * 24 * time.Hour).Unix()
	old := time.Now().Add(-60 * 24 * time.Hour).Unix()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("status") != "canceled" {
			t.Errorf("query %s", r.URL.RawQuery)
		}
		_, _ = w.Write([]byte(fmt.Sprintf(`{"has_more":false,"data":[
			{"id":"sub_1","customer":"cus_1","status":"canceled","ended_at":%d,"cancellation_details":{"reason":"payment_failed"}},
			{"id":"sub_2","customer":"cus_2","status":"canceled","ended_at":%d},
			{"id":"sub_x","customer":"cus_x","status":"canceled","ended_at":%d}]}`, recent, old, recent)))
	}))
	defer srv.Close()
	s := &stripeService{secretKey: "sk", baseURL: srv.URL, client: srv.Client()}
	for i := 0; i < 2; i++ {
		if _, err := reconcileRecentCancellations(db, s, time.Now()); err != nil {
			t.Fatal(err)
		}
	}
	var n int
	var src string
	_ = db.conn.QueryRow(`SELECT COUNT(*) FROM subscription_cancellations`).Scan(&n)
	_ = db.conn.QueryRow(`SELECT source FROM subscription_cancellations WHERE stripe_subscription_id='sub_1'`).Scan(&src)
	if n != 1 || src != "dunning" {
		t.Fatalf("rows=%d src=%s", n, src)
	}
	cands, err := db.ListWinbackCandidates()
	if err != nil || len(cands) != 1 || cands[0].User.ID != "u1" {
		t.Fatalf("cands %v %v", cands, err)
	}
}

func TestRunnerLockSingleHolder(t *testing.T) {
	db := tempDB(t)
	other := extraHandle(t)
	rel, ok, err := db.TryRunnerLock(winbackLockKey)
	if err != nil || !ok {
		t.Fatalf("first lock %v %v", ok, err)
	}
	if _, ok, _ := other.TryRunnerLock(winbackLockKey); ok {
		t.Fatal("second runner got lock")
	}
	rel()
	rel2, ok, _ := other.TryRunnerLock(winbackLockKey)
	if !ok {
		t.Fatal("lock not released")
	}
	rel2()
}

func TestUnsubscribeTokenAndHandler(t *testing.T) {
	t.Setenv("UNSUBSCRIBE_SECRET", "")
	if _, err := signedUnsubscribeURL("a@b.com"); err == nil {
		t.Fatal("must fail closed without secret")
	}
	if _, ok := verifyUnsubscribeToken("YUBiLmNvbQ", "x"); ok {
		t.Fatal("verified without secret")
	}
	t.Setenv("UNSUBSCRIBE_SECRET", "s3cret")
	u, err := signedUnsubscribeURL("A@B.com")
	if err != nil {
		t.Fatal(err)
	}
	pu, _ := parseURL(u)
	email, ok := verifyUnsubscribeToken(pu.Query().Get("e"), pu.Query().Get("t"))
	if !ok || email != "a@b.com" {
		t.Fatalf("verify %q %v", email, ok)
	}
	if _, ok := verifyUnsubscribeToken(pu.Query().Get("e"), pu.Query().Get("t")+"0"); ok {
		t.Fatal("tampered token accepted")
	}
	db := tempDB(t)
	old := dbConn
	dbConn = db
	defer func() { dbConn = old }()
	addUser(t, db, "u1", "a@b.com", "", "", "")
	do := func(method, uri string) int {
		ctx := &fasthttp.RequestCtx{}
		ctx.Request.Header.SetMethod(method)
		ctx.Request.SetRequestURI(uri)
		handleUnsubscribe(ctx)
		return ctx.Response.StatusCode()
	}
	if c := do("POST", "/unsubscribe?e="+pu.Query().Get("e")+"&t=bad"); c != 400 {
		t.Fatalf("bad token status %d", c)
	}
	if out, _ := db.IsEmailOptedOut("a@b.com"); out {
		t.Fatal("opted out on bad token")
	}
	if c := do("POST", "/unsubscribe?"+pu.RawQuery); c != 200 {
		t.Fatalf("one-click status %d", c)
	}
	if out, _ := db.IsEmailOptedOut("a@b.com"); !out {
		t.Fatal("not recorded")
	}
}

func TestWinbackTemplatesUnsubscribeFooter(t *testing.T) {
	cfg := loadWinbackConfig()
	for _, e := range cfg.Emails {
		h, err := loadEmailTemplate(e.Template)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Count(h, "{{.UnsubscribeURL}}") != 1 {
			t.Fatalf("%s unsubscribe placeholder count", e.Template)
		}
		l := strings.ToLower(h)
		for _, bad := range []string{"reply stop", "reply \"stop\"", "reply with stop"} {
			if strings.Contains(l, bad) {
				t.Fatalf("%s contains %q", e.Template, bad)
			}
		}
	}
}

func parseURL(s string) (*url.URL, error) { return url.Parse(s) }
