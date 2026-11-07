package tfgen

import (
	"fmt"
	"strings"
)

// localName is a Terraform identifier: lower case letters, digits and
// underscores, starting with a letter.
func localName(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		default:
			b.WriteRune('_')
		}
	}
	out := collapse(b.String(), '_')
	if out == "" {
		out = "resource"
	}
	if out[0] >= '0' && out[0] <= '9' {
		out = "r_" + out
	}
	return truncate(out, 48, '_')
}

// awsName is the part of an AWS resource name that comes from the diagram:
// lower case letters, digits and hyphens, which every service accepts.
func awsName(s string) string {
	var b strings.Builder
	for _, r := range strings.ToLower(s) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		default:
			b.WriteRune('-')
		}
	}
	out := collapse(b.String(), '-')
	if out == "" {
		out = "resource"
	}
	return truncate(out, 40, '-')
}

// NamePrefix turns a project name into the default prefix of every resource,
// short enough for the strictest limit (S3 bucket prefixes).
func NamePrefix(project string) string {
	p := truncate(awsName(project), 20, '-')
	if p == "resource" || p == "" {
		return "rivo"
	}
	if p[0] >= '0' && p[0] <= '9' {
		p = truncate("p-"+p, 20, '-')
	}
	return p
}

// envName is an environment variable name: ITEMS_TABLE for a table "items".
func envName(s, suffix string) string {
	return strings.ToUpper(localName(s)) + "_" + suffix
}

func collapse(s string, sep rune) string {
	parts := strings.FieldsFunc(s, func(r rune) bool { return r == sep })
	return strings.Join(parts, string(sep))
}

func truncate(s string, n int, sep byte) string {
	if len(s) > n {
		s = s[:n]
	}
	return strings.TrimRight(s, string(sep))
}

// namer hands out unique identifiers.
type namer map[string]bool

func (u namer) take(base string) string {
	name := base
	for i := 2; u[name]; i++ {
		name = fmt.Sprintf("%s_%d", base, i)
	}
	u[name] = true
	return name
}
