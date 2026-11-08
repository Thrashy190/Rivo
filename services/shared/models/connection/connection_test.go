package connection

import (
	"strings"
	"testing"
)

func TestAccountOf(t *testing.T) {
	cases := map[string]string{
		"arn:aws:iam::123456789012:role/RivoDeploy":         "123456789012",
		"arn:aws:iam::123456789012:role/path/to/Role":       "123456789012",
		" arn:aws:iam::123456789012:role/RivoDeploy ":       "123456789012",
		"arn:aws:iam::12345:role/RivoDeploy":                "",
		"arn:aws:iam::123456789012:user/someone":            "",
		"arn:aws:iam::123456789012:role/x\nPrincipal: evil": "",
	}
	for arn, want := range cases {
		if got := AccountOf(arn); got != want {
			t.Errorf("AccountOf(%q) = %q, want %q", arn, got, want)
		}
	}
}

func TestExternalIDsAreUnique(t *testing.T) {
	a, b := NewExternalID(), NewExternalID()
	if a == b || !strings.HasPrefix(a, "rivo-") || len(a) != 37 {
		t.Errorf("external IDs %q and %q", a, b)
	}
}

func TestTemplateTrustsOnlyRivoWithTheExternalID(t *testing.T) {
	tpl := Template("111122223333", []string{"arn:aws:iam::111122223333:role/rivo-dev-engine-task", "arn:aws:iam::111122223333:role/rivo-dev-verify"}, "rivo-abc")
	for _, want := range []string{"arn:aws:iam::111122223333:root", "sts:ExternalId: rivo-abc", "aws:PrincipalArn:\n                  - arn:aws:iam::111122223333:role/rivo-dev-engine-task\n                  - arn:aws:iam::111122223333:role/rivo-dev-verify"} {
		if !strings.Contains(tpl, want) {
			t.Errorf("template is missing %q", want)
		}
	}
}
