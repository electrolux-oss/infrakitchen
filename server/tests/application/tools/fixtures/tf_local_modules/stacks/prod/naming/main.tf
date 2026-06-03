variable "prefix" {
  type = string
}

output "name" {
  value = "${var.prefix}-resource"
}
