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

func TestValidPackageID(t *testing.T) {
	if !ValidPackageID("0b8c7f5e-2d3a-4b1c-9e8f-7a6b5c4d3e2f") {
		t.Error("a generated ID must be valid")
	}
	// The ID becomes part of an S3 key, so nothing that could leave the
	// project's prefix may pass.
	for _, id := range []string{"", "../draft", "0b8c7f5e-2d3a-4b1c-9e8f-7a6b5c4d3e2f/../../x", "ABC", "0b8c7f5e2d3a4b1c9e8f7a6b5c4d3e2f"} {
		if ValidPackageID(id) {
			t.Errorf("%q must be rejected", id)
		}
	}
}

func TestValidPackageName(t *testing.T) {
	for name, want := range map[string]bool{
		"function.zip":     true,
		"Build.ZIP":        true,
		"function.tar.gz":  false,
		".zip":             false,
		`a"b.zip`:          false,
		"dir/function.zip": false,
		"line\nbreak.zip":  false,
	} {
		if got := ValidPackageName(name); got != want {
			t.Errorf("%q: got %v, want %v", name, got, want)
		}
	}
}
