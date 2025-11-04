# MongoDB Atlas

Follow these steps to integrate **MongoDB** with InfraKitchen.
This integration allows InfraKitchen to connect to your MongoDB databases — hosted either on **MongoDB Atlas** or **self-managed clusters** — to monitor, automate, and manage database-related operations.

---

## 1️⃣ Log in to MongoDB Atlas

1. Go to [https://cloud.mongodb.com](https://cloud.mongodb.com) and sign in.
2. Navigate to **Identity & Access** -> **Applications**.
3. Navigate to API Keys.
4. Click **Add New API Key**.

---

## 2️⃣ Create an API Key

1. Provide a description for the API key (e.g., `InfraKitchen Integration Key`).
2. Assign the following roles to the API key:
   - **Organization Owner or Project Owner** – full administrative control (use with caution).
3. Add Access List Entries to restrict the API key to specific IP addresses (optional but recommended).

   - Add the IP address or CIDR block for InfraKitchen (or `0.0.0.0/0` for testing only).

4. Copy both:

   - **Public Key**
   - **Private Key**

5. Click **Done**.

---

## 3️⃣ Fill Out the InfraKitchen Integration Form

InfraKitchen path: `/integrations/mongodb_atlas/setup`

| Field                           | Description                                             |
| ------------------------------- | ------------------------------------------------------- |
| **Integration Name**            |  Unique name for this integration (e.g., `mongodb-prod`) |
| **Description**                 | Short description of your MongoDB environment           |
| **Labels**                      | Add labels such as `production`, `mongodb`, `atlas`     |
| **MongoDB Atlas Org ID**    | Paste your MongoDB Organization ID               |
| **MongoDB Atlas Public Key**         | Public KEY copied in previous step  |
| **MongoDB Atlas Private Key**         | Private KEY copied in previous step  |

---

## 4️⃣ Test the Connection

1. Click **Test Connection** to validate your configuration.
2. InfraKitchen will attempt to connect using your provided credentials and URI.
3. If the test fails:

   - Verify your **Public/Private** keys are correct.
   - Ensure your IP or network is whitelisted in **API Access List**.

---
