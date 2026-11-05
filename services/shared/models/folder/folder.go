// Package folder holds the folders that organize projects inside a workspace.
package folder

type Folder struct {
	WorkspaceID string `dynamodbav:"workspace_id" json:"workspaceId"`
	ID          string `dynamodbav:"id" json:"id"`
	ParentID    string `dynamodbav:"parent_id,omitempty" json:"parentId,omitempty"`
	Name        string `dynamodbav:"name" json:"name"`
	CreatedBy   string `dynamodbav:"created_by" json:"createdBy"`
	CreatedAt   int64  `dynamodbav:"created_at" json:"createdAt"`
}

type CreateFolderInput struct {
	Name     string `json:"name"`
	ParentID string `json:"parentId"`
}
