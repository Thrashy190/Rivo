package user

import "testing"

func TestOnlyPlatformAdminsCreateAdmins(t *testing.T) {
	admin := User{Role: RoleAdmin}
	manager := User{Role: RoleMember, Permissions: []string{PermUsersManage}}

	cases := []struct {
		name  string
		role  Role
		perms []string
		want  bool
	}{
		{"role admin", RoleAdmin, nil, false},
		{"wildcard", RoleMember, []string{PermAll}, false},
		{"user management", RoleMember, []string{PermUsersManage}, false},
		{"creating workspaces", RoleMember, []string{PermWorkspacesCreate}, false},
		{"managing workspace owners", RoleMember, []string{PermWorkspacesManage}, false},
		{"plain member", RoleMember, nil, true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := manager.CanGrant(c.role, c.perms); got != c.want {
				t.Errorf("manager: got %v, want %v", got, c.want)
			}
			if !admin.CanGrant(c.role, c.perms) {
				t.Error("a platform administrator can grant anything")
			}
		})
	}
}

func TestCanManage(t *testing.T) {
	admin := User{Role: RoleAdmin}
	manager := User{Role: RoleMember, Permissions: []string{PermUsersManage}}
	member := User{Role: RoleMember}

	if manager.CanManage(&admin) {
		t.Error("a user manager must not touch a platform administrator")
	}
	if !manager.CanManage(&member) {
		t.Error("a user manager can manage a plain member")
	}
	if !admin.CanManage(&manager) {
		t.Error("a platform administrator can manage anyone")
	}
}
