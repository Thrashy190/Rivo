package auth

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// LoginOutput carries the tokens, or a challenge when Cognito cannot
// authenticate yet. The normal case is NEW_PASSWORD_REQUIRED: the admin created
// the user, who arrives with a temporary password and must go through
// POST /auth/new-password before receiving tokens.
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

type RefreshInput struct {
	RefreshToken string `json:"refreshToken"`
}

type ForgotPasswordInput struct {
	Email string `json:"email"`
}

type ResetPasswordInput struct {
	Email       string `json:"email"`
	Code        string `json:"code"`
	NewPassword string `json:"newPassword"`
}
