package main

import (
	"encoding/json"
	"log"
	"strings"
	"time"
)

func videoWantsTransparency(req ServiceUsageRequest) bool {
	return req.AddTransparency != nil && *req.AddTransparency
}

func stampH3Transparency(input map[string]interface{}, req ServiceUsageRequest) {
	if !videoWantsTransparency(req) {
		return
	}
	input["add_transparency"] = true
	if req.FirstFrame != "" {
		input["mask_url"] = req.FirstFrame
	} else if req.ImageURL != "" {
		input["mask_url"] = req.ImageURL
	}
}

func persistH3Request(req ServiceUsageRequest, input map[string]interface{}) []byte {
	stored := map[string]interface{}{}
	for key, value := range input {
		stored[key] = value
	}
	stampH3Transparency(stored, req)
	encoded, _ := json.Marshal(stored)
	return encoded
}

func stripH3ProviderTransparency(input map[string]interface{}) {
	if input == nil {
		return
	}
	delete(input, "add_transparency")
	delete(input, "mask_url")
}

func storedWantsTransparency(stored map[string]interface{}) bool {
	switch typed := stored["add_transparency"].(type) {
	case bool:
		return typed
	case string:
		return strings.EqualFold(strings.TrimSpace(typed), "true")
	default:
		return false
	}
}

func carryH3TransparencyFlags(job *VideoJob, result map[string]interface{}) {
	if job == nil || result == nil {
		return
	}
	var stored map[string]interface{}
	if json.Unmarshal(job.Result, &stored) != nil || !storedWantsTransparency(stored) {
		return
	}
	result["add_transparency"] = true
	if mask, _ := stored["mask_url"].(string); strings.TrimSpace(mask) != "" {
		result["mask_url"] = mask
	} else if frame, _ := stored["first_frame"].(string); strings.TrimSpace(frame) != "" {
		result["mask_url"] = frame
	}
	if url, _ := result["video_url"].(string); strings.TrimSpace(url) != "" {
		result["opaque_video_url"] = url
	}
	if result["transparency_status"] == nil {
		result["transparency_status"] = "queued"
	}
}

func mergeTransparencyIntoH3Result(result []byte, patch map[string]interface{}) []byte {
	payload := map[string]interface{}{}
	_ = json.Unmarshal(result, &payload)
	for key, value := range patch {
		payload[key] = value
	}
	encoded, err := json.Marshal(payload)
	if err != nil {
		return result
	}
	return encoded
}

func applyH3TransparencyToResult(job *VideoJob, result []byte) []byte {
	var payload map[string]interface{}
	if json.Unmarshal(result, &payload) != nil {
		return result
	}
	carryH3TransparencyFlags(job, payload)
	encoded, err := json.Marshal(payload)
	if err != nil {
		return result
	}
	return encoded
}

func afterH3VideoSettled(job *VideoJob, result []byte) {
	indexCompletedH3Asset(job, result)
	maybeTriggerAutoTopup(job.UserID)
	var payload map[string]interface{}
	if json.Unmarshal(result, &payload) != nil || !storedWantsTransparency(payload) {
		return
	}
	go enqueueH3Transparency(job.ID)
}

func enqueueH3Transparency(jobID string) {
	job, err := dbConn.GetVideoJobInternal(jobID)
	if err != nil || job == nil {
		return
	}
	var result map[string]interface{}
	if json.Unmarshal(job.Result, &result) != nil || !storedWantsTransparency(result) {
		return
	}
	if strings.TrimSpace(asStringMap(result["transparent_video_url"])) != "" {
		return
	}
	if id := strings.TrimSpace(asStringMap(result["transparency_job_id"])); id != "" {
		refreshH3Transparency(job)
		return
	}
	user, err := dbConn.GetUserByID(job.UserID)
	if err != nil || user == nil {
		log.Printf("[video-transparency] user missing job=%s: %v", jobID, err)
		return
	}
	videoURL := strings.TrimSpace(asStringMap(result["opaque_video_url"]))
	if videoURL == "" {
		videoURL = strings.TrimSpace(asStringMap(result["video_url"]))
	}
	if videoURL == "" {
		log.Printf("[video-transparency] no opaque video job=%s", jobID)
		return
	}
	duration := 15
	if value, ok := result["duration_seconds"].(float64); ok && value >= 1 {
		duration = int(value + 0.5)
		if duration < 1 {
			duration = 1
		}
		if duration > 30 {
			duration = 30
		}
	}
	on := true
	req := ServiceUsageRequest{
		VideoURL: videoURL, Duration: duration, BackgroundColor: "transparent",
		OutputFormat: "webm_vp9", MaxQuality: &on, MaskURL: strings.TrimSpace(asStringMap(result["mask_url"])),
	}
	if err := normalizeVideoBackgroundRequest(&req); err != nil {
		log.Printf("[video-transparency] invalid request job=%s: %v", jobID, err)
		return
	}
	var providerID string
	var submitErr error
	for attempt := 0; attempt < 3; attempt++ {
		providerID, submitErr = submitPrivateVideoBackground(req, user)
		if submitErr == nil && providerID != "" {
			break
		}
		time.Sleep(time.Duration(attempt+1) * 2 * time.Second)
	}
	if submitErr != nil || providerID == "" {
		encoded := mergeTransparencyIntoH3Result(job.Result, map[string]interface{}{
			"transparency_status": "failed",
			"transparency_error":  "transparent video could not be queued",
		})
		_ = dbConn.UpdateCompletedVideoResult(jobID, encoded)
		log.Printf("[video-transparency] submit failed job=%s: %v", jobID, submitErr)
		return
	}
	stored, _ := json.Marshal(videoBackgroundStoredRequest{Input: req, RequestKey: videoBackgroundRequestKey(req)})
	bgJob, err := dbConn.CreateVideoJobForService(user.ID, providerID, "video_background_removal", "Video background removal")
	if err != nil {
		log.Printf("[video-transparency] persist failed job=%s: %v", jobID, err)
		return
	}
	if err := dbConn.UpdateVideoJob(bgJob.ID, "queued", stored, ""); err != nil {
		log.Printf("[video-transparency] persist input failed job=%s: %v", jobID, err)
		return
	}
	launchVideoJob(bgJob.ID)
	encoded := mergeTransparencyIntoH3Result(job.Result, map[string]interface{}{
		"transparency_job_id": bgJob.ID,
		"transparency_status": "queued",
	})
	_ = dbConn.UpdateCompletedVideoResult(jobID, encoded)
}

func refreshH3Transparency(job *VideoJob) {
	if job == nil || len(job.Result) == 0 {
		return
	}
	var result map[string]interface{}
	if json.Unmarshal(job.Result, &result) != nil || !storedWantsTransparency(result) {
		return
	}
	if strings.TrimSpace(asStringMap(result["transparent_video_url"])) != "" {
		result["transparency_status"] = "completed"
		job.Result, _ = json.Marshal(result)
		return
	}
	id := strings.TrimSpace(asStringMap(result["transparency_job_id"]))
	if id == "" {
		result["transparency_status"] = "queued"
		job.Result, _ = json.Marshal(result)
		go enqueueH3Transparency(job.ID)
		return
	}
	bg, err := dbConn.GetVideoJobInternal(id)
	if err != nil || bg == nil {
		result["transparency_status"] = "queued"
		job.Result, _ = json.Marshal(result)
		return
	}
	result["transparency_status"] = bg.Status
	if strings.EqualFold(bg.Status, "failed") || strings.EqualFold(bg.Status, "error") {
		result["transparency_error"] = "transparent video failed"
		if bg.Error != "" {
			result["transparency_error"] = bg.Error
		}
	}
	if strings.EqualFold(bg.Status, "completed") && len(bg.Result) > 0 {
		var bgResult map[string]interface{}
		if json.Unmarshal(bg.Result, &bgResult) == nil {
			url := strings.TrimSpace(asStringMap(bgResult["video_url"]))
			if url != "" {
				result["transparent_video_url"] = url
				result["transparency_status"] = "completed"
				encoded, _ := json.Marshal(result)
				_ = dbConn.UpdateCompletedVideoResult(job.ID, encoded)
			}
		}
	}
	job.Result, _ = json.Marshal(result)
}

func asStringMap(value interface{}) string {
	text, _ := value.(string)
	return text
}
