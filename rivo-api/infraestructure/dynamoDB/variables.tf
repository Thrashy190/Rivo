variable "project_name" {
  type        = string
  description = "Project name for tagging"
}

variable "environment" {
  type        = string
  description = "Environment"
}

variable "table_name" {
  type        = string
  description = "Base name of the table (the environment is prefixed automatically)"
}

variable "billing_mode" {
  type        = string
  default     = "PAY_PER_REQUEST"
  description = "PAY_PER_REQUEST (on-demand) or PROVISIONED"
}

variable "hash_key" {
  type        = string
  description = "Attribute name used as the partition key (PK)"
}

variable "range_key" {
  type        = string
  default     = null
  description = "Attribute name used as the sort key (SK), if any"
}

variable "attributes" {
  type = list(object({
    name = string
    type = string # S | N | B
  }))
  description = "Only the attributes referenced by hash_key, range_key or a GSI/LSI need to be declared here. Plain item fields (not used as a key) must NOT be listed."
}

variable "point_in_time_recovery" {
  type        = bool
  default     = true
  description = "Enable point-in-time recovery (continuous backups)"
}
