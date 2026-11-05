package workspace

import "testing"

func TestPermissionsByRole(t *testing.T) {
	cases := []struct {
		role Role
		perm string
		want bool
	}{
		{RoleOwner, PermConnectionsManage, true},
		{RoleOwner, PermMembersManage, true},
		{Role("admin"), PermMembersManage, false},
		{RoleEditor, PermProjectsDelete, true},
		{RoleEditor, PermMembersManage, false},
		{RoleEditor, PermConnectionsManage, false},
		{RoleOperator, PermDeploymentsRun, true},
		{RoleOperator, PermProjectsUpdate, false},
		{RoleViewer, PermProjectsRead, true},
		{RoleViewer, PermDeploymentsRun, false},
		{Role("unknown"), PermProjectsRead, false},
	}
	for _, c := range cases {
		m := Membership{Role: c.role}
		if got := m.Has(c.perm); got != c.want {
			t.Errorf("%s has %s = %v, want %v", c.role, c.perm, got, c.want)
		}
	}
}

func TestOwnersCanOnlyInviteRestrictedRoles(t *testing.T) {
	for _, r := range []Role{RoleEditor, RoleOperator, RoleViewer} {
		if !Invitable(r) {
			t.Errorf("%s must be invitable", r)
		}
	}
	for _, r := range []Role{RoleOwner, Role("admin"), Role("root")} {
		if Invitable(r) {
			t.Errorf("%s must not be invitable", r)
		}
	}
}

func TestLosesLastOwner(t *testing.T) {
	one := Membership{UserID: "a", Role: RoleOwner}
	two := Membership{UserID: "b", Role: RoleOwner}
	editor := Membership{UserID: "c", Role: RoleEditor}

	if !LosesLastOwner([]Membership{one, editor}, &one) {
		t.Error("removing the only owner must be detected")
	}
	if LosesLastOwner([]Membership{one, two, editor}, &one) {
		t.Error("a second owner keeps the workspace safe")
	}
	if LosesLastOwner([]Membership{one, editor}, &editor) {
		t.Error("removing an editor never affects ownership")
	}
}
