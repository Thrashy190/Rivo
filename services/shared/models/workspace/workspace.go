// Package workspace holds the tenant model: a workspace, who belongs to it and
// what each member can do inside it.
package workspace

import "slices"

type Role string

const (
	// RoleOwner is the workspace administrator: the customer who owns its
	// resources and manages its team. Only a platform administrator can create one.
	RoleOwner    Role = "owner"
	RoleEditor   Role = "editor"
	RoleOperator Role = "operator"
	RoleViewer   Role = "viewer"
)

// Permissions checked inside a workspace. They only apply to the workspace the
// membership belongs to, so access never crosses tenants.
const (
	PermWorkspaceRead     = "workspace:read"
	PermMembersRead       = "members:read"
	PermMembersManage     = "members:manage"
	PermFoldersManage     = "folders:manage"
	PermProjectsRead      = "projects:read"
	PermProjectsCreate    = "projects:create"
	PermProjectsUpdate    = "projects:update"
	PermProjectsDelete    = "projects:delete"
	PermDeploymentsRun    = "deployments:run"
	PermConnectionsManage = "connections:manage"

	// PermAll is the wildcard used by the owner role.
	PermAll = "*"
)

var rolePermissions = map[Role][]string{
	RoleOwner: {PermAll},
	RoleEditor: {
		PermWorkspaceRead, PermMembersRead, PermFoldersManage,
		PermProjectsRead, PermProjectsCreate, PermProjectsUpdate, PermProjectsDelete,
		PermDeploymentsRun,
	},
	RoleOperator: {PermWorkspaceRead, PermMembersRead, PermProjectsRead, PermDeploymentsRun},
	RoleViewer:   {PermWorkspaceRead, PermMembersRead, PermProjectsRead},
}

type Workspace struct {
	ID        string `dynamodbav:"id" json:"id"`
	Name      string `dynamodbav:"name" json:"name"`
	CreatedBy string `dynamodbav:"created_by" json:"createdBy"`
	CreatedAt int64  `dynamodbav:"created_at" json:"createdAt"`
	UpdatedAt int64  `dynamodbav:"updated_at" json:"updatedAt"`
}

// Membership gives one user a role in one workspace.
type Membership struct {
	WorkspaceID string `dynamodbav:"workspace_id" json:"workspaceId"`
	UserID      string `dynamodbav:"user_id" json:"userId"`
	Email       string `dynamodbav:"email" json:"email"`
	Role        Role   `dynamodbav:"role" json:"role"`
	CreatedAt   int64  `dynamodbav:"created_at" json:"createdAt"`
	UpdatedAt   int64  `dynamodbav:"updated_at" json:"updatedAt"`
}

// Summary is a workspace as seen by one of its members.
type Summary struct {
	Workspace
	Role Role `json:"role"`
}

type CreateWorkspaceInput struct {
	Name string `json:"name"`
}

type AddMemberInput struct {
	Email string `json:"email"`
	Role  Role   `json:"role"`
}

type AddOwnerInput struct {
	Email string `json:"email"`
}

type UpdateMemberInput struct {
	Role Role `json:"role"`
}

func ValidRole(r Role) bool {
	_, ok := rolePermissions[r]
	return ok
}

func (m *Membership) Has(perm string) bool {
	perms := rolePermissions[m.Role]
	return slices.Contains(perms, PermAll) || slices.Contains(perms, perm)
}

// Invitable reports whether a workspace member may hand out this role. Their
// team only gets restricted roles: owners are created at the platform level.
func Invitable(r Role) bool {
	return ValidRole(r) && r != RoleOwner
}

func (m *Membership) IsOwner() bool { return m.Role == RoleOwner }

// LosesLastOwner reports whether taking the target out of the owner role would
// leave the workspace without one.
func LosesLastOwner(members []Membership, target *Membership) bool {
	if target.Role != RoleOwner {
		return false
	}
	owners := 0
	for _, m := range members {
		if m.Role == RoleOwner {
			owners++
		}
	}
	return owners <= 1
}
