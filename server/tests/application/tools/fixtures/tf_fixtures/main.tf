resource "iam_user" "my-iam-user" {
    name = "iamuser"
}

resource "account" "name" {
  name = var.name
}
