package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/valyala/fasthttp"
)

const maxStudioProjectDocumentBytes = 2 << 20

type studioProjectWrite struct {
	Name     string          `json:"name"`
	Document json.RawMessage `json:"document"`
}

type studioAssetPresignInput struct {
	ProjectID   string `json:"project_id"`
	AssetID     string `json:"asset_id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
}

func validateStudioProjectWrite(projectID string, input studioProjectWrite) (studioProjectWrite, error) {
	if _, err := uuid.Parse(projectID); err != nil {
		return input, fmt.Errorf("invalid project ID")
	}
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		input.Name = "Untitled project"
	}
	if utf8.RuneCountInString(input.Name) > 120 {
		return input, fmt.Errorf("project name is too long")
	}
	if len(input.Document) == 0 || len(input.Document) > maxStudioProjectDocumentBytes || !json.Valid(input.Document) {
		return input, fmt.Errorf("invalid project document")
	}
	var object map[string]interface{}
	if json.Unmarshal(input.Document, &object) != nil || object == nil {
		return input, fmt.Errorf("project document must be an object")
	}
	return input, nil
}

func handleListStudioProjects(ctx *fasthttp.RequestCtx) {
	user, err := studioUser(ctx)
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, err.Error())
		return
	}
	projects, err := dbConn.ListStudioProjects(user.ID, 50)
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "could not list projects")
		return
	}
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{"projects": projects})
}

func handleStudioProject(ctx *fasthttp.RequestCtx, projectID, method string) {
	user, err := studioUser(ctx)
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, err.Error())
		return
	}
	if _, err := uuid.Parse(projectID); err != nil {
		jsonError(ctx, http.StatusBadRequest, "invalid project ID")
		return
	}
	switch method {
	case http.MethodGet:
		project, err := dbConn.GetStudioProject(user.ID, projectID)
		if err == sql.ErrNoRows {
			jsonError(ctx, http.StatusNotFound, "project not found")
			return
		}
		if err != nil {
			jsonError(ctx, http.StatusInternalServerError, "could not load project")
			return
		}
		jsonResponse(ctx, http.StatusOK, map[string]interface{}{"project": project})
	case http.MethodPut:
		var input studioProjectWrite
		if json.Unmarshal(ctx.PostBody(), &input) != nil {
			jsonError(ctx, http.StatusBadRequest, "invalid JSON")
			return
		}
		input, err = validateStudioProjectWrite(projectID, input)
		if err != nil {
			jsonError(ctx, http.StatusBadRequest, err.Error())
			return
		}
		project, err := dbConn.UpsertStudioProject(user.ID, projectID, input.Name, input.Document)
		if err == sql.ErrNoRows {
			jsonError(ctx, http.StatusConflict, "project belongs to another account")
			return
		}
		if err != nil {
			jsonError(ctx, http.StatusInternalServerError, "could not save project")
			return
		}
		jsonResponse(ctx, http.StatusOK, map[string]interface{}{"project": project})
	case http.MethodDelete:
		if err := dbConn.DeleteStudioProject(user.ID, projectID); err == sql.ErrNoRows {
			jsonError(ctx, http.StatusNotFound, "project not found")
			return
		} else if err != nil {
			jsonError(ctx, http.StatusInternalServerError, "could not delete project")
			return
		}
		jsonResponse(ctx, http.StatusOK, map[string]bool{"deleted": true})
	default:
		jsonError(ctx, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func validateStudioAssetPresign(input studioAssetPresignInput) (studioAssetPresignInput, error) {
	if _, err := uuid.Parse(input.ProjectID); err != nil {
		return input, fmt.Errorf("invalid project ID")
	}
	if _, err := uuid.Parse(input.AssetID); err != nil {
		return input, fmt.Errorf("invalid asset ID")
	}
	input.Filename = sanitizeUploadName(input.Filename)
	if input.Filename == "" {
		return input, fmt.Errorf("invalid filename")
	}
	input.ContentType = strings.ToLower(strings.TrimSpace(input.ContentType))
	if !(strings.HasPrefix(input.ContentType, "video/") || strings.HasPrefix(input.ContentType, "image/") || strings.HasPrefix(input.ContentType, "audio/")) {
		return input, fmt.Errorf("unsupported media type")
	}
	if input.Size <= 0 || input.Size > 20<<30 {
		return input, fmt.Errorf("asset size must be between 1 byte and 20 GiB")
	}
	return input, nil
}

func handleStudioAssetPresign(ctx *fasthttp.RequestCtx) {
	user, err := studioUser(ctx)
	if err != nil {
		jsonError(ctx, http.StatusUnauthorized, err.Error())
		return
	}
	var input studioAssetPresignInput
	if json.Unmarshal(ctx.PostBody(), &input) != nil {
		jsonError(ctx, http.StatusBadRequest, "invalid JSON")
		return
	}
	input, err = validateStudioAssetPresign(input)
	if err != nil {
		jsonError(ctx, http.StatusBadRequest, err.Error())
		return
	}
	objectKey := studioAssetObjectPrefix(user, input.ProjectID, input.AssetID) + input.Filename
	uploadURL, err := presignR2PutObject(objectKey, input.ContentType, 3600)
	if err != nil {
		jsonError(ctx, http.StatusInternalServerError, "could not prepare asset upload")
		return
	}
	jsonResponse(ctx, http.StatusOK, map[string]interface{}{
		"upload_url": uploadURL,
		"public_url": fmt.Sprintf("https://%s/%s", r2PublicHost, objectKey),
		"object_key": objectKey,
		"expires_in": 3600,
	})
}
