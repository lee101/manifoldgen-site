package main

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"encoding/xml"
	"math"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

func TestProdkitXCorrOffset(t *testing.T) {
	rng := rand.New(rand.NewSource(7))
	base := make([]float64, 4000)
	for i := range base {
		if rng.Float64() < 0.03 {
			base[i] = 1 + rng.Float64()
		}
	}
	noisy := func(src []float64) []float64 {
		out := make([]float64, len(src))
		for i, v := range src {
			out[i] = v + 0.1*rng.NormFloat64()
		}
		return out
	}
	ref := base[500:3500]
	cases := []struct {
		sig  []float64
		want float64
	}{
		{noisy(base[737:2237]), 237},
		{noisy(base[350:1850]), -150},
		{noisy(base[500:3500]), 0},
	}
	for _, tc := range cases {
		lag, conf := prodkitXCorrOffset(prodkitOnsetNormalize(ref), prodkitOnsetNormalize(tc.sig), 600)
		if math.Abs(lag-tc.want) > 0.6 || conf < 0.3 {
			t.Errorf("lag=%.2f conf=%.2f want %.0f", lag, conf, tc.want)
		}
	}
	if lag, _ := prodkitXCorrOffset(ref, noisy(base[1800:2600]), 100); math.Abs(lag-1300) < 1 {
		t.Fatalf("search window not enforced: lag=%.1f", lag)
	}
	if _, conf := prodkitXCorrOffset(ref, make([]float64, 100), 50); conf != 0 {
		t.Fatalf("silent signal confidence = %.2f", conf)
	}
}

func TestNormalizeProdkitPostValidation(t *testing.T) {
	many := make([]string, 25)
	for i := range many {
		many[i] = `"https://x.test/c.mp4"`
	}
	cases := []struct {
		name string
		req  ServiceUsageRequest
		want string
	}{
		{"no clips", ServiceUsageRequest{Service: prodkitFootageSorter}, "params.clips"},
		{"too many", ServiceUsageRequest{Service: prodkitFootageSorter, Params: json.RawMessage(`{"clips":[` + strings.Join(many, ",") + `]}`)}, "at most 24"},
		{"private clip", ServiceUsageRequest{Service: prodkitFootageSorter, Params: json.RawMessage(`{"clips":["http://10.0.0.1/a.mp4"]}`)}, "public"},
		{"non-string clip", ServiceUsageRequest{Service: prodkitFootageSorter, Params: json.RawMessage(`{"clips":[3]}`)}, "must be a URL"},
		{"ref range", ServiceUsageRequest{Service: prodkitFootageSorter, Params: json.RawMessage(`{"clips":["https://x.test/a.mp4"],"reference_audio":2}`)}, "reference_audio"},
		{"sync type", ServiceUsageRequest{Service: prodkitFootageSorter, Params: json.RawMessage(`{"clips":["https://x.test/a.mp4"],"sync":"yes"}`)}, "boolean"},
		{"unknown param", ServiceUsageRequest{Service: prodkitFootageSorter, Params: json.RawMessage(`{"clips":["https://x.test/a.mp4"],"cmd":"x"}`)}, "unknown footage-sorter param"},
		{"composer no video", ServiceUsageRequest{Service: prodkitShotComposer, ImageURL: "https://x.test/b.png"}, "video_url"},
		{"composer no bg", ServiceUsageRequest{Service: prodkitShotComposer, VideoURL: "https://x.test/a.mp4"}, "background"},
		{"composer bad bg video", ServiceUsageRequest{Service: prodkitShotComposer, VideoURL: "https://x.test/a.mp4", Params: json.RawMessage(`{"background_video_url":"https://localhost/b.mp4"}`)}, "public"},
		{"composer key", ServiceUsageRequest{Service: prodkitShotComposer, VideoURL: "https://x.test/a.mp4", Prompt: "beach", Params: json.RawMessage(`{"key":"luma"}`)}, "params.key"},
		{"composer key color", ServiceUsageRequest{Service: prodkitShotComposer, VideoURL: "https://x.test/a.mp4", Prompt: "beach", Params: json.RawMessage(`{"key":"chroma","key_color":"red;rm"}`)}, "key_color"},
		{"composer position", ServiceUsageRequest{Service: prodkitShotComposer, VideoURL: "https://x.test/a.mp4", Prompt: "beach", Params: json.RawMessage(`{"position":"top"}`)}, "position"},
		{"composer scale type", ServiceUsageRequest{Service: prodkitShotComposer, VideoURL: "https://x.test/a.mp4", Prompt: "beach", Params: json.RawMessage(`{"scale":"big"}`)}, "number"},
	}
	for _, tc := range cases {
		err := normalizeProdkitRequest(&tc.req)
		if err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Errorf("%s: err = %v, want %q", tc.name, err, tc.want)
		}
	}
	ok := ServiceUsageRequest{Service: prodkitShotComposer, VideoURL: "https://x.test/a.mp4", Prompt: "neon alley", Params: json.RawMessage(`{"key":"chroma","key_color":"#00b140","scale":0.7}`)}
	if err := normalizeProdkitRequest(&ok); err != nil || ok.Duration != 30 {
		t.Fatalf("composer err=%v duration=%d", err, ok.Duration)
	}
	footage := ServiceUsageRequest{Service: prodkitFootageSorter, Params: json.RawMessage(`{"clips":["https://x.test/a.mp4","https://x.test/b.wav"],"reference_audio":1,"fps":25}`)}
	if err := normalizeProdkitRequest(&footage); err != nil {
		t.Fatal(err)
	}
}

func TestProdkitPostPricing(t *testing.T) {
	t.Setenv("VIDEO_BACKGROUND_REMOVAL_RATE_USD_PER_SECOND", "")
	rate := videoBackgroundPublicRateUSD()
	cases := []struct {
		req  ServiceUsageRequest
		want float64
	}{
		{ServiceUsageRequest{Service: prodkitFootageSorter, Params: json.RawMessage(`{"clips":["a","b","c"]}`)}, 0.11},
		{ServiceUsageRequest{Service: prodkitFootageSorter, Params: json.RawMessage(`{"clips":[]}`)}, 0.05},
		{ServiceUsageRequest{Service: prodkitShotComposer, VideoURL: "v", ImageURL: "i", Duration: 10, Params: json.RawMessage(`{"key":"chroma"}`)}, 0.20},
		{ServiceUsageRequest{Service: prodkitShotComposer, VideoURL: "v", ImageURL: "i", Duration: 10}, 0.10 + rate*10},
		{ServiceUsageRequest{Service: prodkitShotComposer, VideoURL: "v", Prompt: "beach", Duration: 99, Params: json.RawMessage(`{"key":"chroma"}`)}, 0.10 + 0.30 + 0.04},
	}
	for _, tc := range cases {
		if got := getRequestServicePriceUSD(tc.req); math.Abs(got-tc.want) > 1e-6 {
			t.Errorf("%s %s: price = %.4f, want %.4f", tc.req.Service, tc.req.Params, got, tc.want)
		}
	}
	chroma := ServiceUsageRequest{Service: prodkitShotComposer, Params: json.RawMessage(`{"key":"chroma"}`)}
	if got := prodkitComposerPriceUSD(chroma, 4.2); math.Abs(got-0.15) > 1e-9 {
		t.Fatalf("chroma 4.2 s = %.4f", got)
	}
	if prodkitUsesPaidProvider(chroma) || !prodkitUsesPaidProvider(ServiceUsageRequest{Service: prodkitShotComposer}) {
		t.Fatal("restart guard misclassifies composer paths")
	}
	if rate*30+0.10 < falVideoBackgroundRateUSD*30*1.3 {
		t.Fatal("AI matte composite margin too thin")
	}
}

func prodkitTestClips() []*prodkitClip {
	return []*prodkitClip{
		{Index: 0, Name: "01 A&B <cam>", URL: "https://x.test/a.mp4?x=1&y=2", Kind: "video", Duration: 12, FPS: 29.97, Width: 1920, Height: 1080, HasAudio: true, Channels: 2, Role: "a-roll", Synced: true, Reference: true, Start: 1.2, Lane: 0, Bins: []string{"A-roll"}, Caption: "person talking"},
		{Index: 1, Name: "02 broll", URL: "https://x.test/b.mov", Kind: "video", Duration: 6, FPS: 29.97, Width: 1280, Height: 720, HasAudio: true, Role: "b-roll", Synced: true, Offset: 2.5, Confidence: 0.8, Start: 3.7, Lane: 1, Bins: []string{"B-roll"}},
		{Index: 2, Name: "03 rec", URL: "https://x.test/c.wav", Kind: "audio", Duration: 20, HasAudio: true, Role: "audio", Synced: true, Offset: -1.2, Start: 0, Lane: -1, Bins: []string{"Audio"}},
		{Index: 3, Name: "04 late", URL: "https://x.test/d.mp4", Kind: "video", Duration: 4, FPS: 25, Width: 1920, Height: 1080, Role: "b-roll", Start: 20, Lane: 0, Bins: []string{"B-roll"}},
	}
}

func TestProdkitTimelineFormats(t *testing.T) {
	clips := prodkitTestClips()
	bins := prodkitBuildBins([]*prodkitClip{{Index: 0, Role: "a-roll", Kind: "video", Caption: "kitchen interview"}})
	tl := prodkitTimeline{Num: 1001, Den: 30000, Width: 1920, Height: 1080, Name: "Test & <cut>"}
	body, err := buildProdkitFCPXML(clips, bins, tl)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(string(body), `<?xml version="1.0" encoding="UTF-8"?>`) || !strings.Contains(string(body), "<!DOCTYPE fcpxml>") {
		t.Fatalf("header: %.120s", body)
	}
	var parsed fcpXML
	if err := xml.Unmarshal(body, &parsed); err != nil {
		t.Fatal(err)
	}
	if parsed.Version != "1.10" || len(parsed.Resources.Assets) != 4 || parsed.Resources.Assets[0].MediaRep.Src != clips[0].URL {
		t.Fatalf("parsed = %+v", parsed.Resources)
	}
	gap := parsed.Library.Events[0].Projects[0].Sequence.Spine.Gaps[0]
	lanes := map[string]string{}
	for _, clip := range gap.Clips {
		lanes[clip.Ref] = clip.Lane + "@" + clip.Offset
	}
	if lanes["a1"] != "1@36036/30000s" || lanes["a2"] != "2@111111/30000s" || lanes["a3"] != "-1@0s" {
		t.Fatalf("lanes = %v", lanes)
	}
	if parsed.Resources.Assets[2].HasVideo != "" || parsed.Resources.Assets[2].HasAudio != "1" || parsed.Resources.Assets[3].Format == parsed.Resources.Assets[0].Format {
		t.Fatalf("assets = %+v", parsed.Resources.Assets)
	}
	for _, clip := range gap.Clips {
		num, _, _ := strings.Cut(strings.TrimSuffix(clip.Offset, "s"), "/")
		if n, _ := strconv.Atoi(num); clip.Offset != "0s" && n%1001 != 0 {
			t.Fatalf("offset %s not frame aligned", clip.Offset)
		}
	}
	otio, err := buildProdkitOTIO(clips, bins, tl)
	if err != nil {
		t.Fatal(err)
	}
	var timeline struct {
		Schema string `json:"OTIO_SCHEMA"`
		Tracks struct {
			Children []struct {
				Kind     string                   `json:"kind"`
				Children []map[string]interface{} `json:"children"`
			} `json:"children"`
		} `json:"tracks"`
	}
	if err := json.Unmarshal(otio, &timeline); err != nil || timeline.Schema != "Timeline.1" {
		t.Fatalf("otio err=%v schema=%s", err, timeline.Schema)
	}
	if len(timeline.Tracks.Children) != 3 || timeline.Tracks.Children[2].Kind != "Audio" {
		t.Fatalf("tracks = %+v", timeline.Tracks.Children)
	}
	v1 := timeline.Tracks.Children[0].Children
	if len(v1) != 4 || v1[0]["OTIO_SCHEMA"] != "Gap.1" || v1[1]["OTIO_SCHEMA"] != "Clip.2" || v1[2]["OTIO_SCHEMA"] != "Gap.1" {
		t.Fatalf("V1 = %v", v1)
	}
	studio, err := buildProdkitFootageStudio(clips, bins, tl)
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		Version int                      `json:"version"`
		Assets  []map[string]interface{} `json:"assets"`
	}
	if err := json.Unmarshal(studio, &doc); err != nil || doc.Version != 5 || len(doc.Assets) != 4 {
		t.Fatalf("studio err=%v doc=%s", err, studio)
	}
	if doc.Assets[1]["volume"] != 0.0 || doc.Assets[0]["volume"] != 1.0 || doc.Assets[2]["kind"] != "audio" || doc.Assets[1]["timelineStart"] != 3.7 {
		t.Fatalf("studio assets = %v", doc.Assets)
	}
}

func TestProdkitShotAndBins(t *testing.T) {
	for caption, want := range map[string]string{"A close-up of hands kneading dough": "close", "Aerial drone view over a coastline": "wide", "Medium shot of a woman at a desk": "medium", "A dog runs": "unknown"} {
		if got := prodkitShotType(caption); got != want {
			t.Errorf("%q = %s, want %s", caption, got, want)
		}
	}
	clips := []*prodkitClip{
		{Index: 0, Kind: "video", Role: "b-roll", Caption: "Wide shot of a busy kitchen with chefs cooking", Scene: "restaurant kitchen", Width: 1920, Height: 1080, FPS: 25},
		{Index: 1, Kind: "video", Role: "a-roll", Caption: "Chef talking to camera in the kitchen", Scene: "restaurant kitchen", Camera: "Sony A7S", Width: 1920, Height: 1080, FPS: 25},
		{Index: 2, Kind: "video", Role: "b-roll", Caption: "Aerial view of a mountain lake", Scene: "mountain lake", Width: 3840, Height: 2160, FPS: 30},
	}
	bins := prodkitBuildBins(clips)
	scenes := 0
	for _, bin := range bins {
		if bin.Type == "scene" {
			scenes++
			if strings.Contains(bin.Name, "kitchen") && len(bin.Clips) != 2 {
				t.Errorf("kitchen bin = %+v", bin)
			}
		}
	}
	if scenes != 2 || len(clips[1].Bins) != 3 || clips[1].Bins[1] != "Camera: Sony A7S" {
		t.Fatalf("bins = %+v clip1=%v", bins, clips[1].Bins)
	}
}

func prodkitTestFFmpeg(t *testing.T) string {
	ffmpeg, err := exec.LookPath("/usr/bin/ffmpeg")
	if err != nil {
		t.Skip("ffmpeg not installed")
	}
	if _, err := exec.LookPath("/usr/bin/ffprobe"); err != nil {
		t.Skip("ffprobe not installed")
	}
	t.Setenv("FFMPEG_BIN", ffmpeg)
	t.Setenv("FFPROBE_BIN", "/usr/bin/ffprobe")
	return ffmpeg
}

func writeProdkitTestWAV(t *testing.T, path string, samples []float64, rate int) {
	data := make([]byte, 44+2*len(samples))
	copy(data, "RIFF")
	binary.LittleEndian.PutUint32(data[4:], uint32(36+2*len(samples)))
	copy(data[8:], "WAVEfmt ")
	binary.LittleEndian.PutUint32(data[16:], 16)
	binary.LittleEndian.PutUint16(data[20:], 1)
	binary.LittleEndian.PutUint16(data[22:], 1)
	binary.LittleEndian.PutUint32(data[24:], uint32(rate))
	binary.LittleEndian.PutUint32(data[28:], uint32(rate*2))
	binary.LittleEndian.PutUint16(data[32:], 2)
	binary.LittleEndian.PutUint16(data[34:], 16)
	copy(data[36:], "data")
	binary.LittleEndian.PutUint32(data[40:], uint32(2*len(samples)))
	for i, v := range samples {
		binary.LittleEndian.PutUint16(data[44+2*i:], uint16(int16(math.Max(-1, math.Min(1, v))*32000)))
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatal(err)
	}
}

type prodkitTestStubs struct {
	sources  map[string]string
	uploaded map[string]string
}

func stubProdkitIO(t *testing.T, dir string) *prodkitTestStubs {
	stubs := &prodkitTestStubs{sources: map[string]string{}, uploaded: map[string]string{}}
	oldFetch, oldUpload, oldCaption, oldSave := prodkitFetchMedia, uploadProdkitFile, prodkitCaptionClip, prodkitSaveStudioProject
	t.Cleanup(func() {
		prodkitFetchMedia, uploadProdkitFile, prodkitCaptionClip, prodkitSaveStudioProject = oldFetch, oldUpload, oldCaption, oldSave
	})
	prodkitFetchMedia = func(_ context.Context, raw, dest string, limit int64) error {
		blob, err := os.ReadFile(stubs.sources[raw])
		if err != nil {
			return err
		}
		return os.WriteFile(dest, blob, 0o644)
	}
	outDir := filepath.Join(dir, "uploads")
	_ = os.MkdirAll(outDir, 0o755)
	n := 0
	uploadProdkitFile = func(_ context.Context, path, _, _ string) (string, error) {
		n++
		blob, err := os.ReadFile(path)
		if err != nil {
			return "", err
		}
		local := filepath.Join(outDir, strconv.Itoa(n)+"_"+filepath.Base(path))
		if err := os.WriteFile(local, blob, 0o644); err != nil {
			return "", err
		}
		publicURL := "https://cdn.test/" + filepath.Base(local)
		stubs.uploaded[publicURL] = local
		return publicURL, nil
	}
	prodkitSaveStudioProject = func(string, string, []byte) string { return "" }
	return stubs
}

func TestProdkitFootageSorterIntegration(t *testing.T) {
	ffmpeg := prodkitTestFFmpeg(t)
	dir := t.TempDir()
	stubs := stubProdkitIO(t, dir)
	prodkitCaptionClip = func(_ context.Context, frames []string) (prodkitCaption, error) {
		if strings.Contains(filepath.Base(frames[0]), "frame01") {
			return prodkitCaption{Caption: "Close-up of a host talking to camera in a studio", Scene: "tv studio", Talking: true}, nil
		}
		return prodkitCaption{Caption: "Wide shot of a test pattern on a monitor", Scene: "control room"}, nil
	}
	beeps := []float64{-0.7, 0.8, 1.9, 2.6, 4.4, 5.1, 6.9, 7.4, 9.3, 10.6, 11.2}
	const rate = 48000
	render := func(start, length float64, seed int64) []float64 {
		rng := rand.New(rand.NewSource(seed))
		out := make([]float64, int(length*rate))
		for i := range out {
			tRef := start + float64(i)/rate
			out[i] = 0.01 * rng.NormFloat64()
			for j, at := range beeps {
				if d := tRef - at; d >= 0 && d < 0.12 {
					out[i] += 0.6 * math.Sin(2*math.Pi*float64(500+97*j)*d) * math.Exp(-d*20)
				}
			}
		}
		return out
	}
	specs := []struct {
		name, src     string
		start, length float64
		video         bool
	}{
		{"ref.mp4", "testsrc", 0, 12, true},
		{"cam_b.mp4", "testsrc2", 2.5, 6, true},
		{"cam_c.mp4", "smptebars", -1.2, 8, true},
		{"recorder.wav", "", 4.0, 5, false},
	}
	clips := []string{}
	for i, spec := range specs {
		wav := filepath.Join(dir, strconv.Itoa(i)+".wav")
		writeProdkitTestWAV(t, wav, render(spec.start, spec.length, int64(i+1)), rate)
		path := wav
		if spec.video {
			path = filepath.Join(dir, spec.name)
			args := []string{"-v", "error", "-y", "-f", "lavfi", "-i", spec.src + "=size=320x240:rate=30", "-i", wav, "-t", strconv.FormatFloat(spec.length, 'f', 3, 64),
				"-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-shortest", path}
			if out, err := exec.Command(ffmpeg, args...).CombinedOutput(); err != nil {
				t.Fatalf("ffmpeg: %v %s", err, out)
			}
		}
		publicURL := "https://media.test/" + spec.name
		stubs.sources[publicURL] = path
		clips = append(clips, publicURL)
	}
	params, _ := json.Marshal(map[string]interface{}{"clips": clips})
	req := ServiceUsageRequest{Service: prodkitFootageSorter, Params: params}
	if err := normalizeProdkitRequest(&req); err != nil {
		t.Fatal(err)
	}
	work := filepath.Join(dir, "work")
	_ = os.MkdirAll(work, 0o755)
	result, providerUSD, err := runProdkitFootageSorter(context.Background(), &VideoJob{ID: "job", UserID: "user"}, req, work, func(string) {})
	if err != nil {
		t.Fatal(err)
	}
	if providerUSD <= 0 {
		t.Fatalf("provider cost = %v", providerUSD)
	}
	for _, key := range []string{"otio_url", "fcpxml_url", "studio_project_url", "contact_sheet_url", "report_url"} {
		if stubs.uploaded[result[key].(string)] == "" {
			t.Fatalf("%s missing: %v", key, result)
		}
	}
	summary := result["report"].(map[string]interface{})
	if summary["synced"] != 4 || summary["reference_clip"] != "01 ref" || summary["timeline_fps"] != 30.0 {
		t.Fatalf("summary = %v", summary)
	}
	frame := 1.0 / 30
	for _, offset := range summary["offsets"].([]map[string]interface{}) {
		want := specs[offset["clip"].(int)].start
		if got := offset["offset_seconds"].(float64); math.Abs(got-want) > frame {
			t.Errorf("clip %v offset %.3f want %.3f (conf %.2f)", offset["clip"], got, want, offset["confidence"])
		}
	}
	reportBlob, _ := os.ReadFile(stubs.uploaded[result["report_url"].(string)])
	var report struct {
		Clips []prodkitClip `json:"clips"`
		Bins  []prodkitBin  `json:"bins"`
	}
	if err := json.Unmarshal(reportBlob, &report); err != nil || len(report.Clips) != 4 {
		t.Fatalf("report err=%v %s", err, reportBlob)
	}
	if report.Clips[1].Shot != "close" || report.Clips[0].Shot != "wide" || report.Clips[3].Role != "audio" || report.Clips[3].Kind != "audio" {
		t.Fatalf("classification = %+v", report.Clips)
	}
	if report.Clips[2].Start != 0 || math.Abs(report.Clips[0].Start-1.2) > frame {
		t.Fatalf("layout starts = %v %v", report.Clips[2].Start, report.Clips[0].Start)
	}
	fcpBlob, _ := os.ReadFile(stubs.uploaded[result["fcpxml_url"].(string)])
	var fcp fcpXML
	if err := xml.Unmarshal(fcpBlob, &fcp); err != nil || len(fcp.Library.Events[0].Projects[0].Sequence.Spine.Gaps[0].Clips) != 4 {
		t.Fatalf("fcpxml err=%v", err)
	}
	var otio map[string]interface{}
	otioBlob, _ := os.ReadFile(stubs.uploaded[result["otio_url"].(string)])
	if err := json.Unmarshal(otioBlob, &otio); err != nil || otio["OTIO_SCHEMA"] != "Timeline.1" {
		t.Fatalf("otio err=%v", err)
	}
	sheet, err := prodkitProbeMedia(context.Background(), stubs.uploaded[result["contact_sheet_url"].(string)])
	if err != nil || sheet.Width < 3*prodkitSheetW || sheet.Height < 4*prodkitSheetH {
		t.Fatalf("contact sheet %+v err=%v", sheet, err)
	}
}

func TestProdkitShotComposerChroma(t *testing.T) {
	ffmpeg := prodkitTestFFmpeg(t)
	dir := t.TempDir()
	stubs := stubProdkitIO(t, dir)
	fg := filepath.Join(dir, "fg.mp4")
	bg := filepath.Join(dir, "bg.png")
	for _, args := range [][]string{
		{"-f", "lavfi", "-i", "color=c=0x00FF00:s=320x240:r=25:d=2,drawbox=x=100:y=60:w=120:h=120:color=red@1:t=fill", "-f", "lavfi", "-i", "sine=f=440:d=2",
			"-c:v", "libx264", "-preset", "ultrafast", "-crf", "8", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", fg},
		{"-f", "lavfi", "-i", "color=c=0x3a4a90:s=640x360,noise=alls=25:allf=u", "-frames:v", "1", bg},
	} {
		if out, err := exec.Command(ffmpeg, append([]string{"-v", "error", "-y"}, args...)...).CombinedOutput(); err != nil {
			t.Fatalf("ffmpeg: %v %s", err, out)
		}
	}
	stubs.sources["https://media.test/fg.mp4"] = fg
	stubs.sources["https://media.test/bg.png"] = bg
	req := ServiceUsageRequest{Service: prodkitShotComposer, VideoURL: "https://media.test/fg.mp4", ImageURL: "https://media.test/bg.png",
		Params: json.RawMessage(`{"key":"chroma","position":"left","scale":0.8,"shadow":true,"light_wrap":0.5,"grain":0.3}`)}
	if err := normalizeProdkitRequest(&req); err != nil {
		t.Fatal(err)
	}
	work := filepath.Join(dir, "work")
	_ = os.MkdirAll(work, 0o755)
	result, seconds, providerUSD, err := runProdkitShotComposer(context.Background(), &VideoJob{ID: "job", UserID: "user"}, req, work, func(string) {})
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(seconds-2) > 0.1 || providerUSD <= 0 || providerUSD > 0.01 {
		t.Fatalf("seconds=%v provider=%v", seconds, providerUSD)
	}
	for _, key := range []string{"video_url", "fg_alpha_url", "studio_project_url", "lut_url", "audio_url"} {
		if stubs.uploaded[result[key].(string)] == "" {
			t.Fatalf("%s missing: %v", key, result)
		}
	}
	composite := stubs.uploaded[result["video_url"].(string)]
	info, err := prodkitProbeMedia(context.Background(), composite)
	if err != nil || info.Width != 640 || info.Height != 360 || math.Abs(info.Duration-2) > 0.15 || !info.HasAudio {
		t.Fatalf("composite %+v err=%v", info, err)
	}
	frame, err := exec.Command(ffmpeg, "-v", "error", "-ss", "1", "-i", composite, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-").Output()
	if err != nil || len(frame) != 640*360*3 {
		t.Fatalf("decode composite: %v %d", err, len(frame))
	}
	green, red := 0, 0
	for i := 0; i+2 < len(frame); i += 3 {
		r, g, b := int(frame[i]), int(frame[i+1]), int(frame[i+2])
		if g > 180 && r < 90 && b < 90 {
			green++
		}
		if r > 120 && r > g+40 && r > b+40 {
			red++
		}
	}
	if green > 640*360/200 || red < 3000 {
		t.Fatalf("green=%d red=%d", green, red)
	}
	alpha, err := exec.Command(ffmpeg, "-v", "error", "-c:v", "libvpx-vp9", "-i", stubs.uploaded[result["fg_alpha_url"].(string)], "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgba", "-").Output()
	if err != nil || len(alpha) != 320*240*4 {
		t.Fatalf("decode alpha: %v %d", err, len(alpha))
	}
	at := func(x, y int) byte { return alpha[(y*320+x)*4+3] }
	if at(10, 10) > 20 || at(160, 120) < 230 {
		t.Fatalf("alpha corner=%d center=%d", at(10, 10), at(160, 120))
	}
	var doc struct {
		Assets []map[string]interface{} `json:"assets"`
		Canvas map[string]int           `json:"canvas"`
	}
	blob, _ := os.ReadFile(stubs.uploaded[result["studio_project_url"].(string)])
	if err := json.Unmarshal(blob, &doc); err != nil || len(doc.Assets) != 3 || doc.Assets[1]["visualTrack"] != 1.0 || doc.Canvas["width"] != 640 {
		t.Fatalf("studio err=%v doc=%s", err, blob)
	}
	if doc.Assets[1]["stageX"].(float64) >= 0 {
		t.Fatalf("left placement stageX = %v", doc.Assets[1]["stageX"])
	}
}

func TestProdkitComposeFilterShape(t *testing.T) {
	filter := prodkitComposeFilter(prodkitComposeOpts{W: 1280, H: 720, FW: 640, FH: 360, X: -20, Y: 360, FPS: "30", Seconds: 3, LUT: "/tmp/a b/match.cube", LightWrap: 0.4, Grain: 0.2, Shadow: true, GradedOut: true})
	for _, want := range []string{"split=2[bg0][bg1]", "lut3d=file='/tmp/a b/match.cube'", "split=3[fgc0][fgc1][fgc2]", "overlay=-20:360", "[fga]", "alphamerge", "noise=alls=6", "[v]"} {
		if !strings.Contains(filter, want) {
			t.Errorf("filter missing %q: %s", want, filter)
		}
	}
	plain := prodkitComposeFilter(prodkitComposeOpts{W: 640, H: 360, FW: 320, FH: 180, FPS: "25", Seconds: 2})
	if strings.Contains(plain, "split=2") || strings.Contains(plain, "lut3d") || strings.Contains(plain, "noise") {
		t.Fatalf("plain filter = %s", plain)
	}
	if lut := prodkitMatchLUT(prodkitColorStats{Mean: [3]float64{50, 0, 0}, Std: [3]float64{20, 10, 10}}, prodkitColorStats{Mean: [3]float64{50, 0, 0}, Std: [3]float64{20, 10, 10}}, 5); !strings.Contains(string(lut), "LUT_3D_SIZE 5") || strings.Count(string(lut), "\n") != 127 {
		t.Fatalf("lut lines = %d", strings.Count(string(lut), "\n"))
	}
	for _, rgb := range [][3]float64{{0.2, 0.5, 0.8}, {1, 1, 1}, {0, 0, 0}} {
		back := prodkitRGB(prodkitLab(rgb[0], rgb[1], rgb[2]))
		for c := range rgb {
			if math.Abs(back[c]-rgb[c]) > 0.01 {
				t.Fatalf("lab roundtrip %v -> %v", rgb, back)
			}
		}
	}
}
