package main

import (
	"bytes"
	"encoding/binary"
	"testing"
)

func testWav(rate, samples int) []byte {
	var b bytes.Buffer
	b.WriteString("RIFF")
	binary.Write(&b, binary.LittleEndian, uint32(36+samples*2))
	b.WriteString("WAVEfmt ")
	binary.Write(&b, binary.LittleEndian, uint32(16))
	binary.Write(&b, binary.LittleEndian, uint16(1))
	binary.Write(&b, binary.LittleEndian, uint16(1))
	binary.Write(&b, binary.LittleEndian, uint32(rate))
	binary.Write(&b, binary.LittleEndian, uint32(rate*2))
	binary.Write(&b, binary.LittleEndian, uint16(2))
	binary.Write(&b, binary.LittleEndian, uint16(16))
	b.WriteString("data")
	binary.Write(&b, binary.LittleEndian, uint32(samples*2))
	b.Write(make([]byte, samples*2))
	return b.Bytes()
}

func TestCaptionsParseWav(t *testing.T) {
	info, err := captionsParseWav(testWav(16000, 32000))
	if err != nil || info.SampleRate != 16000 || info.Duration != 2 {
		t.Fatalf("got %+v %v", info, err)
	}
	if _, err := captionsParseWav([]byte("nope")); err == nil {
		t.Fatal("expected error for non-wav")
	}
	stereo := testWav(16000, 100)
	binary.LittleEndian.PutUint16(stereo[22:24], 2)
	if _, err := captionsParseWav(stereo); err == nil {
		t.Fatal("expected error for stereo")
	}
}

func TestNormalizeCaptionWords(t *testing.T) {
	words := normalizeCaptionWords([]CaptionWord{
		{Text: "world", Start: 1.2, End: 1.9},
		{Text: "hello", Start: 0.5, End: 1.5},
		{Text: "[music]", Start: 2, End: 3},
		{Text: "two words", Start: 3, End: 4},
		{Text: "late", Start: 9, End: 12},
		{Text: "  ", Start: 4, End: 5},
	}, 10)
	want := []string{"hello", "world", "two", "words", "late"}
	if len(words) != len(want) {
		t.Fatalf("got %+v", words)
	}
	for i, word := range words {
		if word.Text != want[i] {
			t.Fatalf("word %d = %q, want %q", i, word.Text, want[i])
		}
		if word.End < word.Start || word.End > 10 {
			t.Fatalf("bad span %+v", word)
		}
		if i > 0 && word.Start < words[i-1].End-1e-9 {
			t.Fatalf("overlap %+v %+v", words[i-1], word)
		}
	}
	if words[0].End != 1.2 {
		t.Fatalf("overlap not trimmed: %+v", words[0])
	}
	if words[2].Start != 3 || words[2].End != 3.375 || words[3].Start != 3.375 {
		t.Fatalf("multi-word split wrong: %+v", words[2:4])
	}
}

func TestParseCaptionWords(t *testing.T) {
	words, err := parseCaptionWords("```json\n{\"words\":[{\"w\":\"hi\",\"s\":0.1,\"e\":0.3}]}\n```")
	if err != nil || len(words) != 1 || words[0].Text != "hi" {
		t.Fatalf("got %+v %v", words, err)
	}
	words, err = parseCaptionWords(`[{"w":"yo","s":0,"e":0.2}]`)
	if err != nil || len(words) != 1 {
		t.Fatalf("bare array: %+v %v", words, err)
	}
	if _, err := parseCaptionWords("nonsense"); err == nil {
		t.Fatal("expected error")
	}
}
