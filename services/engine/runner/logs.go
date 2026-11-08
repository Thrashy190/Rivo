package main

import (
	"context"
	"fmt"
	"os"
	"sync"
	"time"
)

// The log is uploaded as it grows, so the app shows it while Terraform runs.
const (
	flushEvery  = 2 * time.Second
	maxLogBytes = 2 << 20
)

type logWriter struct {
	mu      sync.Mutex
	buf     []byte
	dirty   bool
	cut     bool
	files   Files
	key     string
	ctx     context.Context
	stop    chan struct{}
	stopped chan struct{}
}

func newLogWriter(ctx context.Context, files Files, key string) *logWriter {
	w := &logWriter{files: files, key: key, ctx: ctx, stop: make(chan struct{}), stopped: make(chan struct{})}
	go w.loop()
	return w
}

func (w *logWriter) Write(p []byte) (int, error) {
	os.Stdout.Write(p) // also to CloudWatch, through the task's log driver
	w.mu.Lock()
	defer w.mu.Unlock()
	if len(w.buf)+len(p) > maxLogBytes {
		if !w.cut {
			w.buf = append(w.buf, "\n[The log is too long; the rest is in CloudWatch.]\n"...)
			w.cut, w.dirty = true, true
		}
		return len(p), nil
	}
	w.buf = append(w.buf, p...)
	w.dirty = true
	return len(p), nil
}

func (w *logWriter) Printf(format string, args ...any) {
	fmt.Fprintf(w, format, args...)
}

func (w *logWriter) loop() {
	defer close(w.stopped)
	t := time.NewTicker(flushEvery)
	defer t.Stop()
	for {
		select {
		case <-t.C:
			w.flush()
		case <-w.stop:
			w.flush()
			return
		}
	}
}

func (w *logWriter) flush() {
	w.mu.Lock()
	if !w.dirty {
		w.mu.Unlock()
		return
	}
	body := append([]byte(nil), w.buf...)
	w.dirty = false
	w.mu.Unlock()
	ctx, cancel := context.WithTimeout(context.WithoutCancel(w.ctx), 20*time.Second)
	defer cancel()
	if err := w.files.PutFile(ctx, w.key, body, "text/plain; charset=utf-8"); err != nil {
		fmt.Fprintf(os.Stderr, "uploading the log: %v\n", err)
	}
}

func (w *logWriter) Close() {
	close(w.stop)
	<-w.stopped
}
