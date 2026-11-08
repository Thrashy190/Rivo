package main

import "testing"

func TestBuildURLStaysOnTheAPI(t *testing.T) {
	base := "https://abc1234567.execute-api.us-east-1.amazonaws.com"
	ok := map[string]string{
		"/items":         base + "/items?limit=2",
		"/items/42":      base + "/items/42?limit=2",
		"/":              base + "/?limit=2",
		"/a%20b":         base + "/a%2520b?limit=2",
		"/users/@me/x:y": base + "/users/@me/x:y?limit=2",
	}
	for path, want := range ok {
		got, err := buildURL(base, path, map[string]string{"limit": "2"})
		if err != nil || got != want {
			t.Errorf("buildURL(%q) = %q, %v; want %q", path, got, err, want)
		}
	}
	for _, path := range []string{"items", "//evil.com/x", "/../x", "/x?y=1", "/x#y", "/a\nb", "http://evil.com"} {
		if got, err := buildURL(base, path, nil); err == nil {
			t.Errorf("buildURL(%q) = %q, want an error", path, got)
		}
	}
	for _, b := range []string{"http://abc1234567.execute-api.us-east-1.amazonaws.com", "https://evil.com", "https://abc1234567.execute-api.us-east-1.amazonaws.com.evil.com", "https://169.254.169.254"} {
		if _, err := buildURL(b, "/", nil); err == nil {
			t.Errorf("base %q was accepted", b)
		}
	}
}
