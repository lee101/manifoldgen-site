package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"strings"

	"manifoldgen-site/lofiloop"
)

func main() {
	clip := flag.String("clip", "", "looping source clip")
	audio := flag.String("audio", "", "soundtrack")
	out := flag.String("out", "", "output mp4")
	concat := flag.String("concat", "", "comma separated mp4s to join")
	seconds := flag.Float64("seconds", 0, "length cap")
	fade := flag.Float64("fade", 0, "audio fade-out seconds")
	width := flag.Int("width", 1280, "width")
	height := flag.Int("height", 720, "height")
	flag.Parse()
	ctx := context.Background()
	if *concat != "" {
		if err := lofiloop.ConcatVideos(ctx, strings.Split(*concat, ","), *out); err != nil {
			fmt.Fprintln(os.Stderr, "lowficlip: "+err.Error())
			os.Exit(1)
		}
		return
	}
	res, err := lofiloop.TileClip(ctx, lofiloop.ClipRequest{Clip: *clip, Audio: *audio, Out: *out, Seconds: *seconds, Width: *width, Height: *height, FadeOut: *fade})
	if err != nil {
		fmt.Fprintln(os.Stderr, "lowficlip: "+err.Error())
		os.Exit(1)
	}
	fmt.Printf("%s %.1fs x%d\n", res.Path, res.Seconds, res.Repeats)
}
