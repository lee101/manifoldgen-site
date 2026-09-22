package lofiloop

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// R2Config is the Cloudflare R2 object store the H3 worker can read from: H3
// only accepts public HTTPS inputs, so the cover still is uploaded first.
type R2Config struct {
	AccountID  string
	AccessKey  string
	SecretKey  string
	Bucket     string
	PublicHost string
	PathPrefix string
}

// R2FromEnv reads the same variables the ManifoldGen server and the
// audio-images-to-vid pipeline use.
func R2FromEnv() R2Config {
	return R2Config{
		AccountID:  firstEnv("R2_ACCOUNT_ID"),
		AccessKey:  firstEnv("R2_ACCESS_KEY_ID", "CLOUDFLARE_R2_ACCESS_KEY_ID"),
		SecretKey:  firstEnv("R2_SECRET_ACCESS_KEY", "CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
		Bucket:     firstEnv("R2_BUCKET"),
		PublicHost: firstEnv("R2_PUBLIC_HOST"),
		PathPrefix: firstEnv("R2_PATH_PREFIX"),
	}
}

func (c R2Config) configured() bool {
	return c.AccountID != "" && c.AccessKey != "" && c.SecretKey != "" && c.Bucket != "" && c.PublicHost != ""
}

func firstEnv(keys ...string) string {
	for _, key := range keys {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			return value
		}
	}
	return ""
}

// UploadObject puts one file into R2 and returns its public URL.
func (c R2Config) UploadObject(ctx context.Context, path, objectKey, contentType string) (string, error) {
	if !c.configured() {
		return "", fmt.Errorf("R2 credentials are not configured")
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	if len(data) == 0 {
		return "", fmt.Errorf("%s is empty", path)
	}
	signed, err := c.presignPut(objectKey, 6*time.Hour)
	if err != nil {
		return "", err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPut, signed, bytes.NewReader(data))
	if err != nil {
		return "", err
	}
	request.ContentLength = int64(len(data))
	request.Header.Set("Content-Type", contentType)
	response, err := (&http.Client{Timeout: 10 * time.Minute}).Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(response.Body, 2048))
		return "", fmt.Errorf("R2 upload of %s returned %d: %s", objectKey, response.StatusCode, tailText(body, 400))
	}
	return fmt.Sprintf("https://%s/%s", c.PublicHost, objectKey), nil
}

// ObjectKey builds a namespaced key under the configured prefix.
func (c R2Config) ObjectKey(parts ...string) string {
	prefix := strings.Trim(c.PathPrefix, "/")
	segments := make([]string, 0, len(parts)+1)
	if prefix != "" {
		segments = append(segments, prefix)
	}
	for _, part := range parts {
		if trimmed := strings.Trim(part, "/"); trimmed != "" {
			segments = append(segments, trimmed)
		}
	}
	return strings.Join(segments, "/")
}

// presignPut builds an SigV4 query-string-signed PUT URL, matching the server's
// presignR2PutObject so both signers stay valid against the same bucket.
func (c R2Config) presignPut(objectKey string, expires time.Duration) (string, error) {
	host := fmt.Sprintf("%s.r2.cloudflarestorage.com", c.AccountID)
	const region = "auto"
	now := time.Now().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	scope := fmt.Sprintf("%s/%s/s3/aws4_request", dateStamp, region)
	canonicalURI := "/" + c.Bucket + "/" + escapeObjectPath(objectKey)
	params := url.Values{}
	params.Set("X-Amz-Algorithm", "AWS4-HMAC-SHA256")
	params.Set("X-Amz-Credential", c.AccessKey+"/"+scope)
	params.Set("X-Amz-Date", amzDate)
	params.Set("X-Amz-Expires", fmt.Sprintf("%d", int(expires.Seconds())))
	params.Set("X-Amz-SignedHeaders", "host")
	canonicalQuery := canonicalQueryString(params)
	canonicalRequest := strings.Join([]string{
		http.MethodPut, canonicalURI, canonicalQuery, "host:" + host + "\n", "host", "UNSIGNED-PAYLOAD",
	}, "\n")
	digest := sha256.Sum256([]byte(canonicalRequest))
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256", amzDate, scope, hex.EncodeToString(digest[:]),
	}, "\n")
	signature := hex.EncodeToString(hmacSHA256(c.signingKey(dateStamp, region), stringToSign))
	return fmt.Sprintf("https://%s%s?%s&X-Amz-Signature=%s", host, canonicalURI, canonicalQuery, signature), nil
}

func (c R2Config) signingKey(dateStamp, region string) []byte {
	date := hmacSHA256([]byte("AWS4"+c.SecretKey), dateStamp)
	regionKey := hmacSHA256(date, region)
	serviceKey := hmacSHA256(regionKey, "s3")
	return hmacSHA256(serviceKey, "aws4_request")
}

func hmacSHA256(key []byte, value string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(value))
	return mac.Sum(nil)
}

// escapeObjectPath applies the AWS path escaping rules (keep '/', escape the
// rest) the signer and the upload URL must agree on.
func escapeObjectPath(key string) string {
	parts := strings.Split(key, "/")
	for i, part := range parts {
		parts[i] = uriEscape(part)
	}
	return strings.Join(parts, "/")
}

func uriEscape(value string) string {
	var b strings.Builder
	for i := range len(value) {
		c := value[i]
		if (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') ||
			c == '-' || c == '_' || c == '.' || c == '~' {
			b.WriteByte(c)
			continue
		}
		fmt.Fprintf(&b, "%%%02X", c)
	}
	return b.String()
}

func canonicalQueryString(params url.Values) string {
	keys := make([]string, 0, len(params))
	for key := range params {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	pairs := make([]string, 0, len(keys))
	for _, key := range keys {
		pairs = append(pairs, uriEscape(key)+"="+uriEscape(params.Get(key)))
	}
	return strings.Join(pairs, "&")
}

// CoverObjectKey names a cover still for the H3 worker.
func CoverObjectKey(id, extension string) string {
	return fmt.Sprintf("lofi-loop/%s-cover%s", sanitizeID(id), extension)
}

// fileExtension returns a lower-case extension with its dot, or the fallback.
func fileExtension(path, fallback string) string {
	extension := strings.ToLower(filepath.Ext(path))
	if extension == "" {
		return fallback
	}
	return extension
}
