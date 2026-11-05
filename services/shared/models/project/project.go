package project

type Project struct {
	ID          string `dynamodbav:"id" json:"id"`
	Name        string `dynamodbav:"name" json:"name"`
	Description string `dynamodbav:"description" json:"description"`
	CreatedAt   int64  `dynamodbav:"created_at" json:"created_at"`
}

type CreateProjectInput struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// UpdateProjectInput uses pointers to distinguish "not sent" (nil) from
// "sent empty" ("") — needed for a real partial PATCH: only the fields
// the client actually included in the body get updated.
type UpdateProjectInput struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
}
