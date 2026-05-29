variable "az" {
  type = string
}

resource "subnet" "this" {
  availability_zone = var.az
}
