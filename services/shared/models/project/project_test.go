package project

import "testing"

func TestValidDiagram(t *testing.T) {
	cases := []struct {
		name string
		body string
		want bool
	}{
		{"empty diagram", string(EmptyDiagram), true},
		{"with nodes", `{"version":"canvas/1","nodes":[{"id":"a"}],"edges":[]}`, true},
		{"not JSON", `not json`, false},
		{"missing nodes", `{"version":"canvas/1","edges":[]}`, false},
		{"nodes is not a list", `{"version":"canvas/1","nodes":{},"edges":[]}`, false},
		{"missing version", `{"nodes":[],"edges":[]}`, false},
	}
	for _, c := range cases {
		if got := ValidDiagram([]byte(c.body)); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func TestValidRegion(t *testing.T) {
	for _, r := range []string{"us-east-1", "eu-central-2", "ap-southeast-1", "us-gov-west-1"} {
		if !ValidRegion(r) {
			t.Errorf("%s must be valid", r)
		}
	}
	for _, r := range []string{"", "us-east", "US-EAST-1", "../../etc", "us-east-1/evil"} {
		if ValidRegion(r) {
			t.Errorf("%q must be invalid", r)
		}
	}
}
