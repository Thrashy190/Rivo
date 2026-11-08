package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/Thrashy190/Rivo/services/shared/models/deployment"
)

type terraformError struct {
	command string
	code    int
	stderr  string
}

func (e *terraformError) Error() string {
	return fmt.Sprintf("terraform %s failed (exit %d)", e.command, e.code)
}

// summary is the part of Terraform's errors a person needs: from the first
// "Error:" on.
func (e *terraformError) summary() string {
	s := e.stderr
	if i := strings.Index(s, "Error:"); i >= 0 {
		s = s[i:]
	}
	s = strings.TrimSpace(s)
	if s == "" {
		return e.Error()
	}
	return truncate(s, 1500)
}

// readPlan counts what `terraform show -json` says a plan changes.
func readPlan(shown []byte) (*deployment.Plan, error) {
	var p struct {
		ResourceChanges []struct {
			Address string `json:"address"`
			Mode    string `json:"mode"`
			Type    string `json:"type"`
			Change  struct {
				Actions []string `json:"actions"`
			} `json:"change"`
		} `json:"resource_changes"`
	}
	if err := json.Unmarshal(shown, &p); err != nil {
		return nil, fmt.Errorf("reading the plan: %w", err)
	}
	plan := &deployment.Plan{Changes: []deployment.Change{}, Outputs: []deployment.OutputRef{}, Warnings: []deployment.Warning{}}
	for _, rc := range p.ResourceChanges {
		if rc.Mode == "data" {
			continue
		}
		acts := strings.Join(rc.Change.Actions, ",")
		switch acts {
		case "create":
			plan.Summary.Add++
		case "update":
			plan.Summary.Change++
		case "delete":
			plan.Summary.Destroy++
		case "delete,create", "create,delete":
			plan.Summary.Add++
			plan.Summary.Destroy++
		default:
			continue // no-op, read
		}
		plan.Changes = append(plan.Changes, deployment.Change{Address: rc.Address, Type: rc.Type, Actions: rc.Change.Actions})
	}
	return plan, nil
}

// readEndpoints maps `terraform output -json` to the nodes the outputs belong to.
func readEndpoints(out []byte, refs []deployment.OutputRef) (map[string]map[string]string, error) {
	var outputs map[string]struct {
		Value     any  `json:"value"`
		Sensitive bool `json:"sensitive"`
	}
	if err := json.Unmarshal(out, &outputs); err != nil {
		return nil, fmt.Errorf("reading the outputs: %w", err)
	}
	endpoints := map[string]map[string]string{}
	for _, ref := range refs {
		o, ok := outputs[ref.Name]
		value, isString := o.Value.(string)
		if !ok || o.Sensitive || !isString || ref.NodeID == "" {
			continue
		}
		if endpoints[ref.NodeID] == nil {
			endpoints[ref.NodeID] = map[string]string{}
		}
		endpoints[ref.NodeID][ref.Kind] = value
	}
	return endpoints, nil
}

// tarDir packs a configuration with its saved plan and the packages it built,
// leaving out the providers: init puts them back from the image.
func tarDir(dir string) ([]byte, error) {
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)
	err := filepath.WalkDir(dir, func(path string, e fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(dir, path)
		if rel == "." {
			return nil
		}
		if e.IsDir() {
			if rel == ".terraform" {
				return filepath.SkipDir
			}
			return nil
		}
		if !e.Type().IsRegular() {
			return nil
		}
		info, err := e.Info()
		if err != nil {
			return err
		}
		if err := tw.WriteHeader(&tar.Header{Name: filepath.ToSlash(rel), Mode: 0o600, Size: info.Size(), ModTime: info.ModTime()}); err != nil {
			return err
		}
		f, err := os.Open(path)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(tw, f)
		return err
	})
	if err != nil {
		return nil, err
	}
	if err := tw.Close(); err != nil {
		return nil, err
	}
	if err := gz.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func untarDir(archive []byte, dir string) error {
	gz, err := gzip.NewReader(bytes.NewReader(archive))
	if err != nil {
		return err
	}
	tr := tar.NewReader(gz)
	for {
		h, err := tr.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		path := filepath.Join(dir, filepath.FromSlash(h.Name))
		if !strings.HasPrefix(path, dir+string(os.PathSeparator)) || h.Typeflag != tar.TypeReg {
			return fmt.Errorf("unexpected entry %q", h.Name)
		}
		if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
			return err
		}
		f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o600)
		if err != nil {
			return err
		}
		if _, err := io.Copy(f, io.LimitReader(tr, 512<<20)); err != nil {
			f.Close()
			return err
		}
		f.Close()
	}
}

// tailWriter keeps the last bytes written to it.
type tailWriter struct {
	mu  sync.Mutex
	buf []byte
	max int
}

func (t *tailWriter) Write(p []byte) (int, error) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.buf = append(t.buf, p...)
	if len(t.buf) > t.max {
		t.buf = t.buf[len(t.buf)-t.max:]
	}
	return len(p), nil
}

func (t *tailWriter) String() string {
	t.mu.Lock()
	defer t.mu.Unlock()
	return string(t.buf)
}

func multi(ws ...io.Writer) io.Writer { return io.MultiWriter(ws...) }
