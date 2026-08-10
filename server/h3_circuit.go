package main

import (
	"sync"
	"time"
)

type h3CircuitState struct {
	failures  int
	openUntil time.Time
}

type h3CircuitBreaker struct {
	mu        sync.Mutex
	states    map[string]h3CircuitState
	threshold int
	cooldown  time.Duration
	now       func() time.Time
}

func newH3CircuitBreaker(threshold int, cooldown time.Duration) *h3CircuitBreaker {
	return &h3CircuitBreaker{
		states: make(map[string]h3CircuitState), threshold: threshold,
		cooldown: cooldown, now: time.Now,
	}
}

func (b *h3CircuitBreaker) allow(endpointID string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	state := b.states[endpointID]
	if state.openUntil.IsZero() {
		return true
	}
	if b.now().Before(state.openUntil) {
		return false
	}
	// Cooldown elapsed: allow a half-open probe. A success closes the circuit;
	// another server failure immediately opens it again.
	state.failures = b.threshold - 1
	state.openUntil = time.Time{}
	b.states[endpointID] = state
	return true
}

func (b *h3CircuitBreaker) failure(endpointID string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	state := b.states[endpointID]
	state.failures++
	if state.failures >= b.threshold {
		state.failures = b.threshold
		state.openUntil = b.now().Add(b.cooldown)
	}
	b.states[endpointID] = state
	return !state.openUntil.IsZero()
}

func (b *h3CircuitBreaker) success(endpointID string) {
	b.mu.Lock()
	delete(b.states, endpointID)
	b.mu.Unlock()
}

var h3RunpodCircuit = newH3CircuitBreaker(2, time.Minute)
