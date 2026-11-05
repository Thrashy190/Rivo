package user

import "slices"

type Role string

const (
	RoleAdmin    Role = "admin"
	RoleEditor   Role = "editor"
	RoleOperator Role = "operator"
	RoleViewer   Role = "viewer"
)

// Tabla de permisos: toda acción protegida de la API exige uno de estos.
// Cognito solo dice quién es el usuario; qué puede hacer sale de acá.
const (
	PermProjectsRead    = "projects:read"
	PermProjectsCreate  = "projects:create"
	PermProjectsUpdate  = "projects:update"
	PermProjectsDelete  = "projects:delete"
	PermProjectsExecute = "projects:execute"
	PermUsersRead       = "users:read"
	PermUsersManage     = "users:manage"

	// PermAll es el comodín que usa el rol admin.
	PermAll = "*"
)

const (
	StatusActive   = "active"
	StatusDisabled = "disabled"
)

// RolePermissions son los permisos que trae cada rol. Es el default:
// un usuario puede traer su propia lista en Permissions y esa gana
// (ver EffectivePermissions), que es el caso de "editor pero sin poder
// crear proyectos".
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

// EffectivePermissions resuelve los permisos reales del usuario: la lista
// explícita si la tiene, y si no los del rol.
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

// UpdateUserInput usa punteros para distinguir "no vino" (nil) de "vino
// vacío", igual que UpdateProjectInput: mandar "permissions": [] borra el
// override y devuelve al usuario a los permisos de su rol.
type UpdateUserInput struct {
	Role        *Role     `json:"role"`
	Permissions *[]string `json:"permissions"`
	Status      *string   `json:"status"`
}

// Profile es lo que devuelve GET /users/me: el usuario más sus permisos
// ya resueltos, para que el frontend no tenga que replicar la tabla de
// roles para decidir qué mostrar.
type Profile struct {
	User
	EffectivePermissions []string `json:"effectivePermissions"`
}

func NewProfile(u *User) Profile {
	return Profile{User: *u, EffectivePermissions: u.EffectivePermissions()}
}
