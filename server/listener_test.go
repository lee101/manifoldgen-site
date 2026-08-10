package main

import (
	"errors"
	"net"
	"strconv"
	"testing"
)

func listenerEnv(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func TestInheritedSystemdListenerUsesFirstPassedFD(t *testing.T) {
	want, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer want.Close()

	const pid = 4242
	called := false
	got, inherited, err := inheritedSystemdListener(listenerEnv(map[string]string{
		"LISTEN_PID": strconv.Itoa(pid),
		"LISTEN_FDS": "1",
	}), pid, func(fd uintptr) (net.Listener, error) {
		called = true
		if fd != systemdListenFDStart {
			t.Fatalf("listener fd = %d, want %d", fd, systemdListenFDStart)
		}
		return want, nil
	})
	if err != nil {
		t.Fatalf("inheritedSystemdListener() error = %v", err)
	}
	if !inherited || !called {
		t.Fatalf("inherited = %v, factory called = %v; want both true", inherited, called)
	}
	if got != want {
		t.Fatalf("listener = %v, want passed listener %v", got, want)
	}
}

func TestInheritedSystemdListenerIgnoresAnotherProcessEnvironment(t *testing.T) {
	called := false
	got, inherited, err := inheritedSystemdListener(listenerEnv(map[string]string{
		"LISTEN_PID": "4243",
		"LISTEN_FDS": "1",
	}), 4242, func(uintptr) (net.Listener, error) {
		called = true
		return nil, errors.New("must not be called")
	})
	if err != nil || inherited || got != nil || called {
		t.Fatalf("listener = %v, inherited = %v, called = %v, error = %v", got, inherited, called, err)
	}
}

func TestInheritedSystemdListenerRejectsMultipleSockets(t *testing.T) {
	_, inherited, err := inheritedSystemdListener(listenerEnv(map[string]string{
		"LISTEN_PID": "4242",
		"LISTEN_FDS": "2",
	}), 4242, func(uintptr) (net.Listener, error) {
		return nil, errors.New("must not be called")
	})
	if err == nil || inherited {
		t.Fatalf("inherited = %v, error = %v; want a configuration error", inherited, err)
	}
}
