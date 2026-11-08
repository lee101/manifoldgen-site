package main

// Cut to the music: a Go port of conjurerssoul2/tools/audiokp `plan`. Spectral-flux onset envelope, autocorrelation
// tempo with a ~90 bpm prior, Ellis DP beat tracking, then a DP that picks n cut points on strong beats/onsets with
// every segment inside the H3 window.

import (
	"context"
	"encoding/binary"
	"fmt"
	"math"
	"math/cmplx"
	"os/exec"
	"sort"
)

const (
	trailerBeatSR   = 22050
	trailerBeatNFFT = 2048
	trailerBeatHop  = 512
)

var trailerBeatFPS = float64(trailerBeatSR) / trailerBeatHop

// trailerFrameTime is the centre of analysis frame f (frames are not padded, so the window start runs early).
func trailerFrameTime(f int) float64 {
	return (float64(f*trailerBeatHop) + trailerBeatNFFT/2) / trailerBeatSR
}

type trailerHit struct {
	Frame    int
	Strength float64
}

func decodeTrailerPCM(ctx context.Context, path string) ([]float64, error) {
	out, err := exec.CommandContext(ctx, "ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", fmt.Sprint(trailerBeatSR), "-f", "f32le", "-").Output()
	if err != nil {
		return nil, fmt.Errorf("decode score: %w", err)
	}
	y := make([]float64, len(out)/4)
	for i := range y {
		y[i] = float64(math.Float32frombits(binary.LittleEndian.Uint32(out[i*4:])))
	}
	return y, nil
}

func trailerFFT(x []complex128) {
	n := len(x)
	for i, j := 1, 0; i < n; i++ {
		bit := n >> 1
		for ; j&bit != 0; bit >>= 1 {
			j ^= bit
		}
		j ^= bit
		if i < j {
			x[i], x[j] = x[j], x[i]
		}
	}
	for size := 2; size <= n; size <<= 1 {
		step := cmplx.Exp(complex(0, -2*math.Pi/float64(size)))
		for start := 0; start < n; start += size {
			w := complex(1, 0)
			for k := 0; k < size/2; k++ {
				a, b := x[start+k], x[start+k+size/2]*w
				x[start+k], x[start+k+size/2] = a+b, a-b
				w *= step
			}
		}
	}
}

func trailerOnsetEnvelope(y []float64) []float64 {
	if len(y) < trailerBeatNFFT {
		return nil
	}
	frames := (len(y)-trailerBeatNFFT)/trailerBeatHop + 1
	win := make([]float64, trailerBeatNFFT)
	for i := range win {
		win[i] = 0.5 - 0.5*math.Cos(2*math.Pi*float64(i)/trailerBeatNFFT)
	}
	bins := trailerBeatNFFT/2 + 1
	buf := make([]complex128, trailerBeatNFFT)
	prev, cur := make([]float64, bins), make([]float64, bins)
	flux := make([]float64, frames)
	for f := 0; f < frames; f++ {
		s := f * trailerBeatHop
		for i := range buf {
			buf[i] = complex(y[s+i]*win[i], 0)
		}
		trailerFFT(buf)
		var sum float64
		for k := 0; k < bins; k++ {
			cur[k] = math.Log1p(10 * cmplx.Abs(buf[k]))
			if f > 0 && cur[k] > prev[k] {
				sum += cur[k] - prev[k]
			}
		}
		flux[f] = sum
		prev, cur = cur, prev
	}
	return trailerSmooth(flux, 1)
}

func trailerSmooth(x []float64, w int) []float64 {
	pre := make([]float64, len(x)+1)
	for i, v := range x {
		pre[i+1] = pre[i] + v
	}
	out := make([]float64, len(x))
	for i := range x {
		a, b := max(0, i-w), min(len(x), i+w+1)
		out[i] = (pre[b] - pre[a]) / float64(b-a)
	}
	return out
}

func trailerEnvMax(env []float64) float64 {
	mx := 1e-9
	for _, v := range env {
		mx = math.Max(mx, v)
	}
	return mx
}

func trailerPeaks(env []float64, gap int, delta float64) []trailerHit {
	mx := trailerEnvMax(env)
	loc := trailerSmooth(env, 20)
	var out []trailerHit
	for i := 1; i < len(env)-1; i++ {
		if !(env[i] > env[i-1] && env[i] >= env[i+1] && env[i] > loc[i]+delta*mx) {
			continue
		}
		if n := len(out); n > 0 && i-out[n-1].Frame < gap {
			if env[i]/mx > out[n-1].Strength {
				out[n-1] = trailerHit{i, env[i] / mx}
			}
			continue
		}
		out = append(out, trailerHit{i, env[i] / mx})
	}
	return out
}

func trailerTempo(env []float64) float64 {
	if len(env) == 0 {
		return 90
	}
	var mean float64
	for _, v := range env {
		mean += v
	}
	mean /= float64(len(env))
	e := make([]float64, len(env))
	for i, v := range env {
		e[i] = v - mean
	}
	lo, hi := int(trailerBeatFPS*60/180), int(trailerBeatFPS*60/50)
	best, bestLag := math.Inf(-1), max(lo, 1)
	for lag := max(lo, 1); lag < min(hi, len(e)/2); lag++ {
		var s float64
		for i := 0; i+lag < len(e); i++ {
			s += e[i] * e[i+lag]
		}
		s /= float64(len(e) - lag)
		bpm := 60 * trailerBeatFPS / float64(lag)
		w := math.Exp(-0.5 * math.Pow(math.Log(bpm/90)/0.6, 2))
		if s*w > best {
			best, bestLag = s*w, lag
		}
	}
	return 60 * trailerBeatFPS / float64(bestLag)
}

func trailerBeats(env []float64, bpm float64) []int {
	n := len(env)
	if n == 0 {
		return nil
	}
	period := trailerBeatFPS * 60 / bpm
	mx := trailerEnvMax(env)
	score := make([]float64, n)
	prev := make([]int, n)
	for i := range env {
		score[i], prev[i] = env[i]/mx, -1
	}
	for i := 0; i < n; i++ {
		a, b := int(math.Max(0, float64(i)-2*period)), int(math.Max(0, float64(i)-0.5*period))
		best, bj := math.Inf(-1), -1
		for j := a; j < min(b, i); j++ {
			d := math.Log(float64(i-j) / period)
			if s := score[j] - 10*d*d; s > best {
				best, bj = s, j
			}
		}
		if bj >= 0 {
			score[i], prev[i] = env[i]/mx+best, bj
		}
	}
	i := max(0, n-int(period))
	for j := i; j < n; j++ {
		if score[j] > score[i] {
			i = j
		}
	}
	out := []int{i}
	for prev[i] >= 0 {
		i = prev[i]
		out = append(out, i)
	}
	sort.Ints(out)
	return out
}

// trailerCutPlan returns len(wants) segment durations summing to span, each within [mn, mx], with cuts on strong beats
// and onsets of env and segment lengths pulled toward the director's intended lengths (wants, rescaled to span).
func trailerCutPlan(env []float64, span float64, wants []float64, mn, mx float64) ([]float64, error) {
	n := len(wants)
	if n == 0 || span < float64(n)*mn-1e-6 || span > float64(n)*mx+1e-6 {
		return nil, fmt.Errorf("%d shots of %.0f-%.0fs do not fit %.1fs", n, mn, mx, span)
	}
	var wantSum float64
	for _, w := range wants {
		wantSum += w
	}
	scaled := make([]float64, n)
	for i, w := range wants {
		scaled[i] = w * span / math.Max(wantSum, 1e-9)
	}
	bt := trailerBeats(env, trailerTempo(env))
	hits := trailerPeaks(env, int(0.25*trailerBeatFPS), 0.12)
	at := trailerFrameTime
	hitNear := func(t float64) float64 {
		s := 0.0
		for _, h := range hits {
			if math.Abs(at(h.Frame)-t) < 0.12 {
				s = math.Max(s, h.Strength)
			}
		}
		return s
	}
	type cand struct{ t, s float64 }
	cands := []cand{{0, 1}}
	for _, b := range bt {
		cands = append(cands, cand{at(b), 0.3 + hitNear(at(b))})
	}
	for _, h := range hits {
		if h.Strength > 0.5 {
			cands = append(cands, cand{at(h.Frame), h.Strength + 0.3})
		}
	}
	sort.Slice(cands, func(i, j int) bool { return cands[i].t < cands[j].t })
	kept := cands[:0]
	for _, c := range cands {
		if c.t <= 0 && len(kept) > 0 || c.t > span-0.2 {
			continue
		}
		if k := len(kept); k > 0 && c.t-kept[k-1].t < 0.2 {
			if c.s > kept[k-1].s && kept[k-1].t > 0 {
				kept[k-1] = c
			}
			continue
		}
		kept = append(kept, c)
	}
	cands = append(kept, cand{span, 1})
	m := len(cands)
	neg := math.Inf(-1)
	dp := make([][]float64, n+1)
	bk := make([][]int, n+1)
	for k := range dp {
		dp[k], bk[k] = make([]float64, m), make([]int, m)
		for j := range dp[k] {
			dp[k][j], bk[k][j] = neg, -1
		}
	}
	dp[0][0] = 0
	for k := 1; k <= n; k++ {
		for j := 1; j < m; j++ {
			for i := 0; i < j; i++ {
				d := cands[j].t - cands[i].t
				if d < mn-1e-6 || d > mx+1e-6 || math.IsInf(dp[k-1][i], -1) {
					continue
				}
				if s := dp[k-1][i] + cands[j].s - 0.04*math.Abs(d-scaled[k-1]); s > dp[k][j] {
					dp[k][j], bk[k][j] = s, i
				}
			}
		}
	}
	if math.IsInf(dp[n][m-1], -1) {
		return nil, fmt.Errorf("no beat plan for %d shots in %.1fs", n, span)
	}
	out := make([]float64, n)
	j := m - 1
	for k := n; k >= 1; k-- {
		i := bk[k][j]
		out[k-1] = math.Round((cands[j].t-cands[i].t)*1000) / 1000
		j = i
	}
	return out, nil
}

// trailerBeatSpan is how much of the score the shots should cover: everything but the title hold, clamped to what n
// shots inside the H3 window can fill.
func trailerBeatSpan(scoreSeconds, hold float64, n int) (float64, bool) {
	span := scoreSeconds - hold
	lo, hi := float64(n*trailerMinShotSeconds), float64(n*trailerMaxShotSeconds)
	if n == 0 || span < lo {
		return 0, false
	}
	return math.Min(span, hi), true
}

func snapTrailerShotsToScore(ctx context.Context, musicPath string, results []dramatizeShotResult, hold float64) ([]float64, error) {
	y, err := decodeTrailerPCM(ctx, musicPath)
	if err != nil {
		return nil, err
	}
	var idx []int
	var wants []float64
	for i, r := range results {
		if r.ImageURL != "" {
			idx = append(idx, i)
			wants = append(wants, r.Shot.Seconds)
		}
	}
	span, ok := trailerBeatSpan(float64(len(y))/trailerBeatSR, hold, len(wants))
	if !ok {
		return nil, fmt.Errorf("score too short for %d shots", len(wants))
	}
	plan, err := trailerCutPlan(trailerOnsetEnvelope(y), span, wants, trailerMinShotSeconds, trailerMaxShotSeconds)
	if err != nil {
		return nil, err
	}
	out := make([]float64, len(results))
	for i, r := range results {
		out[i] = r.Shot.Seconds
	}
	for k, i := range idx {
		out[i] = plan[k]
	}
	return out, nil
}

// trailerH3Seconds is the integer clip length H3 renders for a (possibly fractional) cut: rounded up so the cut can
// always be trimmed from it, clamped to the H3 window.
func trailerH3Seconds(cut float64) int {
	return trailerSnapSeconds(math.Ceil(cut - 1e-3))
}
