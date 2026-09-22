// Command makevideo renders one seamless looping lofi video from a song and a
// generated cover still:
//
//	makevideo --audio samples/folk.mp3 --out out --id folk \
//	  --character "wind-burnt bard in a wool cloak" --scene "empty moorland at dusk" \
//	  --preset embers --visualizer wave --verify --json
//
// It shares its engine with the manifoldgen.com lofi_loop service, so the CLI,
// the web tool, and this command all produce byte-comparable filtergraphs.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"manifoldgen-site/lofiloop"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "makevideo: "+err.Error())
		os.Exit(1)
	}
}

func run() error {
	flags := flag.NewFlagSet("makevideo", flag.ExitOnError)
	audioPath := flags.String("audio", "", "song to loop (mp3, flac, wav, opus)")
	id := flags.String("id", "", "output name (default: audio basename)")
	outDir := flags.String("out", ".", "output directory")
	coverPath := flags.String("still", "", "reuse an existing cover still instead of generating one")
	character := flags.String("character", "", "cover subject, e.g. 'hooded lantern keeper in a moss cloak'")
	scene := flags.String("scene", "", "environment, e.g. 'ashen grove at midnight, paper lanterns in fog'")
	style := flags.String("style", "", "art-direction style (defaults to the spec style)")
	prompt := flags.String("prompt", "", "used when no character or scene is given")
	negative := flags.String("negative", "", "negative prompt")
	preset := flags.String("preset", "", "look preset (drift, breathe, rain-window, embers, rooftop, vigil)")
	visualizer := flags.String("visualizer", "", "bars, wave, mirror, freqs, lissajous, cqt, or none")
	palette := flags.String("palette", "", "ember, neon, violet, moss, ash")
	motion := flags.String("motion", "", "drift, breathe, rain-window, embers, rooftop, vigil, static")
	size := flags.String("size", "", "WxH, multiples of 64 (default 1280x704)")
	fps := flags.Int("fps", 0, "frames per second (default 24)")
	loopStart := flags.Float64("loop-start", 0, "seconds into the track where the loop window starts")
	loopSeconds := flags.Float64("loop-seconds", 0, "loop length in seconds (0 = the whole track)")
	seam := flags.Float64("seam", -1, "seconds of seam crossfade (0 = hard loop)")
	vizAlpha := flags.Float64("viz-alpha", 0, "visualizer opacity 0..1")
	grain := flags.Float64("grain", 0, "static film grain 0..1 (default from the spec; negative disables)")
	crf := flags.Int("crf", -1, "x264 CRF (default 20; 0 = lossless)")
	bitrate := flags.String("audio-bitrate", "", "AAC bitrate (default 192k)")
	encoderPreset := flags.String("x264-preset", "", "x264 speed preset (default medium)")
	seed := flags.Int64("seed", 0, "cover art seed")
	steps := flags.Int("steps", 0, "cover diffusion steps")
	zimageURL := flags.String("zimage-url", envOr("ZIMAGE_URL", envOr("OMNISERVE_NATIVE_URL", "http://127.0.0.1:8791")), "image backend base URL")
	zimageSecret := flags.String("zimage-secret", os.Getenv("OMNISERVE_NATIVE_SECRET"), "image backend bearer secret")
	verify := flags.Bool("verify", false, "measure the loop seam of the finished file")
	timeout := flags.Duration("timeout", 30*time.Minute, "render timeout")
	asJSON := flags.Bool("json", false, "print one JSON object on stdout")
	listLooks := flags.Bool("list-looks", false, "print presets, visualizers, and palettes, then exit")
	if err := flags.Parse(os.Args[1:]); err != nil {
		return err
	}

	spec := lofiloop.DefaultSpec()
	if *listLooks {
		return printLooks(spec)
	}
	if *audioPath == "" {
		flags.Usage()
		return fmt.Errorf("--audio is required")
	}
	if *coverPath == "" && *character == "" && *scene == "" && *prompt == "" {
		return fmt.Errorf("give --character and/or --scene (or --prompt) to draw the cover")
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	result, err := lofiloop.Render(ctx, lofiloop.Request{
		ID: *id, AudioPath: *audioPath, CoverPath: *coverPath, OutDir: *outDir,
		Prompt: *prompt, Character: *character, Scene: *scene, Style: *style, Negative: *negative,
		Preset: *preset, Visualizer: *visualizer, Palette: *palette, Motion: *motion,
		Size: *size, FPS: *fps,
		LoopStart: *loopStart, LoopSeconds: *loopSeconds, SeamSeconds: *seam,
		VizAlpha: *vizAlpha, Grain: *grain, CRF: *crf, AudioBitrate: *bitrate, X264Preset: *encoderPreset,
		Seed: *seed, StillSteps: *steps,
		ZImageURL: *zimageURL, ZImageSecret: *zimageSecret,
		Spec: spec, Verify: *verify, Timeout: *timeout,
	})
	if err != nil {
		return err
	}
	metadataPath, err := lofiloop.WriteMetadata(result, *outDir)
	if err != nil {
		return err
	}
	if *asJSON {
		payload, err := json.Marshal(result)
		if err != nil {
			return err
		}
		fmt.Println(string(payload))
		return nil
	}
	fmt.Printf("%s: %.2fs · %d frames @ %d fps · motion %s · %s over %s\n",
		result.ID, result.Seconds, result.Frames, result.FPS, result.Motion, result.Visualizer, result.Preset)
	fmt.Printf("  video  %s\n  cover  %s\n  meta   %s\n", result.Video, result.Cover, metadataPath)
	if result.Loop != nil {
		fmt.Printf("  loop   first/last frame: mean %.3f, max %d, exact %t\n",
			result.Loop.MeanAbsDiff, result.Loop.MaxAbsDiff, result.Loop.Exact)
	}
	return nil
}

func printLooks(spec *lofiloop.Spec) error {
	payload, err := json.MarshalIndent(spec, "", " ")
	if err != nil {
		return err
	}
	fmt.Println(string(payload))
	return nil
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
