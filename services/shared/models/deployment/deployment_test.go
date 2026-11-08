package deployment

import (
	"testing"
	"time"
)

func TestIDsSortByTimeAndValidate(t *testing.T) {
	a := NewID(time.UnixMilli(1700000000000))
	b := NewID(time.UnixMilli(1700000000001))
	if !(a < b) {
		t.Errorf("%s should sort before %s", a, b)
	}
	if !ValidID(a) || !ValidID(b) {
		t.Errorf("generated IDs are not valid: %s %s", a, b)
	}
	for _, bad := range []string{"", "../../etc", "1700000000000-ABCDEFGHIJ", "1700000000000_0123456789", "17000000000a0-0123456789"} {
		if ValidID(bad) {
			t.Errorf("%q should not be valid", bad)
		}
	}
}

func TestStatuses(t *testing.T) {
	if Finished(StatusPlanned) || !Finished(StatusCancelled) || !Running(StatusApplying) || Running(StatusPlanned) {
		t.Error("status groups are wrong")
	}
}
