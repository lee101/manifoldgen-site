package main

import (
	"context"
	"log"
	"strings"
	"sync"
	"time"

	"runpodbroker"
)

// Batch-first Runpod compute (https://docs.runpod.io/serverless/batch-jobs):
// up to 30% off (20% on H100/H200/B200/B300) for work that can wait. Opt in per
// endpoint with RUNPOD_BATCH_ENDPOINTS=id1,id2; a job that no batch worker has
// started within RUNPOD_BATCH_PATIENCE (default 90s) is cancelled in the batch
// (queued requests are not billed) and resubmitted on serverless /run.
const runpodBatchPatienceDefault = 90 * time.Second

var runpodBatchJobs sync.Map // request id -> *runpodBatchJob

type runpodBatchJob struct {
	endpointID string
	batchID    string
	input      map[string]interface{}
	policy     map[string]interface{}
	at         time.Time
}

func runpodBatchEndpoint(endpointID string) bool {
	for _, id := range strings.Split(getEnv("RUNPOD_BATCH_ENDPOINTS", ""), ",") {
		if strings.TrimSpace(id) == endpointID && endpointID != "" {
			return true
		}
	}
	return false
}

func runpodBatchPatience() time.Duration {
	if d, err := time.ParseDuration(strings.TrimSpace(getEnv("RUNPOD_BATCH_PATIENCE", ""))); err == nil && d > 0 {
		return d
	}
	return runpodBatchPatienceDefault
}

func runpodBrokerClient() *runpodbroker.Client {
	c := runpodbroker.NewClient(h3RunpodAPIKey())
	c.BaseURL = h3RunpodBaseURL()
	return c
}

// submitRunpodBatchJob submits one request as a finalized single-request batch.
// ok=false means the caller should use /run (batch rejected or not enabled).
func submitRunpodBatchJob(endpointID string, input map[string]interface{}, policy map[string]interface{}, queued *h3RunpodQueuedJob) bool {
	if !runpodBatchEndpoint(endpointID) || h3RunpodAPIKey() == "" {
		return false
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	c := runpodBrokerClient()
	batchID, err := c.CreateBatch(ctx, endpointID, []runpodbroker.Request{{Input: input, Policy: policy}})
	if err != nil {
		log.Printf("[runpod-batch] create failed endpoint=%s, using /run: %v", endpointID, err)
		return false
	}
	if err := c.FinalizeBatch(ctx, endpointID, batchID); err != nil {
		_, _ = c.CancelBatch(ctx, endpointID, batchID)
		log.Printf("[runpod-batch] finalize failed endpoint=%s, using /run: %v", endpointID, err)
		return false
	}
	reqs, _, err := c.BatchRequests(ctx, endpointID, batchID, 0, 1)
	if err != nil || len(reqs) == 0 {
		_, _ = c.CancelBatch(ctx, endpointID, batchID)
		log.Printf("[runpod-batch] request lookup failed endpoint=%s, using /run: %v", endpointID, err)
		return false
	}
	queued.ID, queued.Status = reqs[0].ID, "IN_QUEUE"
	runpodBatchJobs.Store(queued.ID, &runpodBatchJob{endpointID: endpointID, batchID: batchID, input: input, policy: policy, at: time.Now()})
	return true
}

// runpodBatchExpire moves a batch request nobody has started to serverless.
// It returns the new request id, or "" when the job should keep waiting.
func runpodBatchExpire(endpointID, requestID string) string {
	value, ok := runpodBatchJobs.Load(requestID)
	if !ok {
		return ""
	}
	job := value.(*runpodBatchJob)
	if time.Since(job.at) < runpodBatchPatience() {
		return ""
	}
	ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
	defer cancel()
	c := runpodBrokerClient()
	if batch, err := c.GetBatch(ctx, endpointID, job.batchID); err != nil || batch.Started() {
		return ""
	}
	batch, err := c.CancelBatch(ctx, endpointID, job.batchID)
	if err != nil || batch.Started() {
		return ""
	}
	run, err := c.Run(ctx, endpointID, job.input, job.policy)
	if err != nil || run.ID == "" {
		log.Printf("[runpod-batch] serverless fallback failed endpoint=%s: %v", endpointID, err)
		return ""
	}
	runpodBatchJobs.Delete(requestID)
	log.Printf("[runpod-batch] no batch worker within %s endpoint=%s, moved to /run", runpodBatchPatience(), endpointID)
	return run.ID
}
