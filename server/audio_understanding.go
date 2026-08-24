package main

// Port of https://github.com/lee101/audio-understanding (librosa-based
// audio_keypoint_detection.py) to dependency-free Go. Onset detection and beat
// tracking drive beat-synced cuts in the video dramatizer. The browser runs the
// same algorithm in frontend/lib/audio-understanding.ts; audio_parity_test.go
// checks the two agree on identical PCM.

import (
	"bufio"
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"math"
	"os/exec"
	"sort"
)

const (
	audioDefaultSampleRate = 22050
	audioDefaultHopLength  = 1024
	audioDefaultNFFT       = 2048
	audioDefaultNMels      = 128
)

// AudioAnalysis is the result of analysing a single audio track. Frame-indexed
// series share the Times axis.
type AudioAnalysis struct {
	SampleRate int     `json:"sample_rate"`
	HopLength  int     `json:"hop_length"`
	NFFT       int     `json:"n_fft"`
	Duration   float64 `json:"duration"`

	Tempo      float64   `json:"tempo"`
	OnsetTimes []float64 `json:"onset_times"`
	BeatTimes  []float64 `json:"beat_times"`

	Times            []float64 `json:"times,omitempty"`
	OnsetEnvelope    []float64 `json:"onset_envelope,omitempty"`
	RMS              []float64 `json:"rms,omitempty"`
	SpectralCentroid []float64 `json:"spectral_centroid,omitempty"`
	SpectralRolloff  []float64 `json:"spectral_rolloff,omitempty"`
	ZeroCrossingRate []float64 `json:"zero_crossing_rate,omitempty"`
}

// AudioAnalysisOptions mirrors the tuned parameters from the upstream script.
type AudioAnalysisOptions struct {
	SampleRate int
	HopLength  int
	NFFT       int
	NMels      int

	// Onset peak picking (upstream detect_onsets uses pre_max/post_max 5, delta 0.2).
	PreMax  int
	PostMax int
	PreAvg  int
	PostAvg int
	Delta   float64
	Wait    int

	// Beat tracking (upstream detect_beats uses start_bpm 60, tightness 100).
	StartBPM  float64
	Tightness float64

	// IncludeSeries attaches the per-frame feature arrays to the result.
	IncludeSeries bool
}

// DefaultAudioAnalysisOptions reproduces the upstream script's settings.
func DefaultAudioAnalysisOptions() AudioAnalysisOptions {
	sr := audioDefaultSampleRate
	hop := audioDefaultHopLength
	return AudioAnalysisOptions{
		SampleRate: sr,
		HopLength:  hop,
		NFFT:       audioDefaultNFFT,
		NMels:      audioDefaultNMels,
		PreMax:     5,
		PostMax:    5,
		PreAvg:     int(0.10 * float64(sr) / float64(hop)),
		PostAvg:    int(0.10*float64(sr)/float64(hop)) + 1,
		Delta:      0.2,
		Wait:       int(0.03 * float64(sr) / float64(hop)),
		StartBPM:   60,
		Tightness:  100,
	}
}

func (o *AudioAnalysisOptions) normalize() {
	if o.SampleRate <= 0 {
		o.SampleRate = audioDefaultSampleRate
	}
	if o.HopLength <= 0 {
		o.HopLength = audioDefaultHopLength
	}
	if o.NFFT <= 0 {
		o.NFFT = audioDefaultNFFT
	}
	if o.NMels <= 0 {
		o.NMels = audioDefaultNMels
	}
	if o.PreMax <= 0 {
		o.PreMax = 5
	}
	if o.PostMax <= 0 {
		o.PostMax = 5
	}
	if o.PreAvg <= 0 {
		o.PreAvg = 2
	}
	if o.PostAvg <= 0 {
		o.PostAvg = 3
	}
	if o.Delta <= 0 {
		o.Delta = 0.2
	}
	if o.Wait < 0 {
		o.Wait = 0
	}
	if o.StartBPM <= 0 {
		o.StartBPM = 60
	}
	if o.Tightness <= 0 {
		o.Tightness = 100
	}
}

// AnalyzeAudioFile decodes any ffmpeg-readable media file (video included) and
// analyses its audio track.
func AnalyzeAudioFile(ctx context.Context, path string, opts AudioAnalysisOptions) (*AudioAnalysis, error) {
	opts.normalize()
	samples, err := DecodeAudioMono(ctx, path, opts.SampleRate)
	if err != nil {
		return nil, err
	}
	if len(samples) == 0 {
		return nil, fmt.Errorf("audio: %s has no decodable audio track", path)
	}
	return AnalyzeAudioSamples(samples, opts), nil
}

// DecodeAudioMono shells out to ffmpeg to produce mono float32 PCM at sr Hz.
// Using ffmpeg keeps the server free of audio codec dependencies and matches the
// decode path the rest of the video pipeline already relies on.
func DecodeAudioMono(ctx context.Context, path string, sr int) ([]float64, error) {
	if sr <= 0 {
		sr = audioDefaultSampleRate
	}
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-v", "error",
		"-i", path,
		"-vn",
		"-ac", "1",
		"-ar", fmt.Sprintf("%d", sr),
		"-f", "f32le",
		"-acodec", "pcm_f32le",
		"-",
	)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}
	if err := cmd.Start(); err != nil {
		return nil, err
	}
	samples, readErr := readFloat32LE(stdout)
	waitErr := cmd.Wait()
	if readErr != nil {
		return nil, readErr
	}
	if waitErr != nil {
		return nil, fmt.Errorf("audio: ffmpeg decode failed for %s: %w", path, waitErr)
	}
	return samples, nil
}

func readFloat32LE(r io.Reader) ([]float64, error) {
	br := bufio.NewReaderSize(r, 1<<20)
	out := make([]float64, 0, 1<<16)
	buf := make([]byte, 4096)
	var carry []byte
	for {
		n, err := br.Read(buf)
		if n > 0 {
			chunk := buf[:n]
			if len(carry) > 0 {
				chunk = append(carry, chunk...)
				carry = nil
			}
			usable := len(chunk) - len(chunk)%4
			for i := 0; i < usable; i += 4 {
				bits := binary.LittleEndian.Uint32(chunk[i : i+4])
				out = append(out, float64(math.Float32frombits(bits)))
			}
			if usable < len(chunk) {
				carry = append(carry[:0], chunk[usable:]...)
			}
		}
		if err == io.EOF {
			return out, nil
		}
		if err != nil {
			return out, err
		}
	}
}

// AnalyzeAudioSamples runs the full feature pipeline on mono PCM.
func AnalyzeAudioSamples(y []float64, opts AudioAnalysisOptions) *AudioAnalysis {
	opts.normalize()
	sr, hop, nfft := opts.SampleRate, opts.HopLength, opts.NFFT

	res := &AudioAnalysis{
		SampleRate: sr,
		HopLength:  hop,
		NFFT:       nfft,
		Duration:   float64(len(y)) / float64(sr),
		OnsetTimes: []float64{},
		BeatTimes:  []float64{},
	}
	if len(y) < nfft {
		return res
	}

	spec := stftPower(y, nfft, hop)
	nFrames := len(spec)

	mel := melFilterBank(sr, nfft, opts.NMels, 0, float64(sr)/2)
	melSpec := applyFilterBank(spec, mel)
	melDB := powerToDBRefMax(melSpec, 80)

	onsetEnv := onsetStrength(melDB)
	onsetEnvNorm := normalizeMax(onsetEnv)

	onsetFrames := peakPick(onsetEnvNorm, opts.PreMax, opts.PostMax, opts.PreAvg, opts.PostAvg, opts.Delta, opts.Wait)
	res.OnsetTimes = framesToTime(onsetFrames, sr, hop)

	tempo := estimateTempo(onsetEnv, sr, hop, opts.StartBPM)
	beatFrames := beatTrackDP(onsetEnv, sr, hop, tempo, opts.Tightness)
	res.Tempo = tempo
	res.BeatTimes = framesToTime(beatFrames, sr, hop)

	if opts.IncludeSeries {
		res.Times = make([]float64, nFrames)
		for i := range res.Times {
			res.Times[i] = float64(i) * float64(hop) / float64(sr)
		}
		res.OnsetEnvelope = onsetEnv
		res.RMS = rmsFromPower(spec, nfft)
		res.SpectralCentroid, res.SpectralRolloff = spectralCentroidRolloff(spec, sr, nfft, 0.85)
		res.ZeroCrossingRate = zeroCrossingRate(y, nfft, hop)
	}
	return res
}

// ---------------------------------------------------------------------------
// FFT / STFT
// ---------------------------------------------------------------------------

func hannWindow(n int) []float64 {
	w := make([]float64, n)
	if n == 1 {
		w[0] = 1
		return w
	}
	// Periodic Hann, matching scipy.signal.get_window('hann', n, fftbins=True).
	for i := 0; i < n; i++ {
		w[i] = 0.5 - 0.5*math.Cos(2*math.Pi*float64(i)/float64(n))
	}
	return w
}

// fftInPlace runs an iterative radix-2 Cooley-Tukey FFT. len(re) must be a
// power of two.
func fftInPlace(re, im []float64) {
	n := len(re)
	if n <= 1 {
		return
	}
	for i, j := 1, 0; i < n; i++ {
		bit := n >> 1
		for ; j&bit != 0; bit >>= 1 {
			j ^= bit
		}
		j ^= bit
		if i < j {
			re[i], re[j] = re[j], re[i]
			im[i], im[j] = im[j], im[i]
		}
	}
	for length := 2; length <= n; length <<= 1 {
		ang := -2 * math.Pi / float64(length)
		wRe, wIm := math.Cos(ang), math.Sin(ang)
		for i := 0; i < n; i += length {
			curRe, curIm := 1.0, 0.0
			half := length / 2
			for j := 0; j < half; j++ {
				uRe, uIm := re[i+j], im[i+j]
				vRe := re[i+j+half]*curRe - im[i+j+half]*curIm
				vIm := re[i+j+half]*curIm + im[i+j+half]*curRe
				re[i+j], im[i+j] = uRe+vRe, uIm+vIm
				re[i+j+half], im[i+j+half] = uRe-vRe, uIm-vIm
				nRe := curRe*wRe - curIm*wIm
				curIm = curRe*wIm + curIm*wRe
				curRe = nRe
			}
		}
	}
}

// reflectPad mirrors librosa's center=True padding (np.pad mode='reflect').
func reflectPad(y []float64, pad int) []float64 {
	n := len(y)
	if pad <= 0 {
		return y
	}
	out := make([]float64, n+2*pad)
	for i := 0; i < pad; i++ {
		out[i] = y[reflectIndex(pad-i, n)]
		out[n+pad+i] = y[reflectIndex(n-2-i, n)]
	}
	copy(out[pad:pad+n], y)
	return out
}

func reflectIndex(i, n int) int {
	if n == 1 {
		return 0
	}
	period := 2 * (n - 1)
	i = ((i % period) + period) % period
	if i >= n {
		i = period - i
	}
	return i
}

// stftPower returns |STFT|^2 as frames x (nfft/2+1), centered like librosa.
func stftPower(y []float64, nfft, hop int) [][]float64 {
	padded := reflectPad(y, nfft/2)
	window := hannWindow(nfft)
	bins := nfft/2 + 1
	nFrames := 1 + (len(y))/hop

	out := make([][]float64, 0, nFrames)
	re := make([]float64, nfft)
	im := make([]float64, nfft)
	for f := 0; f < nFrames; f++ {
		start := f * hop
		if start+nfft > len(padded) {
			break
		}
		for i := 0; i < nfft; i++ {
			re[i] = padded[start+i] * window[i]
			im[i] = 0
		}
		fftInPlace(re, im)
		row := make([]float64, bins)
		for b := 0; b < bins; b++ {
			row[b] = re[b]*re[b] + im[b]*im[b]
		}
		out = append(out, row)
	}
	return out
}

// ---------------------------------------------------------------------------
// Mel scale (librosa slaney)
// ---------------------------------------------------------------------------

const (
	melFSp       = 200.0 / 3.0
	melMinLogHz  = 1000.0
	melMinLogMel = melMinLogHz / melFSp
)

var melLogStep = math.Log(6.4) / 27.0

func hzToMel(f float64) float64 {
	if f < melMinLogHz {
		return f / melFSp
	}
	return melMinLogMel + math.Log(f/melMinLogHz)/melLogStep
}

func melToHz(m float64) float64 {
	if m < melMinLogMel {
		return m * melFSp
	}
	return melMinLogHz * math.Exp(melLogStep*(m-melMinLogMel))
}

// melFilterBank builds an nMels x (nfft/2+1) Slaney-normalised triangular bank.
func melFilterBank(sr, nfft, nMels int, fmin, fmax float64) [][]float64 {
	if fmax <= 0 {
		fmax = float64(sr) / 2
	}
	bins := nfft/2 + 1
	fftFreqs := make([]float64, bins)
	for i := range fftFreqs {
		fftFreqs[i] = float64(i) * float64(sr) / float64(nfft)
	}

	melMin, melMax := hzToMel(fmin), hzToMel(fmax)
	melPts := make([]float64, nMels+2)
	for i := range melPts {
		melPts[i] = melToHz(melMin + (melMax-melMin)*float64(i)/float64(nMels+1))
	}

	bank := make([][]float64, nMels)
	for m := 0; m < nMels; m++ {
		row := make([]float64, bins)
		lower, center, upper := melPts[m], melPts[m+1], melPts[m+2]
		enorm := 2.0 / (upper - lower)
		for k := 0; k < bins; k++ {
			f := fftFreqs[k]
			var w float64
			switch {
			case f >= lower && f <= center && center > lower:
				w = (f - lower) / (center - lower)
			case f > center && f <= upper && upper > center:
				w = (upper - f) / (upper - center)
			}
			if w > 0 {
				row[k] = w * enorm
			}
		}
		bank[m] = row
	}
	return bank
}

func applyFilterBank(spec [][]float64, bank [][]float64) [][]float64 {
	out := make([][]float64, len(spec))
	for t, frame := range spec {
		row := make([]float64, len(bank))
		for m, filt := range bank {
			var sum float64
			for k, w := range filt {
				if w != 0 && k < len(frame) {
					sum += w * frame[k]
				}
			}
			row[m] = sum
		}
		out[t] = row
	}
	return out
}

// powerToDBRefMax matches librosa.power_to_db(S, ref=np.max, top_db=topDB).
func powerToDBRefMax(s [][]float64, topDB float64) [][]float64 {
	const amin = 1e-10
	ref := amin
	for _, row := range s {
		for _, v := range row {
			if v > ref {
				ref = v
			}
		}
	}
	logRef := 10 * math.Log10(math.Max(amin, ref))

	out := make([][]float64, len(s))
	maxDB := math.Inf(-1)
	for t, row := range s {
		dst := make([]float64, len(row))
		for i, v := range row {
			db := 10*math.Log10(math.Max(amin, v)) - logRef
			dst[i] = db
			if db > maxDB {
				maxDB = db
			}
		}
		out[t] = dst
	}
	if topDB > 0 && !math.IsInf(maxDB, -1) {
		floor := maxDB - topDB
		for _, row := range out {
			for i := range row {
				if row[i] < floor {
					row[i] = floor
				}
			}
		}
	}
	return out
}

// ---------------------------------------------------------------------------
// Onsets
// ---------------------------------------------------------------------------

// onsetStrength is the rectified first-order difference of the mel dB
// spectrogram averaged over mel bands (librosa.onset.onset_strength, lag=1).
func onsetStrength(melDB [][]float64) []float64 {
	n := len(melDB)
	env := make([]float64, n)
	if n < 2 {
		return env
	}
	nMels := len(melDB[0])
	for t := 1; t < n; t++ {
		var sum float64
		for m := 0; m < nMels; m++ {
			d := melDB[t][m] - melDB[t-1][m]
			if d > 0 {
				sum += d
			}
		}
		env[t] = sum / float64(nMels)
	}
	// Frame 0 has no predecessor; librosa pads it with zero.
	env[0] = 0
	return env
}

func normalizeMax(x []float64) []float64 {
	max := 0.0
	for _, v := range x {
		if v > max {
			max = v
		}
	}
	out := make([]float64, len(x))
	if max <= 0 {
		return out
	}
	for i, v := range x {
		out[i] = v / max
	}
	return out
}

// peakPick reproduces librosa.util.peak_pick.
func peakPick(x []float64, preMax, postMax, preAvg, postAvg int, delta float64, wait int) []int {
	n := len(x)
	peaks := []int{}
	if n == 0 {
		return peaks
	}
	lastPeak := -1 - wait
	for i := 0; i < n; i++ {
		// Local maximum over [i-preMax, i+postMax].
		lo, hi := maxInt(0, i-preMax), minInt(n, i+postMax+1)
		isMax := true
		for j := lo; j < hi; j++ {
			if x[j] > x[i] {
				isMax = false
				break
			}
		}
		if !isMax {
			continue
		}
		// Must exceed the local mean over [i-preAvg, i+postAvg] by delta.
		lo, hi = maxInt(0, i-preAvg), minInt(n, i+postAvg+1)
		var sum float64
		for j := lo; j < hi; j++ {
			sum += x[j]
		}
		avg := sum / float64(hi-lo)
		if x[i] < avg+delta {
			continue
		}
		if i > lastPeak+wait {
			peaks = append(peaks, i)
			lastPeak = i
		}
	}
	return peaks
}

func framesToTime(frames []int, sr, hop int) []float64 {
	out := make([]float64, len(frames))
	for i, f := range frames {
		out[i] = float64(f) * float64(hop) / float64(sr)
	}
	return out
}

// ---------------------------------------------------------------------------
// Tempo + beat tracking (Ellis dynamic-programming tracker, as in librosa)
// ---------------------------------------------------------------------------

// estimateTempo picks the autocorrelation lag of the onset envelope with the
// highest score under a log-normal prior centred on startBPM.
func estimateTempo(onsetEnv []float64, sr, hop int, startBPM float64) float64 {
	n := len(onsetEnv)
	if n < 4 {
		return startBPM
	}
	frameRate := float64(sr) / float64(hop)

	mean := 0.0
	for _, v := range onsetEnv {
		mean += v
	}
	mean /= float64(n)
	centered := make([]float64, n)
	for i, v := range onsetEnv {
		centered[i] = v - mean
	}

	// Search 30..300 BPM.
	minLag := maxInt(1, int(math.Floor(frameRate*60.0/300.0)))
	maxLag := minInt(n-1, int(math.Ceil(frameRate*60.0/30.0)))
	if maxLag <= minLag {
		return startBPM
	}

	best, bestLag := math.Inf(-1), minLag
	for lag := minLag; lag <= maxLag; lag++ {
		var acf float64
		for i := lag; i < n; i++ {
			acf += centered[i] * centered[i-lag]
		}
		acf /= float64(n - lag)
		bpm := 60.0 * frameRate / float64(lag)
		// librosa's log-normal tempo prior, std = 1.0 octave.
		z := math.Log2(bpm) - math.Log2(startBPM)
		score := acf * math.Exp(-0.5*z*z)
		if score > best {
			best, bestLag = score, lag
		}
	}
	return 60.0 * frameRate / float64(bestLag)
}

// beatTrackDP is librosa's __beat_tracker: smooth the onset envelope over one
// beat period, then run a DP that rewards regular spacing near that period.
func beatTrackDP(onsetEnv []float64, sr, hop int, tempo, tightness float64) []int {
	n := len(onsetEnv)
	if n < 3 || tempo <= 0 {
		return nil
	}
	frameRate := float64(sr) / float64(hop)
	period := int(math.Round(60.0 * frameRate / tempo))
	if period < 1 {
		period = 1
	}
	if period >= n {
		return nil
	}

	// Local score: onset envelope convolved with a Gaussian of width ~period.
	local := make([]float64, n)
	half := period
	kernel := make([]float64, 2*half+1)
	for i := range kernel {
		x := float64(i-half) * 32.0 / float64(period)
		kernel[i] = math.Exp(-0.5 * x * x)
	}
	std := stdDev(onsetEnv)
	if std <= 0 {
		std = 1
	}
	for i := 0; i < n; i++ {
		var sum float64
		for k := 0; k < len(kernel); k++ {
			j := i + k - half
			if j >= 0 && j < n {
				sum += kernel[k] * onsetEnv[j] / std
			}
		}
		local[i] = sum
	}

	backlink := make([]int, n)
	cumscore := make([]float64, n)
	loLag, hiLag := maxInt(1, period/2), 2*period

	// Seed: frames before a full period can start a beat sequence for free.
	firstThreshold := 0.01 * maxOf(local)
	for i := 0; i < n; i++ {
		bestScore, bestLag := math.Inf(-1), -1
		for lag := loLag; lag <= hiLag; lag++ {
			j := i - lag
			if j < 0 {
				break
			}
			// Penalise deviation from the expected period.
			z := math.Log(float64(lag) / float64(period))
			score := cumscore[j] - tightness*z*z
			if score > bestScore {
				bestScore, bestLag = score, j
			}
		}
		if bestLag < 0 {
			cumscore[i] = local[i]
			backlink[i] = -1
			continue
		}
		cumscore[i] = local[i] + bestScore
		backlink[i] = bestLag
		// Allow a strong early frame to start a fresh chain.
		if local[i] > firstThreshold && local[i] > cumscore[i] {
			cumscore[i] = local[i]
			backlink[i] = -1
		}
	}

	// Backtrace from the last locally-dominant frame.
	tail := lastLocalMaxIndex(cumscore)
	if tail < 0 {
		return nil
	}
	beats := []int{}
	for i := tail; i >= 0; i = backlink[i] {
		beats = append(beats, i)
		if backlink[i] < 0 {
			break
		}
	}
	// Reverse.
	for i, j := 0, len(beats)-1; i < j; i, j = i+1, j-1 {
		beats[i], beats[j] = beats[j], beats[i]
	}
	// Trim weak leading/trailing beats the way librosa's __trim_beats does.
	return trimBeats(local, beats)
}

func trimBeats(local []float64, beats []int) []int {
	if len(beats) == 0 {
		return beats
	}
	var sum float64
	for _, b := range beats {
		sum += local[b]
	}
	thresh := 0.5 * math.Sqrt(sum/float64(len(beats)))
	start, end := 0, len(beats)-1
	for start <= end && local[beats[start]] < thresh {
		start++
	}
	for end >= start && local[beats[end]] < thresh {
		end--
	}
	if start > end {
		return []int{}
	}
	out := append([]int{}, beats[start:end+1]...)
	sort.Ints(out)
	return out
}

func lastLocalMaxIndex(x []float64) int {
	n := len(x)
	if n == 0 {
		return -1
	}
	best, bestIdx := math.Inf(-1), -1
	// Prefer the global maximum in the final stretch so the chain runs long.
	for i := 0; i < n; i++ {
		if x[i] > best {
			best, bestIdx = x[i], i
		}
	}
	return bestIdx
}

// ---------------------------------------------------------------------------
// Spectral features (upstream compute_spectral_features)
// ---------------------------------------------------------------------------

func rmsFromPower(spec [][]float64, nfft int) []float64 {
	out := make([]float64, len(spec))
	for t, frame := range spec {
		var sum float64
		for k, v := range frame {
			// Interior bins appear twice in the full spectrum.
			if k == 0 || k == len(frame)-1 {
				sum += v
			} else {
				sum += 2 * v
			}
		}
		out[t] = math.Sqrt(sum) / float64(nfft)
	}
	return out
}

func spectralCentroidRolloff(spec [][]float64, sr, nfft int, rollPercent float64) ([]float64, []float64) {
	bins := nfft/2 + 1
	freqs := make([]float64, bins)
	for i := range freqs {
		freqs[i] = float64(i) * float64(sr) / float64(nfft)
	}
	centroid := make([]float64, len(spec))
	rolloff := make([]float64, len(spec))
	for t, power := range spec {
		// librosa's spectral features use magnitude, not power.
		var total, weighted float64
		mag := make([]float64, len(power))
		for k, v := range power {
			mag[k] = math.Sqrt(v)
			total += mag[k]
			weighted += mag[k] * freqs[k]
		}
		if total > 0 {
			centroid[t] = weighted / total
		}
		target := rollPercent * total
		var acc float64
		rolloff[t] = freqs[len(freqs)-1]
		for k, m := range mag {
			acc += m
			if acc >= target {
				rolloff[t] = freqs[k]
				break
			}
		}
	}
	return centroid, rolloff
}

func zeroCrossingRate(y []float64, frameLength, hop int) []float64 {
	padded := reflectPad(y, frameLength/2)
	nFrames := 1 + len(y)/hop
	out := make([]float64, 0, nFrames)
	for f := 0; f < nFrames; f++ {
		start := f * hop
		if start+frameLength > len(padded) {
			break
		}
		crossings := 0
		for i := start + 1; i < start+frameLength; i++ {
			if (padded[i-1] >= 0) != (padded[i] >= 0) {
				crossings++
			}
		}
		out = append(out, float64(crossings)/float64(frameLength))
	}
	return out
}

// ---------------------------------------------------------------------------
// Cut-point helpers used by the dramatizer
// ---------------------------------------------------------------------------

// BeatGrid picks cut points for an edit: prefers tracked beats, falls back to
// strong onsets, and finally to an even grid, always respecting minGap seconds.
func (a *AudioAnalysis) BeatGrid(minGap float64) []float64 {
	if a == nil {
		return nil
	}
	src := a.BeatTimes
	if len(src) < 2 {
		src = a.OnsetTimes
	}
	if len(src) < 2 {
		if a.Duration <= 0 || minGap <= 0 {
			return nil
		}
		out := []float64{}
		for t := 0.0; t < a.Duration; t += minGap {
			out = append(out, t)
		}
		return out
	}
	out := []float64{}
	last := math.Inf(-1)
	for _, t := range src {
		if t-last >= minGap {
			out = append(out, t)
			last = t
		}
	}
	return out
}

// SnapToBeat returns the cut point closest to t, within tolerance seconds.
func (a *AudioAnalysis) SnapToBeat(t, tolerance float64) float64 {
	if a == nil {
		return t
	}
	best, bestDist := t, tolerance
	for _, candidates := range [][]float64{a.BeatTimes, a.OnsetTimes} {
		for _, c := range candidates {
			d := math.Abs(c - t)
			if d < bestDist {
				best, bestDist = c, d
			}
		}
	}
	return best
}

func stdDev(x []float64) float64 {
	n := len(x)
	if n < 2 {
		return 0
	}
	var mean float64
	for _, v := range x {
		mean += v
	}
	mean /= float64(n)
	var acc float64
	for _, v := range x {
		d := v - mean
		acc += d * d
	}
	return math.Sqrt(acc / float64(n))
}

func maxOf(x []float64) float64 {
	m := math.Inf(-1)
	for _, v := range x {
		if v > m {
			m = v
		}
	}
	if math.IsInf(m, -1) {
		return 0
	}
	return m
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}
