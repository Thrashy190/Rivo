package tfgen

import (
	"fmt"
	"sort"
	"strings"
)

// A tiny HCL writer. Its output matches `terraform fmt`, so a downloaded
// project reads like hand-written Terraform: consecutive one-line attributes
// align their equals signs, and nested blocks and multi-line values break
// that alignment, as they do in fmt.

type expr struct {
	lines   []string // the value, one entry per line
	heredoc bool     // a heredoc aligns like a one-line value
}

func (e expr) multiline() bool { return len(e.lines) > 1 && !e.heredoc }

// raw is an expression written as is, such as a reference.
func raw(s string) expr { return expr{lines: []string{s}} }

// str is a quoted string. Template sequences are escaped, so the text is used
// literally.
func str(s string) expr { return raw(quote(s)) }

func quote(s string) string {
	r := strings.NewReplacer(`\`, `\\`, `"`, `\"`, "\n", `\n`, "\r", `\r`, "\t", `\t`, "${", "$${", "%{", "%%{")
	return `"` + r.Replace(s) + `"`
}

func num(n int) expr { return raw(fmt.Sprint(n)) }

func boolean(b bool) expr { return raw(fmt.Sprint(b)) }

// list is a one-line list of expressions.
func list(items ...expr) expr {
	parts := make([]string, len(items))
	for i, it := range items {
		parts[i] = it.lines[0]
	}
	return raw("[" + strings.Join(parts, ", ") + "]")
}

func strList(items ...string) expr {
	es := make([]expr, len(items))
	for i, s := range items {
		es[i] = str(s)
	}
	return list(es...)
}

// object is a multi-line object, with its keys in a stable order.
func object(fields map[string]expr) expr {
	keys := make([]string, 0, len(fields))
	for k := range fields {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	width := 0
	for _, k := range keys {
		width = max(width, len(objectKey(k)))
	}
	lines := []string{"{"}
	for _, k := range keys {
		key := objectKey(k)
		lines = append(lines, fmt.Sprintf("  %-*s = %s", width, key, fields[k].lines[0]))
	}
	return expr{lines: append(lines, "}")}
}

func objectKey(k string) string {
	for i, r := range k {
		ok := r == '_' || r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || i > 0 && (r == '-' || r >= '0' && r <= '9')
		if !ok {
			return quote(k)
		}
	}
	return k
}

// heredoc keeps text such as JSON readable. Each line is indented under the
// attribute.
func heredoc(text string) expr {
	lines := []string{"<<-EOT"}
	for _, l := range strings.Split(strings.TrimRight(text, "\n"), "\n") {
		lines = append(lines, "  "+l)
	}
	return expr{lines: append(lines, "EOT"), heredoc: true}
}

type item struct {
	name    string
	value   expr
	block   *block
	blank   bool
	comment string
}

type block struct {
	typ    string
	labels []string
	items  []item
}

func newBlock(typ string, labels ...string) *block {
	return &block{typ: typ, labels: labels}
}

func (b *block) attr(name string, value expr) *block {
	b.items = append(b.items, item{name: name, value: value})
	return b
}

// child adds a nested block and returns it.
func (b *block) child(typ string, labels ...string) *block {
	c := newBlock(typ, labels...)
	b.items = append(b.items, item{block: c})
	return c
}

func (b *block) blank() *block {
	b.items = append(b.items, item{blank: true})
	return b
}

func (b *block) comment(text string) *block {
	b.items = append(b.items, item{comment: text})
	return b
}

func (b *block) render(sb *strings.Builder, indent string) {
	sb.WriteString(indent + b.typ)
	for _, l := range b.labels {
		sb.WriteString(" " + quote(l))
	}
	sb.WriteString(" {\n")
	writeItems(sb, b.items, indent+"  ")
	sb.WriteString(indent + "}\n")
}

func writeItems(sb *strings.Builder, items []item, indent string) {
	// Normalize spacing: no blank lines at either end or twice in a row.
	var clean []item
	for _, it := range items {
		if it.blank && (len(clean) == 0 || clean[len(clean)-1].blank) {
			continue
		}
		clean = append(clean, it)
	}
	for len(clean) > 0 && clean[len(clean)-1].blank {
		clean = clean[:len(clean)-1]
	}

	for i := 0; i < len(clean); i++ {
		it := clean[i]
		switch {
		case it.blank:
			sb.WriteString("\n")
		case it.comment != "":
			sb.WriteString(indent + "# " + it.comment + "\n")
		case it.block != nil:
			it.block.render(sb, indent)
		case it.value.multiline():
			writeAttr(sb, indent, it.name, len(it.name), it.value)
		default:
			// A run of aligned attributes.
			j := i
			width := 0
			for j < len(clean) && clean[j].block == nil && !clean[j].blank && clean[j].comment == "" && !clean[j].value.multiline() {
				width = max(width, len(clean[j].name))
				j++
			}
			for k := i; k < j; k++ {
				writeAttr(sb, indent, clean[k].name, width, clean[k].value)
			}
			i = j - 1
		}
	}
}

func writeAttr(sb *strings.Builder, indent, name string, width int, v expr) {
	fmt.Fprintf(sb, "%s%-*s = %s\n", indent, width, name, v.lines[0])
	for _, l := range v.lines[1:] {
		if v.heredoc && l == "EOT" {
			sb.WriteString(indent + l + "\n")
			continue
		}
		sb.WriteString(indent + l + "\n")
	}
}

// file is one .tf file: top-level blocks separated by blank lines.
type file struct {
	header string
	blocks []*block
}

func (f *file) add(b *block) *block {
	f.blocks = append(f.blocks, b)
	return b
}

func (f *file) String() string {
	var sb strings.Builder
	if f.header != "" {
		for _, l := range strings.Split(f.header, "\n") {
			sb.WriteString("# " + l + "\n")
		}
		sb.WriteString("\n")
	}
	for i, b := range f.blocks {
		if i > 0 {
			sb.WriteString("\n")
		}
		b.render(&sb, "")
	}
	return sb.String()
}
