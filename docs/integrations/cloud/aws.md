# AWS

Follow these steps to create and configure an AWS integration. Fill the required fields in the integration form (see **Required fields** at the end) and use **Test Connection** before saving.

---

## 1️⃣ Prepare an IAM Principal

1. Log in to the **AWS Console** and open the **IAM** service.
2. Create a new **IAM user** or reuse an existing one dedicated to this integration.
      * If creating a user: choose **Programmatic access** so you can generate an Access Key.
3. (Recommended) Create a dedicated user for InfraKitchen integrations rather than using a personal/root account.

---

## 2️⃣ Attach Permissions

1. Attach AWS managed policies or a custom policy that grants the permissions InfraKitchen needs.
      * If you plan to let the platform create/manage S3 buckets for remote state, include S3 permissions.
      * If InfraKitchen will manage EC2/CloudFormation/Lambda/etc., include those permissions as required.
2. For a least-privilege setup, create and attach a custom policy scoped to only the resources InfraKitchen will manage.

> Tip: If you want InfraKitchen to create an S3 bucket for Terraform/OpenTofu remote state, ensure the policy allows `s3:CreateBucket`, `s3:PutObject`, `s3:GetObject`, `s3:ListBucket`, etc., scoped to the bucket name pattern you will use.

---

## 3️⃣ (Recommended) Use Role Assumption for Better Security

- Create an **IAM role** in the target AWS account with the permissions InfraKitchen requires.
- In the role’s **trust policy**, allow the IAM user (or another account/principal) to assume the role. Example trust relationship snippet:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::ACCOUNT_ID:user/InfraKitchenUser" },
      "Action": "sts:AssumeRole"
    }
  ]
}
```

- On the IAM user that InfraKitchen will use, attach a policy allowing `sts:AssumeRole` for that role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "sts:AssumeRole",
      "Resource": "arn:aws:iam::TARGET_ACCOUNT_ID:role/RoleNameToAssume"
    }
  ]
}
```

- When configured, supply the **AWS Assumed Role Name** (the role's name) in the integration form so InfraKitchen will assume that role at runtime.

---

## 4️⃣ Generate Access Keys

1. For the IAM user you created (or the user designated to assume roles), go to **Security credentials** → **Create access key**.
2. Copy both values immediately: **AWS Access Key ID** and **AWS Secret Access Key**

3. Store them securely — you will paste them into InfraKitchen’s integration form.

---

## 5️⃣ Fill Out the InfraKitchen Integration Form

InfraKitchen path: `/integrations/aws/setup`

| Field | Description | Example/Notes |
| :--- | :--- | :--- |
| **Integration Name** | A unique, descriptive name for the integration. | E.g., `aws-production` |
| **Description** | (Optional) A short text describing this integration. | |
| **Labels** | (Optional) Tags to categorize the integration. | E.g., `production`, `dev`, `billing` |
| **AWS Account ID** | The 12-digit AWS account number. | E.g., `123456789012` |
| **AWS Access Key ID** | Paste the generated Access Key ID. | |
| **AWS Secret Access Key** | Paste the generated Secret Access Key. (Will be stored encrypted). |  |
| **AWS Assumed Role Name** | (Optional) The role name to assume if role assumption is set up. | E.g., `InfraKitchenRole` |
| **Automatically create S3 bucket for OpenTofu/Terraform remote state** | Check this to automatically create an S3 bucket for remote state. | Default bucket name: `infrakitchen-<AWS_ACCOUNT_ID>-bucket`. Default region: `us-east-1`. |

---

## 6️⃣ Test the Connection

1. After completing the fields, click **Test Connection**.
2. If the test succeeds, the credentials and permissions are valid.
3. If the test fails:

    * Re-check the **Access Key ID / Secret** for typos.
    * Verify the IAM user/role has the required permissions (including `sts:AssumeRole` if using a role).
    * Confirm the **AWS Account ID** is correct and matches the account where the role/user exists.

4. Save the integration once the test passes.
