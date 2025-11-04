locals {
  tags_lowercase = {for k, v in var.tags : lower(k) => lower(v)}
}

provider "aws" {
  region              = var.region
  allowed_account_ids = [var.account]

  default_tags {
    tags = local.tags_lowercase
  }
}
