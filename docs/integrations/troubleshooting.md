# Troubleshooting Integration

## Test Connection Failures

If an integration's connection test fails:

- **Check Credentials:** Ensure API keys, tokens, or OAuth credentials are correct and have necessary permissions.
- **Network Access:** Verify network settings allow access to the provider's endpoints.
- **Provider Status:** Check the provider's status page for outages or maintenance.
- **Follow error messages:** Use error details to identify cloud-specific issues.

!!! tip "Consult Provider Docs"
    Each cloud provider may have unique troubleshooting steps. Refer to their official documentation for more details.

!!! tip "Connection Testing"
    If connection test has passed successfully it does not guarantee that all operations will succeed.
    Token permissions or network issues may still cause failures during resource provisioning or management.

## SSH Key validation Issues

When using SSH-based integrations (e.g., Git), if test connection has passed it does not guarantee that all operations will succeed.
Cloud provider has limited ability to validate SSH keys during connection tests.
If you encounter issues during operations (e.g., cloning repositories), consider the following:

- **Key Permissions:** Ensure the SSH key has the correct permissions set on the server (e.g., read access to the repository).
- **Key Format:** Verify that the SSH key is in the correct format (e.g., OpenSSH).
- **Test SSH Access:** Manually test SSH access to the target server using the same key to confirm connectivity. (Try to clone the repository using git command line with the same SSH key)

## Resource Provisioning Issues

If resources fail to provision using an integration:

- **Review Logs:** Check platform logs for error messages related to the integration.
- **Validate Configuration:** Ensure integration settings match the requirements for the resources being provisioned.
- **Dependency Check:** Confirm that all dependencies (e.g., IAM roles, VPC settings) are correctly configured.
- **Retry Provisioning:** After addressing issues, attempt to provision the resources again.

## Authentication Errors

If integrations throw 403/401 errors during operations:

- **Check credential Validity:** Ensure credentials are active and have not expired.
- **Update Integration:** Confirm that the integration has been updated with the new credentials.
- **Test Connection:** Re-test the integration connection after updating credentials.
- **Whitelist IPs:** Ensure that the platform's IP addresses are whitelisted in the provider's security settings if applicable.
