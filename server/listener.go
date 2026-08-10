package main

import (
	"fmt"
	"net"
	"os"
	"strconv"

	"github.com/valyala/fasthttp"
)

const systemdListenFDStart uintptr = 3

type listenerFromFD func(uintptr) (net.Listener, error)

// inheritedSystemdListener returns the single socket passed by systemd. Keeping
// the listening socket in a .socket unit lets connections queue while the
// service process is restarted during a deployment.
func inheritedSystemdListener(getenv func(string) string, pid int, fromFD listenerFromFD) (net.Listener, bool, error) {
	listenPID := getenv("LISTEN_PID")
	listenFDs := getenv("LISTEN_FDS")
	if listenPID == "" && listenFDs == "" {
		return nil, false, nil
	}

	parsedPID, err := strconv.Atoi(listenPID)
	if err != nil {
		return nil, false, fmt.Errorf("invalid LISTEN_PID %q: %w", listenPID, err)
	}
	if parsedPID != pid {
		return nil, false, nil
	}

	fdCount, err := strconv.Atoi(listenFDs)
	if err != nil {
		return nil, false, fmt.Errorf("invalid LISTEN_FDS %q: %w", listenFDs, err)
	}
	if fdCount != 1 {
		return nil, false, fmt.Errorf("expected one systemd listener, got %d", fdCount)
	}

	listener, err := fromFD(systemdListenFDStart)
	if err != nil {
		return nil, false, fmt.Errorf("open systemd listener: %w", err)
	}
	return listener, true, nil
}

func listenerFromSystemdFD(fd uintptr) (net.Listener, error) {
	file := os.NewFile(fd, "manifoldgen-systemd-listener")
	if file == nil {
		return nil, fmt.Errorf("file descriptor %d is unavailable", fd)
	}
	defer file.Close()
	return net.FileListener(file)
}

func listenAndServe(address string, handler fasthttp.RequestHandler) error {
	listener, inherited, err := inheritedSystemdListener(os.Getenv, os.Getpid(), listenerFromSystemdFD)
	if err != nil {
		return err
	}
	if inherited {
		defer listener.Close()
		return fasthttp.Serve(listener, handler)
	}
	return fasthttp.ListenAndServe(address, handler)
}
