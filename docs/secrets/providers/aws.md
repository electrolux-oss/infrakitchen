# AWS Secrets Manager

Follow these steps to create and configure an AWS Secrets Manager secret in InfraKitchen. This allows your resources to securely retrieve secrets stored in AWS Secrets Manager.

---

## 1️⃣ Prerequisites

Before creating an AWS secret in InfraKitchen:

1. **AWS Integration** - Create an AWS integration with appropriate permissions (optional but recommended)
2. **AWS Secrets Manager Access** - Ensure the integration has permissions to access Secrets Manager
3. **Secret Created in AWS** - Create the actual secret in AWS Secrets Manager first

---

## 2️⃣ Required IAM Permissions

The AWS integration user or role must have these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:REGION:ACCOUNT_ID:secret:SECRET_NAME*"
    }
  ]
}
```

For broader access, you can use:

```json
{
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue",
    "secretsmanager:DescribeSecret",
    "secretsmanager:ListSecrets"
  ],
  "Resource": "*"
}
```

---

## 3️⃣  Configure Secret in InfraKitchen

Navigate to InfraKitchen: `/secrets/create`

### Required Configuration

| Field | Description | Example |
| :--- | :--- | :--- |
| **Name** | Unique identifier in InfraKitchen | `prod-database-credentials` |
| **Integration** | Link to AWS integration | Select your AWS integration |
| **Secret Type** | Type of secret | `tofu` (only option currently) |
| **Secret Provider** | Cloud provider | `aws` |
| **Secret Name** | Exact name of secret in AWS Secrets Manager | `my-secret` |
| **AWS Region** | AWS region where secret is stored | `us-east-1`, `eu-west-1` |

### Optional Configuration

| Field | Description | Example |
| :--- | :--- | :--- |
| **Description** | Purpose and usage notes | `Production database credentials for main app` |
| **Labels** | Tags for organization | `production`, `database`, `critical` |

---

## 🐛 Troubleshooting

### Common Issues

| Issue | Cause | Solution |
| ----- | ----- | -------- |
| **Secret not found** | Name mismatch | Verify exact secret name in AWS |
| **Access denied** | Missing IAM permissions | Add `secretsmanager:GetSecretValue` permission |
| **Wrong region** | Secret in different region | Update `aws_region` to match secret location |
| **Integration failed** | Invalid AWS credentials | Verify AWS integration is working |
| **KMS permission error** | Cannot decrypt secret | Add KMS decrypt permissions to IAM policy |

---

## 📚 Additional Resources

- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/)
- [IAM Permissions for Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/auth-and-access.html)
- [Rotating Secrets](https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotating-secrets.html)
- [AWS Integration Guide](../../integrations/cloud/aws.md)
