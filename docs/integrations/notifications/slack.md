# Slack

Integrate **Slack** with **InfraKitchen** to receive real-time notifications about infrastructure events.
This integration allows InfraKitchen to post messages to Slack channels when workflows complete, resources change state, or alerts are triggered.

---

## 1️⃣ Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and sign in with your Slack workspace account.
2. Click **Create New App**.
3. Choose **From scratch**.
4. Enter an **App Name** — for example: `InfraKitchen`
5. Select the **Workspace** where the app will be installed.
6. Click **Create App**.

---

## 2️⃣ Configure Bot Token Scopes

1. In the left sidebar of your app settings, navigate to **OAuth & Permissions**.
2. Scroll down to the **Scopes** section and find **Bot Token Scopes**.
3. Click **Add an OAuth Scope** and add each of the following required scopes:

| OAuth Scope          | Description                                                                 | Required |
| -------------------- | --------------------------------------------------------------------------- | -------- |
| `channels:read`      | View basic information about public channels in a workspace                 | ✅       |
| `chat:write`         | Send messages as @InfraKitchen                                              | ✅       |
| `groups:read`        | View basic information about private channels that InfraKitchen has been added to | ✅ |
| `users:read`         | View people in a workspace                                                  | ✅       |
| `users:read.email`   | View email addresses of people in a workspace                               | ✅       |

---

## 3️⃣ Install the App to Your Workspace

1. Still on the **OAuth & Permissions** page, scroll up to the **OAuth Tokens** section.
2. Click **Install to Workspace**.
3. Review the requested permissions and click **Allow**.
4. After installation, you will be redirected back to the **OAuth & Permissions** page.
5. Copy the **Bot User OAuth Token** — it starts with `xoxb-`.

!!! warning "Keep your token secure"
    The `xoxb-` token grants the app access to your Slack workspace. Treat it like a password — do not commit it to version control or share it publicly.

---

## 4️⃣ Invite the Bot to Channels (Optional)

For InfraKitchen to post to a specific channel, the bot must be a member of that channel:

1. Open the Slack channel where you want notifications delivered.
2. Type `/invite @InfraKitchen` (or whatever name you chose for your app).
3. Confirm the invitation.

This is required for **private channels** and recommended for **public channels** to ensure reliable delivery.

---

## 5️⃣ Fill Out the InfraKitchen Integration Form

InfraKitchen path: `/integrations/slack/setup`

| Field                | Description                                                        |
| -------------------- | ------------------------------------------------------------------ |
| **Integration Name** | A unique name for this integration (e.g., `slack-infra-alerts`)   |
| **Description**      | Brief description of the Slack workspace or channel purpose        |
| **Labels**           | Tags such as `slack`, `notifications`, or `alerts`                 |
| **Bot Token**        | The `xoxb-` token copied from the **OAuth & Permissions** page     |

---

## 6️⃣ Test the Connection

1. Click **Test Connection** in the InfraKitchen setup form.
2. InfraKitchen will call the Slack API to verify the token and check that the required scopes are granted.
3. If successful, you will see a confirmation message.
4. If the test fails, verify:

   - The **Bot Token** starts with `xoxb-` and has not been revoked.
   - All five required **Bot Token Scopes** are listed under OAuth & Permissions.
   - The app has been **installed** (not just created) in the target workspace.

---

## 🔐 Token Rotation

To rotate the bot token without disrupting notifications:

1. In the Slack app settings, go to **OAuth & Permissions** and click **Reinstall to Workspace**.
2. Copy the new `xoxb-` token.
3. Update the integration in InfraKitchen with the new token and save.

Existing notification subscriptions will resume automatically after the token is updated.
