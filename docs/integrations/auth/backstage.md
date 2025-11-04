# Backstage

Setting up an **Identity Provider (IdP)** for **Backstage** involves a few key steps across your external IdP, your Backstage configuration (`app-config.yaml`).

## 🔧 Backstage Configuration (`app-config.yaml`)

Add the auth key to your `app-config.yaml` (or `app-config.local.yaml`):

```yaml

...
backend:
  auth:
    keys:
      - secret: n4m/Mcfo7aX9JZ8G506+qoZnXyT8zbiI # secret for InfraKitchen, replace with your own

...

```

---

## ⚙️ InfraKitchen Configuration

To configure InfraKitchen to use the Backstage Identity Provider, you need to provide the following parameters in the auth provider settings:

1. **Private Key**: The private key used to sign the JWT tokens. This should match the secret configured in Backstage.
2. JWKs URL: The URL where Backstage exposes its JWKs. This is typically in the format: `http://<BACKSTAGE_URL>/api/auth/.well-known/jwks.json`.
