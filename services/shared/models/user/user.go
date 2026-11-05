package user

import "slices"

type Role string

const (
	RoleAdmin    Role = "admin"
	RoleEditor   Role = "editor"
	RoleOperator Role = "operator"
	RoleViewer   Role = "viewer"
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
}

var allPermissions = []string{
	PermProjectsRead,
	PermProjectsCreate,
	PermProjectsUpdate,
	PermProjectsDelete,
	PermProjectsExecute,
	PermUsersRead,
	PermUsersManage,
	PermAll,
}

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
