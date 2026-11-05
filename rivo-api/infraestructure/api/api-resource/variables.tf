variable "rest_api_id" {
  type        = string
  description = "ID de la REST API a la que pertenece este resource"
}

variable "parent_id" {
  type        = string
  description = "ID del resource padre (root_resource_id si cuelga de la raíz)"
}

variable "path_part" {
  type        = string
  description = "Segmento de path, ej. \"projects\" o \"{id}\""
}