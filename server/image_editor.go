package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/valyala/fasthttp"
)

const (
	imageEditorBackgroundCredits = 1.0
	imageEditorSelectionCredits  = 1.0
	imageEditorTextCredits       = 1.0
	imageEditorEditCredits       = 8.0
)

type imageEditorRequest struct {
	ImageURL string `json:"image_url"`
	MaskURL  string `json:"mask_url,omitempty"`
	Prompt   string `json:"prompt,omitempty"`
	Box      *struct {
		X      float64 `json:"x"`
		Y      float64 `json:"y"`
		Width  float64 `json:"width"`
		Height float64 `json:"height"`
	} `json:"box,omitempty"`
	Points []struct {
		X     float64 `json:"x"`
		Y     float64 `json:"y"`
		Label int     `json:"label"`
	} `json:"points,omitempty"`
}

func imageEditorCharge(user *User, credits float64, event, description string) (float64, error) {
	balance, err := dbConn.DeductUserCredits(user.ID, credits)
	if err != nil {
		return 0, err
	}
	price := getCUTEPriceUSD()
	_ = dbConn.CreateBillingEvent(&BillingEvent{
		UserID: user.ID, EventType: event, Amount: -credits, CuteAmount: credits,
		USDAmount: credits * price, Description: description, CreditsAfter: balance,
	})
	return balance, nil
}

func imageEditorRefund(user *User, credits float64, event string) {
	balance, err := dbConn.AddUserCredits(user.ID, credits)
	if err != nil {
		return
	}
	price := getCUTEPriceUSD()
	_ = dbConn.CreateBillingEvent(&BillingEvent{
		UserID: user.ID, EventType: "refund", Amount: credits, CuteAmount: credits,
		USDAmount: credits * price, Description: "Refund: " + event, CreditsAfter: balance,
	})
}

func imageEditorNative(path string, payload interface{}) (json.RawMessage, error) {
	base := strings.TrimRight(getEnv("OMNISERVE_NATIVE_URL", "http://127.0.0.1:8791"), "/")
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest(http.MethodPost, base+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if secret := strings.TrimSpace(getEnv("OMNISERVE_NATIVE_SECRET", getEnv("OMNISERVE_SECRET", ""))); secret != "" {
		req.Header.Set("Authorization", "Bearer "+secret)
	}
	resp, err := studioHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, 32<<20))
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("image editor worker returned %d", resp.StatusCode)
	}
	if !json.Valid(data) {
		return nil, fmt.Errorf("image editor worker returned an invalid response")
	}
	return json.RawMessage(data), nil
}

func imageEditorInput(ctx *fasthttp.RequestCtx, requireMask, requirePrompt bool) (*User, imageEditorRequest, error) {
	user, err := studioUser(ctx)
	if err != nil {
		return nil, imageEditorRequest{}, err
	}
	var input imageEditorRequest
	if err := json.Unmarshal(ctx.PostBody(), &input); err != nil {
		return nil, input, fmt.Errorf("invalid JSON")
	}
	input.ImageURL = strings.TrimSpace(input.ImageURL)
	input.MaskURL = strings.TrimSpace(input.MaskURL)
	input.Prompt = strings.TrimSpace(input.Prompt)
	if err := studioPublicMediaURL(input.ImageURL); err != nil {
		return nil, input, err
	}
	if requireMask {
		if err := studioPublicMediaURL(input.MaskURL); err != nil {
			return nil, input, fmt.Errorf("mask_url: %w", err)
		}
	}
	if requirePrompt && input.Prompt == "" {
		return nil, input, fmt.Errorf("a replacement prompt is required")
	}
	return user, input, nil
}

func handleImageEditorBackground(ctx *fasthttp.RequestCtx) {
	user, input, err := imageEditorInput(ctx, false, false)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	balance, err := imageEditorCharge(user, imageEditorBackgroundCredits, "image_editor_background", "Image Editor background separation")
	if err != nil {
		jsonError(ctx, http.StatusPaymentRequired, "insufficient credits: background separation costs 1 credit")
		return
	}
	result, err := imageEditorNative("/v1/images/background-removals", map[string]interface{}{
		"image_url": input.ImageURL, "output_format": "webp", "cache": true,
		"decontaminate": true, "return_background": true,
	})
	if err != nil {
		imageEditorRefund(user, imageEditorBackgroundCredits, "background separation unavailable")
		jsonError(ctx, http.StatusBadGateway, "background separation is temporarily unavailable")
		return
	}
	maybeTriggerAutoTopup(user.ID)
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{"result": result, "credits_used": imageEditorBackgroundCredits, "credits_remain": balance})
}

func handleImageEditorSelect(ctx *fasthttp.RequestCtx) {
	user, input, err := imageEditorInput(ctx, false, false)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if len(input.Points) == 0 || len(input.Points) > 16 {
		jsonError(ctx, http.StatusBadRequest, "add between 1 and 16 positive or negative selection points")
		return
	}
	for _, point := range input.Points {
		if point.X < 0 || point.X > 1 || point.Y < 0 || point.Y > 1 || (point.Label != 0 && point.Label != 1) {
			jsonError(ctx, http.StatusBadRequest, "selection points must be normalized coordinates")
			return
		}
	}
	balance, err := imageEditorCharge(user, imageEditorSelectionCredits, "image_editor_selection", "Image Editor precise object selection")
	if err != nil {
		jsonError(ctx, http.StatusPaymentRequired, "insufficient credits: precise selection costs 1 credit")
		return
	}
	result, err := imageEditorNative("/v1/images/segmentations", input)
	if err != nil {
		imageEditorRefund(user, imageEditorSelectionCredits, "precise selection unavailable")
		jsonError(ctx, http.StatusBadGateway, "precise selection is warming up. Please try again shortly")
		return
	}
	maybeTriggerAutoTopup(user.ID)
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{"result": result, "credits_used": imageEditorSelectionCredits, "credits_remain": balance})
}

func handleImageEditorText(ctx *fasthttp.RequestCtx) {
	user, input, err := imageEditorInput(ctx, false, false)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	if input.Box == nil || input.Box.X < 0 || input.Box.Y < 0 || input.Box.Width < 0.01 || input.Box.Height < 0.01 ||
		input.Box.X+input.Box.Width > 1 || input.Box.Y+input.Box.Height > 1 {
		jsonError(ctx, http.StatusBadRequest, "draw a text box within the image")
		return
	}
	balance, err := imageEditorCharge(user, imageEditorTextCredits, "image_editor_text_grab", "Image Editor Magic Grab Text")
	if err != nil {
		jsonError(ctx, http.StatusPaymentRequired, "insufficient credits: Magic Grab Text costs 1 credit")
		return
	}
	result, err := imageEditorNative("/v1/images/text-layers", input)
	if err != nil {
		imageEditorRefund(user, imageEditorTextCredits, "Magic Grab Text unavailable")
		jsonError(ctx, http.StatusBadGateway, "Magic Grab Text is warming up. Please try again shortly")
		return
	}
	maybeTriggerAutoTopup(user.ID)
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{"result": result, "credits_used": imageEditorTextCredits, "credits_remain": balance})
}

func handleImageEditorEdit(ctx *fasthttp.RequestCtx) {
	user, input, err := imageEditorInput(ctx, true, true)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	balance, err := imageEditorCharge(user, imageEditorEditCredits, "image_editor_inpaint", "Image Editor targeted regeneration")
	if err != nil {
		jsonError(ctx, http.StatusPaymentRequired, "insufficient credits: targeted regeneration costs 8 credits")
		return
	}
	result, err := imageEditorNative("/v1/images/edits", input)
	if err != nil {
		imageEditorRefund(user, imageEditorEditCredits, "targeted regeneration unavailable")
		jsonError(ctx, http.StatusBadGateway, "targeted regeneration is temporarily unavailable")
		return
	}
	maybeTriggerAutoTopup(user.ID)
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{"result": result, "credits_used": imageEditorEditCredits, "credits_remain": balance})
}
