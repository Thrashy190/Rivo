package auth

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginOutput trae los tokens, o un challenge cuando Cognito no puede
// autenticar todavía. El caso normal es NEW_PASSWORD_REQUIRED: el usuario
// fue creado por el admin y entra con password temporal, así que tiene que
// pasar por POST /auth/new-password antes de recibir tokens.
type LoginOutput struct {
	IDToken      string `json:"idToken,omitempty"`
	AccessToken  string `json:"accessToken,omitempty"`
	RefreshToken string `json:"refreshToken,omitempty"`
	ExpiresIn    int32  `json:"expiresIn,omitempty"`
	Challenge    string `json:"challenge,omitempty"`
	Session      string `json:"session,omitempty"`
}

type NewPasswordInput struct {
	Email       string `json:"email"`
	Session     string `json:"session"`
	NewPassword string `json:"newPassword"`
}
