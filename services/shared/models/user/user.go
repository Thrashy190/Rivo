package user

import "slices"

type Role string

const (
	RoleAdmin    Role = "admin"
	RoleEditor   Role = "editor"
	RoleOperator Role = "operator"
	RoleViewer   Role = "viewer"

	// RoleMember has no platform-wide permissions: everything this user can do
	// comes from their memberships in workspaces.
	RoleMember Role = "member"
)

// Permission table: every protected API action requires one of these.
// Cognito only says who the user is; what they can do comes from here.
const (
	PermProjectsRead    = "projects:read"
	PermProjectsCreate  = "projects:create"
	PermProjectsUpdate  = "projects:update"
	PermProjectsDelete  = "projects:delete"
	PermProjectsExecute = "projects:execute"
	PermUsersRead       = "users:read"
	PermUsersManage     = "users:manage"

	// PermWorkspacesCreate lets a user open new workspaces on this installation.
	PermWorkspacesCreate = "workspaces:create"

	// PermWorkspacesManage lets a user add and remove workspace owners. It only
	// covers owners: it gives no access to what is inside the workspace.
	PermWorkspacesManage = "workspaces:manage"

	// PermAll is the wildcard used by the admin role.
	PermAll = "*"
)

const (
	StatusActive   = "active"
	StatusDisabled = "disabled"
)

// RolePermissions are the permissions each role brings by default. A user
// can carry their own list in Permissions, and that list wins (see
// EffectivePermissions), which covers cases like "editor who cannot
// create projects".
var RolePermissions = map[Role][]string{
	RoleAdmin: {PermAll},
	RoleEditor: {
		PermProjectsRead,
		PermProjectsCreate,
		PermProjectsUpdate,
		PermProjectsDelete,
		PermProjectsExecute,
	},
	RoleOperator: {PermProjectsRead, PermProjectsExecute},
	RoleViewer:   {PermProjectsRead},
	RoleMember:   {},
}

var allPermissions = []string{
	PermProjectsRead,
	PermProjectsCreate,
	PermProjectsUpdate,
	PermProjectsDelete,
	PermProjectsExecute,
	PermUsersRead,
	PermUsersManage,
	PermWorkspacesCreate,
	PermWorkspacesManage,
	PermAll,
}

// privilegedPermissions run the installation, so only a platform administrator
// can grant them.
var privilegedPermissions = []string{PermAll, PermUsersManage, PermWorkspacesCreate, PermWorkspacesManage}

type User struct {
	ID          string   `dynamodbav:"id" json:"id"`
	Email       string   `dynamodbav:"email" json:"email"`
	Role        Role     `dynamodbav:"role" json:"role"`
	Permissions []string `dynamodbav:"permissions,omitempty" json:"permissions,omitempty"`
	Status      string   `dynamodbav:"status" json:"status"`
	CreatedAt   int64    `dynamodbav:"created_at" json:"created_at"`
	UpdatedAt   int64    `dynamodbav:"updated_at" json:"updated_at"`
}

// EffectivePermissions resolves the user's real permissions: the explicit
// list if there is one, otherwise the role's.
func (u *User) EffectivePermissions() []string {
	if len(u.Permissions) > 0 {
		return u.Permissions
	}
	return RolePermissions[u.Role]
}

func (u *User) Has(perm string) bool {
	perms := u.EffectivePermissions()
	return slices.Contains(perms, PermAll) || slices.Contains(perms, perm)
}

func (u *User) IsActive() bool { return u.Status == StatusActive }

// IsPlatformAdmin reports whether the user is one of the people who run this
// installation of Rivo. This is not the same as a workspace owner.
func (u *User) IsPlatformAdmin() bool {
	return slices.Contains(u.EffectivePermissions(), PermAll)
}

// CanGrant reports whether the user may give someone this role and these
// permissions. Only platform administrators can create other administrators.
func (u *User) CanGrant(role Role, perms []string) bool {
	if u.IsPlatformAdmin() {
		return true
	}
	if role == RoleAdmin {
		return false
	}
	return !slices.ContainsFunc(perms, func(p string) bool {
		return slices.Contains(privilegedPermissions, p)
	})
}

// CanManage reports whether the user may change or delete the target. Only
// platform administrators can touch someone with privileged permissions.
func (u *User) CanManage(target *User) bool {
	if u.IsPlatformAdmin() {
		return true
	}
	return !slices.ContainsFunc(target.EffectivePermissions(), func(p string) bool {
		return slices.Contains(privilegedPermissions, p)
	})
}

func ValidRole(r Role) bool {
	_, ok := RolePermissions[r]
	return ok
}

func ValidPermission(p string) bool { return slices.Contains(allPermissions, p) }

func ValidStatus(s string) bool { return s == StatusActive || s == StatusDisabled }

type CreateUserInput struct {
	Email       string   `json:"email"`
	Role        Role     `json:"role"`
	Permissions []string `json:"permissions"`
}

// UpdateUserInput uses pointers to tell "not sent" (nil) from "sent empty",
// like UpdateProjectInput: sending "permissions": [] clears the override and
// returns the user to their role's permissions.
type UpdateUserInput struct {
	Role        *Role     `json:"role"`
	Permissions *[]string `json:"permissions"`
	Status      *string   `json:"status"`
}

// Profile is what GET /users/me returns: the user plus their resolved
// permissions, so the frontend does not have to replicate the role table to
// decide what to show.
type Profile struct {
	User
	EffectivePermissions []string `json:"effectivePermissions"`
}

func NewProfile(u *User) Profile {
	return Profile{User: *u, EffectivePermissions: u.EffectivePermissions()}
}
