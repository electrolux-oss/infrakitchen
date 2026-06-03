module "network" {
  source = "../../modules/network"
  cidr   = "10.0.0.0/16"
}

module "naming" {
  source = "./naming"
  prefix = "prod"
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.0.0"
}

resource "iam_user" "prod" {
  name = "prod-user"
}
