package main

import (
	"context"
	"fmt"
	"log"
	"math"
)

func loraFalFallbackAvailable(state characterSwapState) bool {
	return falAPIKey != "" && !loraEnvOff("H3_SWAP_FAL_FALLBACK") && state.Recast == nil && state.SwappedImageURL != ""
}

const loraFalFallbackResolution = "768P"

func loraFalFallbackChargeUSD(state characterSwapState) float64 {
	quoted := loraChargeUSD(state.Request, state.SourceSeconds)
	fal := characterSwapChargeUSD(loraFalFallbackResolution, state.SourceSeconds)
	return math.Min(quoted, fal)
}

func loraFalRequest(req ServiceUsageRequest) ServiceUsageRequest {
	req.Kind = ""
	req.Resolution = loraFalFallbackResolution
	req.ServiceTier = ""
	if req.AspectRatio == "" {
		req.AspectRatio = "adaptive"
	}
	if req.PromptExpansionMode == "" {
		req.PromptExpansionMode = "disabled"
	}
	if req.Prompt == "" || req.Prompt == loraDefaultPrompt {
		req.Prompt = characterSwapDefaultVideoPrompt
	}
	return req
}

func processLoraFalFallback(ctx context.Context, job *VideoJob, state *characterSwapState, sourcePath, workDir string) (string, string, error) {
	chunks, err := planCharacterSwapChunks(state.SourceSeconds, state.Cuts...)
	if err != nil {
		return "", "", fmt.Errorf("%s", loraCapacityMessage)
	}
	log.Printf("[character-swap-lora] job=%s routing %d clips to the fal H3 lane (charge capped at $%.2f)", job.ID, len(chunks), loraFalFallbackChargeUSD(*state))
	fal := *state
	fal.Request = loraFalRequest(state.Request)
	fal.Chunks = chunks
	fal.Stage = "video"
	_ = persistCharacterSwapState(job.ID, "processing", fal)
	outputPath, err := runFalSwapPipeline(ctx, job, &fal, sourcePath, workDir)
	if err != nil {
		return "", "", err
	}
	outputURL, err := publishFinalVideo(ctx, outputPath, job.UserID, func() (string, error) {
		return uploadCharacterSwapFile(ctx, outputPath, job.UserID, "video/mp4")
	})
	if err != nil {
		return "", "", fmt.Errorf("could not publish the final video")
	}
	state.Chunks, state.IdentityURLs, state.Stage = fal.Chunks, fal.IdentityURLs, "mux"
	state.ChargeUSD = loraFalFallbackChargeUSD(*state)
	return outputURL, outputPath, nil
}

func runFalSwapPipeline(ctx context.Context, job *VideoJob, fal *characterSwapState, sourcePath, workDir string) (string, error) {
	if len(fal.IdentityURLs) == 0 && fal.SwappedImageURL != "" {
		fal.IdentityURLs = characterSwapIdentityRefs(ctx, job, fal.SwappedImageURL, workDir)
	}
	if err := prepareCharacterSwapChunks(ctx, job, fal, sourcePath, workDir); err != nil {
		return "", err
	}
	if err := runCharacterSwapChunks(ctx, job, fal, sourcePath, workDir); err != nil {
		return "", err
	}
	if videoJobCancellationRequested(job.ID) {
		return "", fmt.Errorf("cancelled")
	}
	fal.Stage = "mux"
	_ = persistCharacterSwapState(job.ID, "processing", *fal)
	outputPath, err := muxCharacterSwapVideo(ctx, *fal, sourcePath, workDir)
	if err != nil {
		return "", fmt.Errorf("could not assemble the final video: %s", truncateString(err.Error(), 200))
	}
	return outputPath, nil
}
