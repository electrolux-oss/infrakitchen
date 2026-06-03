variable "cidr" {
  type = string
}

module "subnet" {
  source = "../subnet"
  az     = "eu-west-1a"
}

resource "vpc" "this" {
  cidr_block = var.cidr
}
