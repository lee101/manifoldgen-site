//! audiokp: fast audio keypoints (onsets, beats, sections, quiet gaps) and cut planning.
//! Decodes anything ffmpeg reads (opus, ogg, mp3, wav...) to 22.05 kHz mono f32 via a pipe.
//! Output is deliberately tiny (tens of lines) so an agent can read it as a tool result.
//!
//!   audiokp kp   <audio>                       compact keypoints
//!   audiokp plan <audio> <n> [min] [max]       n cut durations snapped to strong onsets/beats
use rayon::prelude::*;
use realfft::RealFftPlanner;
use std::io::Read;
use std::process::{Command, Stdio};

const SR: usize = 22050;
const NFFT: usize = 2048;
const HOP: usize = 512;
const FPS: f32 = SR as f32 / HOP as f32;

fn decode(path: &str) -> Vec<f32> {
    let mut child = Command::new("ffmpeg")
        .args(["-v", "error", "-i", path, "-ac", "1", "-ar", &SR.to_string(), "-f", "f32le", "-"])
        .stdout(Stdio::piped())
        .spawn()
        .expect("ffmpeg");
    let mut raw = Vec::new();
    child.stdout.take().unwrap().read_to_end(&mut raw).unwrap();
    child.wait().ok();
    raw.chunks_exact(4).map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]])).collect()
}

struct Feats {
    flux: Vec<f32>,     // onset strength per frame
    rms: Vec<f32>,      // loudness per frame
    centroid: Vec<f32>, // brightness per frame (bins)
}

fn features(y: &[f32]) -> Feats {
    let nframes = if y.len() < NFFT { 0 } else { (y.len() - NFFT) / HOP + 1 };
    let win: Vec<f32> = (0..NFFT)
        .map(|i| 0.5 - 0.5 * (2.0 * std::f32::consts::PI * i as f32 / NFFT as f32).cos())
        .collect();
    let nb = NFFT / 2 + 1;
    // log-magnitude spectra, parallel over frames; each thread owns its planner scratch
    let spec: Vec<(Vec<f32>, f32, f32)> = (0..nframes)
        .into_par_iter()
        .map_init(
            || {
                let mut p = RealFftPlanner::<f32>::new();
                let r2c = p.plan_fft_forward(NFFT);
                (r2c.clone(), r2c.make_input_vec(), r2c.make_output_vec())
            },
            |(r2c, inp, out), f| {
                let s = f * HOP;
                let mut e = 0.0f32;
                for i in 0..NFFT {
                    let v = y[s + i];
                    e += v * v;
                    inp[i] = v * win[i];
                }
                r2c.process(inp, out).unwrap();
                let mags: Vec<f32> = out.iter().map(|c| (c.re * c.re + c.im * c.im).sqrt()).collect();
                let tot: f32 = mags.iter().sum::<f32>() + 1e-9;
                let cen = mags.iter().enumerate().map(|(i, m)| i as f32 * m).sum::<f32>() / tot;
                let logm: Vec<f32> = mags.iter().map(|m| (1.0 + 10.0 * m).ln()).collect();
                (logm, (e / NFFT as f32).sqrt(), cen)
            },
        )
        .collect();
    let mut flux = vec![0.0f32; nframes];
    for f in 1..nframes {
        let (a, b) = (&spec[f - 1].0, &spec[f].0);
        flux[f] = (0..nb).map(|k| (b[k] - a[k]).max(0.0)).sum::<f32>();
    }
    Feats { flux, rms: spec.iter().map(|s| s.1).collect(), centroid: spec.iter().map(|s| s.2).collect() }
}

fn smooth(x: &[f32], w: usize) -> Vec<f32> {
    let n = x.len();
    let mut pre = vec![0.0f64; n + 1];
    for i in 0..n { pre[i + 1] = pre[i] + x[i] as f64; }
    (0..n).map(|i| {
        let (a, b) = (i.saturating_sub(w), (i + w + 1).min(n));
        ((pre[b] - pre[a]) / (b - a) as f64) as f32
    }).collect()
}

/// peaks above local mean + delta*max, at least `gap` frames apart (like librosa pre/post_max + delta)
fn peaks(env: &[f32], gap: usize, delta: f32) -> Vec<(usize, f32)> {
    let mx = env.iter().cloned().fold(1e-9, f32::max);
    let loc = smooth(env, 20);
    let mut out: Vec<(usize, f32)> = Vec::new();
    for i in 1..env.len().saturating_sub(1) {
        if env[i] > env[i - 1] && env[i] >= env[i + 1] && env[i] > loc[i] + delta * mx {
            if let Some(l) = out.last_mut() {
                if i - l.0 < gap { if env[i] > l.1 * mx { *l = (i, env[i] / mx); } continue; }
            }
            out.push((i, env[i] / mx));
        }
    }
    out
}

fn tempo(env: &[f32]) -> f32 {
    let m = env.iter().sum::<f32>() / env.len().max(1) as f32;
    let e: Vec<f32> = env.iter().map(|v| v - m).collect();
    let (lo, hi) = ((FPS * 60.0 / 180.0) as usize, (FPS * 60.0 / 50.0) as usize);
    let (mut best, mut bl) = (f32::MIN, lo);
    for lag in lo..hi.min(e.len() / 2) {
        let s: f32 = (0..e.len() - lag).map(|i| e[i] * e[i + lag]).sum::<f32>() / (e.len() - lag) as f32;
        // mild prior toward ~90 bpm so we do not lock on double time
        let bpm = 60.0 * FPS / lag as f32;
        let w = (-0.5 * ((bpm / 90.0).ln() / 0.6).powi(2)).exp();
        if s * w > best { best = s * w; bl = lag; }
    }
    60.0 * FPS / bl as f32
}

/// Ellis dynamic-programming beat tracker
fn beats(env: &[f32], bpm: f32) -> Vec<usize> {
    let period = FPS * 60.0 / bpm;
    let n = env.len();
    let mx = env.iter().cloned().fold(1e-9, f32::max);
    let o: Vec<f32> = env.iter().map(|v| v / mx).collect();
    let (mut score, mut prev) = (o.clone(), vec![usize::MAX; n]);
    for i in 0..n {
        let (a, b) = ((i as f32 - 2.0 * period).max(0.0) as usize, (i as f32 - 0.5 * period).max(0.0) as usize);
        let mut best = (f32::MIN, usize::MAX);
        for j in a..b.min(i) {
            let d = ((i - j) as f32 / period).ln();
            let s = score[j] - 100.0 * d * d * 0.01 * 10.0;
            if s > best.0 { best = (s, j); }
        }
        if best.1 != usize::MAX { score[i] = o[i] + best.0; prev[i] = best.1; }
    }
    let mut i = (n.saturating_sub(period as usize)..n).max_by(|&a, &b| score[a].partial_cmp(&score[b]).unwrap()).unwrap_or(0);
    let mut out = vec![i];
    while prev[i] != usize::MAX { i = prev[i]; out.push(i); }
    out.reverse();
    out
}

fn t(f: usize) -> f32 { f as f32 / FPS }

fn sections(f: &Feats, k: usize) -> Vec<f32> {
    // novelty = change of smoothed loudness+brightness over 4 s windows
    let w = (4.0 * FPS) as usize;
    let l: Vec<f32> = smooth(&f.rms.iter().map(|r| (1e-5 + r).ln()).collect::<Vec<_>>(), 8);
    let c = smooth(&f.centroid, 8);
    let cm = c.iter().cloned().fold(1e-9, f32::max);
    let nov: Vec<f32> = (0..l.len()).map(|i| {
        if i < w || i + w >= l.len() { return 0.0; }
        let (a, b) = (i - w..i, i..i + w);
        let ml = |x: &[f32], r: std::ops::Range<usize>| x[r.clone()].iter().sum::<f32>() / r.len() as f32;
        (ml(&l, b.clone()) - ml(&l, a.clone())).abs() + 3.0 * (ml(&c, b) - ml(&c, a)).abs() / cm
    }).collect();
    let mut idx: Vec<usize> = (0..nov.len()).collect();
    idx.sort_by(|&a, &b| nov[b].partial_cmp(&nov[a]).unwrap());
    let mut out: Vec<usize> = Vec::new();
    for i in idx { if out.iter().all(|&j| (i as isize - j as isize).unsigned_abs() > (8.0 * FPS) as usize) { out.push(i); } if out.len() >= k { break; } }
    out.sort();
    out.iter().map(|&i| t(i)).collect()
}

fn quiet(f: &Feats) -> Vec<(f32, f32)> {
    let mx = f.rms.iter().cloned().fold(1e-9, f32::max);
    let thr = 0.04 * mx;
    let (mut out, mut s) = (Vec::new(), None);
    for (i, &r) in f.rms.iter().enumerate() {
        match (r < thr, s) { (true, None) => s = Some(i), (false, Some(a)) => { if t(i - a) >= 0.8 { out.push((t(a), t(i))); } s = None; } _ => {} }
    }
    out
}

fn fmt(v: &[f32]) -> String { v.iter().map(|x| format!("{:.2}", x)).collect::<Vec<_>>().join(" ") }

fn main() {
    let a: Vec<String> = std::env::args().collect();
    if a.len() < 3 { eprintln!("usage: audiokp kp <audio> | plan <audio> <n> [min] [max]"); std::process::exit(2); }
    let y = decode(&a[2]);
    let f = features(&y);
    let env = smooth(&f.flux, 1);
    let bpm = tempo(&env);
    let bt = beats(&env, bpm);
    let hits = peaks(&env, (0.25 * FPS) as usize, 0.12);
    let dur = y.len() as f32 / SR as f32;
    match a[1].as_str() {
        "kp" => {
            let mut strong: Vec<_> = hits.clone();
            strong.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap());
            strong.truncate(24);
            strong.sort_by_key(|x| x.0);
            println!("dur {:.1} bpm {:.1} onsets {} beats {}", dur, bpm, hits.len(), bt.len());
            println!("sections {}", fmt(&sections(&f, 8)));
            println!("quiet {}", quiet(&f).iter().map(|(a, b)| format!("{:.1}-{:.1}", a, b)).collect::<Vec<_>>().join(" "));
            println!("hits {}", strong.iter().map(|(i, s)| format!("{:.2}:{:.1}", t(*i), s)).collect::<Vec<_>>().join(" "));
            println!("downbeats {}", fmt(&bt.iter().step_by(4).map(|&i| t(i)).collect::<Vec<_>>()));
        }
        "plan" => {
            let n: usize = a[3].parse().unwrap();
            let (mn, mx): (f32, f32) = (a.get(4).map_or(5.0, |s| s.parse().unwrap()), a.get(5).map_or(15.0, |s| s.parse().unwrap()));
            // candidate cut points: beats plus strong onsets; DP picks n segments maximising cut strength within [mn,mx]
            let mut cand: Vec<(f32, f32)> = vec![(0.0, 1.0)];
            let hs = |tt: f32| hits.iter().filter(|(i, _)| (t(*i) - tt).abs() < 0.12).map(|x| x.1).fold(0.0, f32::max);
            for &b in &bt { cand.push((t(b), 0.3 + hs(t(b)))); }
            for &(i, s) in &hits { if s > 0.5 { cand.push((t(i), s + 0.3)); } }
            cand.sort_by(|x, y| x.0.partial_cmp(&y.0).unwrap());
            cand.dedup_by(|x, y| (x.0 - y.0).abs() < 0.2);
            cand.push((dur, 1.0));
            let m = cand.len();
            let neg = f32::MIN / 2.0;
            let mut dp = vec![vec![neg; m]; n + 1];
            let mut bk = vec![vec![usize::MAX; m]; n + 1];
            dp[0][0] = 0.0;
            for k in 1..=n { for j in 1..m { for i in 0..j {
                let d = cand[j].0 - cand[i].0;
                if d < mn || d > mx || dp[k - 1][i] <= neg { continue; }
                // prefer cuts on strong points and near the mean length
                let s = dp[k - 1][i] + cand[j].1 - 0.02 * (d - dur / n as f32).abs();
                if s > dp[k][j] { dp[k][j] = s; bk[k][j] = i; }
            } } }
            if dp[n][m - 1] <= neg { eprintln!("no plan: {n} shots of {mn}-{mx}s do not fit {dur:.1}s"); std::process::exit(1); }
            let (mut j, mut cuts) = (m - 1, vec![]);
            for k in (1..=n).rev() { cuts.push((cand[bk[k][j]].0, cand[j].0)); j = bk[k][j]; }
            cuts.reverse();
            for (i, (s, e)) in cuts.iter().enumerate() { println!("{:02} {:.2} {:.2} {:.1}", i + 1, s, e, e - s); }
        }
        _ => std::process::exit(2),
    }
}
