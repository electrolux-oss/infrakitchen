variable "account" {
  type = string
}

variable "region" {
  type    = string
  default = "emea"
}

variable "name" {
  type = string
}

variable "policy_access" {
  type = list(string)
  description = "List of policy access levels to be applied to the resource"
}
