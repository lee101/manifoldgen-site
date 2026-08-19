package main

import "testing"

func TestParseGeneratedVideoSignalRejectsCollapsedBlack(t *testing.T) {
	metadata := "lavfi.signalstats.YAVG=16.011\nlavfi.signalstats.YMAX=17\n" +
		"lavfi.signalstats.YAVG=16.020\nlavfi.signalstats.YMAX=18\n"
	signal, err := parseGeneratedVideoSignal(metadata)
	if err != nil {
		t.Fatal(err)
	}
	if signal.Samples != 2 || signal.MaxYAvg != 16.020 || signal.MaxYMax != 18 {
		t.Fatalf("signal = %#v", signal)
	}
}

func TestParseGeneratedVideoSignalPreservesDarkScenesWithHighlights(t *testing.T) {
	metadata := "lavfi.signalstats.YAVG=17.2\nlavfi.signalstats.YMAX=92\n"
	signal, err := parseGeneratedVideoSignal(metadata)
	if err != nil || signal.MaxYMax != 92 {
		t.Fatalf("signal = %#v err=%v", signal, err)
	}
}

func TestParseGeneratedVideoSignalRequiresDecodedSamples(t *testing.T) {
	if _, err := parseGeneratedVideoSignal("decoder produced nothing"); err == nil {
		t.Fatal("expected empty metadata to fail")
	}
}
