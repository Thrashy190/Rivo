// Package tfgen turns a project's diagram into a Terraform configuration.
//
// Only what this package writes ever reaches Terraform: the diagram supplies
// names and settings, which are validated or quoted, never HCL. That is what
// lets the deployment engine run the result with its own role.
package tfgen

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// Diagram is the canvas format the web app saves ("canvas/1").
type Diagram struct {
	Version string `json:"version"`
	Nodes   []Node `json:"nodes"`
	Edges   []Edge `json:"edges"`
}

type Node struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"`
	Label    string         `json:"label"`
	Config   map[string]any `json:"config"`
	ParentID string         `json:"parentId,omitempty"`
}

type Edge struct {
	ID       string         `json:"id"`
	SourceID string         `json:"sourceId"`
	TargetID string         `json:"targetId"`
	Config   map[string]any `json:"config,omitempty"`
}

// Parse reads a saved diagram. It also accepts the exported model, whose edges
// use "source" and "target".
func Parse(body []byte) (*Diagram, error) {
	var d struct {
		Version string `json:"version"`
		Nodes   []Node `json:"nodes"`
		Edges   []struct {
			Edge
			Source string `json:"source"`
			Target string `json:"target"`
		} `json:"edges"`
	}
	if err := json.Unmarshal(body, &d); err != nil {
		return nil, fmt.Errorf("reading the diagram: %w", err)
	}
	out := &Diagram{Version: d.Version, Nodes: d.Nodes}
	for _, e := range d.Edges {
		if e.SourceID == "" {
			e.SourceID = e.Source
		}
		if e.TargetID == "" {
			e.TargetID = e.Target
		}
		out.Edges = append(out.Edges, e.Edge)
	}
	for i := range out.Nodes {
		if out.Nodes[i].Config == nil {
			out.Nodes[i].Config = map[string]any{}
		}
	}
	return out, nil
}

// Config readers. The diagram is edited by people, so every value may be
// missing or of the wrong type.

func (n Node) str(key, fallback string) string {
	switch v := n.Config[key].(type) {
	case string:
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
	case float64:
		return strconv.FormatFloat(v, 'f', -1, 64)
	}
	return fallback
}

func (n Node) raw(key string) string {
	s, _ := n.Config[key].(string)
	return s
}

func (n Node) int(key string, fallback, lo, hi int) int {
	var v int
	switch x := n.Config[key].(type) {
	case float64:
		v = int(x)
	case string:
		p, err := strconv.Atoi(strings.TrimSpace(x))
		if err != nil {
			return fallback
		}
		v = p
	default:
		return fallback
	}
	if v < lo || v > hi {
		return fallback
	}
	return v
}

func (n Node) bool(key string, fallback bool) bool {
	if v, ok := n.Config[key].(bool); ok {
		return v
	}
	return fallback
}

func (n Node) name() string {
	return n.str("name", n.ID)
}

func (e Edge) str(key, fallback string) string {
	if v, ok := e.Config[key].(string); ok && strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	return fallback
}
