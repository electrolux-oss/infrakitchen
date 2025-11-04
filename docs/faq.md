# Frequently Asked Questions (FAQ)

Find answers to common questions about InfraKitchen.

---

## 🏢 General Questions

### What is InfraKitchen?

InfraKitchen is a self-service infrastructure provisioning platform that enables developers to create and manage cloud resources without deep knowledge of Infrastructure-as-Code tools. Platform engineers define reusable templates, and developers use them through a guided interface.

### How is InfraKitchen different from Terraform/OpenTofu?

| InfraKitchen                | Terraform/OpenTofu           |
| :-------------------------- | :--------------------------- |
| GUI-based workflow          | CLI-based                    |
| Dynamic forms for variables | Manual variable files        |
| Built-in state management   | Manual backend configuration |
| Audit logs and history      | Limited tracking             |
| Template catalog            | Module registry              |
| Pull request automation     | Manual Git workflows         |
| RBAC and approvals          | No built-in access control   |

Think of InfraKitchen as a layer on top of Terraform/OpenTofu that makes it more accessible and manageable.

### Who should use InfraKitchen?

**Platform Engineers:**

- Define infrastructure standards
- Create reusable templates
- Manage cloud integrations
- Enforce governance and compliance

**Developers:**

- Provision infrastructure on-demand
- Update resources safely
- View infrastructure outputs
- No IaC expertise required

**DevOps Teams:**

- Audit infrastructure changes
- Review pull requests
- Monitor provisioning operations
- Manage resource lifecycle

### What cloud providers does InfraKitchen support?

Currently supported:

- ✅ Amazon Web Services (AWS)
- ✅ Microsoft Azure
- ✅ Google Cloud Platform (GCP)
- ✅ MongoDB Atlas
- ✅ Datadog

Infrastructure as Code support:

- ✅ OpenTofu

### Is InfraKitchen open source?

Yes! InfraKitchen is licensed under Apache 2.0. You can find the source code on [GitHub](https://github.com/electrolux-oss/infrakitchen).

### Can I use InfraKitchen with existing Terraform modules?

Absolutely! InfraKitchen works with standard Terraform/OpenTofu modules. Simply register your Git repository containing modules, and InfraKitchen will automatically analyze variables and outputs.

---

## 🔧 Technical Questions

### How does InfraKitchen store Terraform state?

InfraKitchen supports standard Terraform backend configurations:

- **AWS S3** with DynamoDB locking
- **Azure Storage** with blob storage
- **GCP Storage** with GCS buckets

State files are stored in your configured backend, not in InfraKitchen itself. This ensures compatibility with existing Terraform workflows.

### Can I import existing infrastructure into InfraKitchen?

Yes, but with some manual steps:

1. Create a resource in InfraKitchen with matching configuration
2. Use Terraform import to import existing infrastructure into the state
3. Run a dry run to verify configuration matches

!!! tip "Best Practice"
    It's easier to start fresh with new infrastructure. Only import existing resources if absolutely necessary.

### How does variable inheritance work?

Child resources can automatically reference parent resource outputs:

```yaml
# Parent VPC outputs
vpc_id: vpc-abc123
subnet_ids: [subnet-111, subnet-222]

# Child RDS resource automatically gets
vpc_id: vpc-abc123 (from parent VPC)
subnet_ids: [subnet-111, subnet-222] (from parent VPC)
```

This is configured in the Source Code Version variable configurations.

### What happens if provisioning fails?

1. Resource state remains `provision`
2. Status changes to `error`
3. Error details are logged
4. You can review logs to diagnose the issue
5. Fix the problem (update variables, fix integration, etc.)
6. Click **Retry** to attempt again

### Can I run InfraKitchen commands from CLI?

InfraKitchen primarily uses a web UI. However, you can:

- Use the REST API for automation
- Integrate with CI/CD pipelines
- Use the MCP Server for AI agent integration
- Access generated code in workspace repositories

### How are credentials secured?

InfraKitchen uses multiple security layers:

- **At Rest**: Credentials encrypted in database
- **In Transit**: HTTPS/TLS for all communications
- **In Memory**: Credentials only decrypted when needed
- **Access Control**: RBAC limits who can view/use integrations
- **Audit**: All credential access is logged

### Does InfraKitchen support drift detection?

Not currently. Drift detection between InfraKitchen resources and actual cloud state is on the roadmap. For now:

- Use cloud provider drift detection tools
- Run dry runs to see planned changes
- Review execution logs for unexpected modifications

---

## 🚀 Usage Questions

### How do I know which template to use?

1. **Check template description** - Explains what it does
2. **View parent/child relationships** - Understand dependencies
3. **Look at existing resources** - See how others used it
4. **Ask your platform team** - They defined the templates
5. **Read documentation** - Check internal wiki or docs

### Why can't I change certain variables?

Some variables are marked as "frozen" or "immutable" because:

- The underlying cloud resource cannot be modified in-place
- Changing them would require resource recreation
- They're inherited from parent resources
- Platform team locked them for compliance

Examples: VPC CIDR blocks, RDS engine type, storage account name

### What's the difference between State and Status?

**State** represents the resource lifecycle:

- `provision` - Not yet created
- `provisioned` - Created and running
- `destroy` - Marked for deletion
- `destroyed` - Removed

**Status** represents the current operation:

- `ready` - Ready for action
- `in_progress` - Currently executing
- `done` - Operation completed
- `error` - Operation failed

### How long does provisioning take?

It varies by resource type:

| Resource Type   | Typical Time  |
| :-------------- | :------------ |
| S3 Bucket       | 30 seconds    |
| VPC             | 1-2 minutes   |
| Lambda Function | 1-2 minutes   |
| RDS Database    | 10-20 minutes |
| EKS Cluster     | 15-30 minutes |
| Azure AKS       | 10-20 minutes |

Large resources with many components take longer.

### Can I provision multiple resources simultaneously?

Yes! InfraKitchen processes resources in parallel when possible. However:

- Parent resources must complete before children
- Dependent resources wait for their dependencies
- Each resource runs in an isolated environment

### Why is my resource waiting for approval?

Your organization may have approval workflows enabled:

- **Production resources** - Require senior engineer approval
- **Costly resources** - Need budget owner approval
- **Security-sensitive** - Need security team review

Check with your platform team about approval policies.

### How do I rollback a failed update?

InfraKitchen doesn't have automatic rollback, but you can:

1. Edit resource variables back to previous values
2. Perform dry run to verify changes
3. Apply the update

For critical situations:

- Use cloud provider console to manual rollback
- Destroy and recreate resource
- Restore from backup (for stateful resources)

---

## 🔀 Workspace Questions

### What is a Workspace?

A Workspace is a Git repository where InfraKitchen syncs generated infrastructure code for your resources.

### Why use Workspaces?

Benefits:

- **Review** - Team reviews infrastructure changes
- **Audit** - Git history tracks all modifications
- **Backup** - Code stored in version control
- **Portability** - Can run Terraform outside InfraKitchen
- **CI/CD** - Integrate with existing pipelines

### Do I need to approve Pull Requests?

It depends on your workflow:

**Manual Approval:**

- Review PR in Git provider
- Approve and merge manually

**Auto-Approval:**

- Click "Approve" in InfraKitchen
- InfraKitchen auto-merges PR
- Code lands in default branch

**No Workspace:**

- Skip PR workflow entirely
- Code not synced to Git

### What if PR conflicts with main branch?

Resolve conflicts:

1. Navigate to workspace repository
2. Pull both branches locally
3. Resolve merge conflicts
4. Push resolution
5. Merge PR

Or:

- Delete the branch and recreate resource
- This generates a fresh PR

### Can I edit workspace code directly?

You can, but be careful:

✅ **Safe edits:**

- Update README or documentation
- Add additional modules
- Modify resource tags

❌ **Dangerous edits:**

- Change variable values (creates drift)
- Modify backend configuration
- Remove InfraKitchen-generated files

!!! warning "Risk of Drift"
    Manual edits to resource code can cause drift between InfraKitchen and actual infrastructure.

---

## 🛠️ Troubleshooting

### Resource stuck at "in_progress"

**Possible causes:**

1. **Long-running operation** - EKS clusters take 15-20 min
2. **Network timeout** - Check connectivity
3. **State lock** - Another operation has locked state
4. **Task failure** - Check execution logs

**Solutions:**

- Wait if it's a long operation
- Check logs for errors
- Verify integration credentials
- Contact platform team if stuck >30 min

### "Parent resource not ready" error

**Cause:** Parent resource is not in `provisioned` state.

**Solutions:**

1. Wait for parent to finish provisioning
2. Check parent resource status
3. Ensure parent provisioned successfully
4. If parent failed, fix and provision it first

### Integration authentication fails

**Possible causes:**

- Expired credentials
- Incorrect configuration
- Insufficient permissions
- Network connectivity issues

**Solutions:**

1. Test integration in InfraKitchen
2. Verify credentials in cloud provider
3. Check IAM role/service principal permissions
4. Review audit logs for detailed errors
5. Update integration with new credentials

### Variables not appearing in form

**Cause:** Source code version analysis failed or variables not defined in `variables.tf`.

**Solutions:**

1. Verify `variables.tf` exists in module
2. Check Terraform syntax is valid
3. Re-analyze source code version
4. Check module folder path is correct
5. Review source code version logs

### Dry run shows unexpected changes

**Possible causes:**

- Drift between state and actual infrastructure
- Variables changed since last apply
- Source code version updated
- Dependencies changed

**Solutions:**

1. Review the plan carefully
2. Check if changes are intentional
3. Verify variable values
4. Consider running refresh-only plan
5. Contact platform team if unsure

### Workspace PR not created

**Possible causes:**

- Workspace not configured
- Git integration lacks permissions
- Repository doesn't exist
- Branch already exists
- API rate limiting

**Solutions:**

1. Verify workspace is set on resource
2. Check Git integration has write access
3. Ensure repository exists
4. Delete existing branch if conflict
5. Check workspace sync logs

### "State lock" error

**Cause:** Another operation is using the Terraform state.

**Solutions:**

1. Wait for other operation to complete
2. Check if another resource is provisioning
3. Verify no manual Terraform operations running
4. Force-unlock state (last resort, dangerous)
5. Contact platform team

---

## 🔒 Security Questions

### How are secrets managed?

InfraKitchen:

- Encrypts secrets at rest in database
- Uses HTTPS/TLS for all communication
- Never logs sensitive values
- Masks secrets in UI and logs
- Supports integration with HashiCorp Vault

### Who can see my resources?

Access control is role-based:

- **Creators** - Full access to their resources
- **Team members** - Access based on team membership
- **Admins** - Access to all resources
- **Viewers** - Read-only access

Check with your platform team about specific policies.

### Can I restrict certain templates?

Yes! Platform engineers can:

- Disable templates (make unavailable)
- Set RBAC policies per template
- Require approvals for certain templates
- Limit templates to specific teams

### Are audit logs available?

Yes! InfraKitchen logs:

- Resource creation/updates/destruction
- User actions and timestamps
- Integration usage
- Variable changes
- Approval decisions
- Workspace sync operations

Logs are searchable and exportable.

---

## 💰 Cost Questions

### How much does InfraKitchen cost?

InfraKitchen itself is open source and free. You pay for:

- Cloud infrastructure InfraKitchen provisions
- Compute resources to run InfraKitchen
- Storage for Terraform state
- Git repository hosting (if using private repos)

### Can InfraKitchen help reduce costs?

Yes, in several ways:

- **Lifecycle management** - Easy to destroy unused resources
- **Templated configurations** - Right-sizing enforced by platform team
- **Audit trail** - Track resource usage and owners
- **Tag enforcement** - Better cost allocation
- **Visibility** - See all resources in one place

### How do I track resource costs?

- Use labels to tag resources with cost centers
- Export resource list with tags
- Use cloud provider cost allocation tags
- Set up cloud cost management tools
- Review resources periodically

---

## 🎓 Learning and Support

### Where can I learn more?

- **Documentation**: [InfraKitchen Docs](https://opensource.electrolux.one/infrakitchen/)
- **Guides**: [Platform Engineer Guide](guides/platform-engineer-guide.md) | [Developer Guide](guides/developer-guide.md)
- **Discord**: [Community Server](https://discord.gg/HAk7caCMf9)
- **GitHub**: [Source Code & Issues](https://github.com/electrolux-oss/infrakitchen)

### Can I request features?

Absolutely!

1. Check [GitHub Issues](https://github.com/electrolux-oss/infrakitchen/issues) for existing requests
2. Create a new feature request issue
3. Discuss in Discord community
4. Consider contributing the feature yourself

### How do I get support?

**Community Support:**

- Discord server for quick questions
- GitHub Issues for bug reports
- Documentation and guides

**Enterprise Support:**

- Contact your platform engineering team
- Check internal documentation
- Company-specific support channels

---

## 🚦 Limitations and Constraints

### What are current limitations?

- **Drift Detection**: Not implemented yet
- **Multi-Region**: Each region needs separate resources
- **Blueprints**: Coming soon
- **Custom Providers**: OpenTofu/Terraform only
- **Real-time Collaboration**: Single user edits at a time

### Supported OpenTofu versions?

- OpenTofu `1.10+`

---

## ❓ Still Have Questions?

Can't find what you're looking for?

- 💬 Ask in [Discord](https://discord.gg/HAk7caCMf9)
- 🐛 Open an [Issue](https://github.com/electrolux-oss/infrakitchen/issues)
- 📧 Contact your platform engineering team
- 📖 Check the [full documentation](https://opensource.electrolux.one/infrakitchen/)

---

**We're here to help! 🎉**
