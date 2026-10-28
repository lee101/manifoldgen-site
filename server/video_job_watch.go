package main

import (
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/valyala/fasthttp"
)

// Long-poll for GET /api/video-jobs/{id} (opt-in: VIDEO_JOB_LONG_POLL=1).
// A client that sends ?wait=<seconds>&status=<last seen status> is held until
// the job's status differs from that value, the job finishes, or the wait
// expires; the response body is unchanged plus "long_poll": true so the
// client knows it may re-request without sleeping. Clients that omit wait, or
// servers with the flag off, keep today's immediate response.

const videoJobLongPollMax = 25 * time.Second

var videoJobLongPollTick = time.Second

func videoJobLongPollEnabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("VIDEO_JOB_LONG_POLL"))) {
	case "1", "true", "yes", "on":
		return true
	}
	return false
}

func videoJobLongPollWait(ctx *fasthttp.RequestCtx) time.Duration {
	if !videoJobLongPollEnabled() {
		return 0
	}
	seconds, err := strconv.ParseFloat(strings.TrimSpace(string(ctx.QueryArgs().Peek("wait"))), 64)
	if err != nil || seconds <= 0 {
		return 0
	}
	wait := time.Duration(seconds * float64(time.Second))
	if wait > videoJobLongPollMax {
		wait = videoJobLongPollMax
	}
	return wait
}

var videoJobWatchers = struct {
	sync.Mutex
	m map[string]map[chan struct{}]struct{}
}{m: map[string]map[chan struct{}]struct{}{}}

func watchVideoJobChange(jobID string) (<-chan struct{}, func()) {
	ch := make(chan struct{}, 1)
	videoJobWatchers.Lock()
	set := videoJobWatchers.m[jobID]
	if set == nil {
		set = map[chan struct{}]struct{}{}
		videoJobWatchers.m[jobID] = set
	}
	set[ch] = struct{}{}
	videoJobWatchers.Unlock()
	return ch, func() {
		videoJobWatchers.Lock()
		if set := videoJobWatchers.m[jobID]; set != nil {
			delete(set, ch)
			if len(set) == 0 {
				delete(videoJobWatchers.m, jobID)
			}
		}
		videoJobWatchers.Unlock()
	}
}

func notifyVideoJobChanged(jobID string) {
	videoJobWatchers.Lock()
	for ch := range videoJobWatchers.m[jobID] {
		select {
		case ch <- struct{}{}:
		default:
		}
	}
	videoJobWatchers.Unlock()
}

func videoJobPending(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "queued", "processing", "pending", "running":
		return true
	}
	return false
}

// awaitVideoJobChange returns the freshest row once its status differs from
// known, it stops being pending, or wait elapses. Notifications are a fast
// path; the one-second re-read covers writers that do not notify.
func awaitVideoJobChange(job *VideoJob, userID, known string, wait time.Duration, load func(id, userID string) (*VideoJob, error)) *VideoJob {
	if known == "" {
		known = job.Status
	}
	changed := func(current *VideoJob) bool {
		return !strings.EqualFold(current.Status, known) || !videoJobPending(current.Status)
	}
	if changed(job) {
		return job
	}
	notify, stop := watchVideoJobChange(job.ID)
	defer stop()
	deadline := time.NewTimer(wait)
	defer deadline.Stop()
	tick := time.NewTicker(videoJobLongPollTick)
	defer tick.Stop()
	for {
		select {
		case <-deadline.C:
			if fresh, err := load(job.ID, userID); err == nil {
				return fresh
			}
			return job
		case <-notify:
		case <-tick.C:
		}
		fresh, err := load(job.ID, userID)
		if err != nil {
			return job
		}
		job = fresh
		if changed(job) {
			return job
		}
	}
}
