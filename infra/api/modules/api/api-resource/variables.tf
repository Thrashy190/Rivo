variable "rest_api_id" {
  type        = string
  description = "ID of the REST API this resource belongs to"
}

variable "parent_id" {
  type        = string
  description = "ID of the parent resource (root_resource_id if it hangs from the root)"
}

variable "path_part" {
  type        = string
  description = "Path segment, such as \"projects\" or \"{id}\""
}