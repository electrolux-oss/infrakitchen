"""Catalog of the fixture templates and the modules backing them.

Each template is declared once: templates, source code versions, resources and blueprints
fixtures are all built from this catalog. Module variables and outputs mirror the dummy modules
of https://github.com/electrolux-oss/infrakitchen-example-templates at the tag of each template;
keep them in sync when the modules change.
"""

from dataclasses import dataclass, field
from typing import Any

from application.tools.tf_parser import OtfProvider

_MISSING: Any = object()

REGIONS = ["eu-north-1", "eu-west-1", "us-east-1", "ap-southeast-1"]
ENVIRONMENTS = ["dev", "staging", "prod"]
CIDR_BLOCKS = [f"10.{i}.0.0/16" for i in range(256)]
REDIS_NODE_TYPES = [
    "cache.t4g.small",
    "cache.t4g.medium",
    "cache.t4g.large",
    "cache.m6g.large",
    "cache.m6g.xlarge",
    "cache.m6g.2xlarge",
]
RDS_INSTANCE_CLASSES = ["db.t4g.micro", "db.t4g.small", "db.t4g.medium", "db.m7g.large"]


@dataclass(frozen=True)
class Variable:
    name: str
    tf_type: str
    description: str
    default: Any
    required: bool
    sensitive: bool = False
    frozen: bool = False
    restricted: bool = False
    unique: bool = False
    options: list[Any] = field(default_factory=list)

    @property
    def type(self) -> str:
        """The type InfraKitchen derives from the tf type when parsing a module."""
        return OtfProvider.remap_variable_types({self.name: {"type": self.tf_type}})[self.name]["type"]

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "type": self.type,
            "original_type": self.tf_type,
            "required": self.required,
            "default": self.default,
            "description": self.description,
            "sensitive": self.sensitive,
            "frozen": self.frozen,
            "restricted": self.restricted,
            "unique": self.unique,
            "options": self.options,
        }


@dataclass(frozen=True)
class Output:
    name: str
    value: str
    description: str

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "value": self.value, "description": self.description}


@dataclass(frozen=True)
class Reference:
    """The default of ``variable`` comes from ``output`` of the ``template`` resource up the tree."""

    variable: str
    template: str
    output: str


@dataclass(frozen=True)
class TemplateFixture:
    key: str
    name: str
    labels: list[str]
    parents: list[str] = field(default_factory=list)
    naming_convention: str | None = None
    required_configuration_variables: list[str] = field(default_factory=list)
    # Module folder and the git tag of its version, abstract templates have none
    folder: str | None = None
    version: str | None = None
    variables: list[Variable] = field(default_factory=list)
    outputs: list[Output] = field(default_factory=list)
    references: list[Reference] = field(default_factory=list)

    @property
    def abstract(self) -> bool:
        return self.folder is None


def var(
    name: str,
    tf_type: str,
    description: str,
    default: Any = _MISSING,
    required: bool | None = None,
    **metadata: Any,
) -> Variable:
    """A module variable, required when it has no default unless stated otherwise."""
    return Variable(
        name=name,
        tf_type=tf_type,
        description=description,
        default=None if default is _MISSING else default,
        required=default is _MISSING if required is None else required,
        **metadata,
    )


def out(name: str, value: str, description: str) -> Output:
    return Output(name=name, value=value, description=description)


def ref(variable: str, template: str, output: str | None = None) -> Reference:
    return Reference(variable=variable, template=template, output=output or variable)


# Generated from the modules' variables.tf and outputs.tf, IK metadata added on top
DUMMY_VARIABLES = [
    var("name", "string", "Name of the dummy application", default="dummy-app"),
    var("environment", "string", "Environment label", default="dev", frozen=True, options=ENVIRONMENTS),
    var("instance_count", "number", "Number of dummy instances to create", default=2),
    var("tags", "map(string)", "Tags attached to the dummy deployment", default={"owner": "platform"}),
]
DUMMY_OUTPUTS = [
    out("deployment_id", "${random_id.deployment.hex}", "Random deployment identifier"),
    out("instance_names", "${random_pet.instance[*].id}", "Generated dummy instance names"),
    out("tags", "${terraform_data.deployment.output.tags}", "Tags attached to the dummy deployment"),
]

DUMMY_ACCOUNT_VARIABLES = [
    var("region", "string", "AWS region", default="eu-north-1", frozen=True, required=True, options=REGIONS),
    var("account", "string", "Target AWS account ID", frozen=True, unique=True),
    var("master_account_id", "string", "Account ID that will assume the role in this account"),
    var(
        "environment_name",
        "string",
        "Environment label",
        default="dev",
        required=True,
        frozen=True,
        options=ENVIRONMENTS,
    ),
    var("tags", "map(any)", "Tags applied to created resources", default={}),
    var("max_session_duration", "number", "Max IAM role session duration in seconds", default=10800, restricted=True),
]
DUMMY_ACCOUNT_OUTPUTS = [
    out("account", "${var.account}", "AWS account ID"),
    out("env", "${var.environment_name}", "Environment name"),
    out("cicd_admin_role_name", "${terraform_data.cicd_admin.output.name}", "Created CI/CD admin IAM role name"),
    out("cicd_admin_role_arn", "${terraform_data.cicd_admin.output.arn}", "Created CI/CD admin IAM role ARN"),
]

DUMMY_VPC_VARIABLES = [
    var("account", "string", "Target AWS account ID", frozen=True),
    var("region", "string", "AWS region", default="eu-north-1", frozen=True),
    var("name", "string", "VPC name", frozen=True),
    var("cidr_block", "string", "VPC CIDR base (for example 10.20.0.0/16)", frozen=True, options=CIDR_BLOCKS),
    var("secondary_cidr_blocks", "list(string)", "Optional secondary CIDR blocks", default=[]),
    var("tags", "map(any)", "Tags applied to created resources", default={}),
]
DUMMY_VPC_OUTPUTS = [
    out("vpc_id", "${terraform_data.vpc.output.id}", "The ID of the VPC"),
    out(
        "private_subnets",
        '${[for az in local.azs : terraform_data.subnet["private-${az}"].output.id]}',
        "List of private subnet IDs",
    ),
    out(
        "public_subnets",
        '${[for az in local.azs : terraform_data.subnet["public-${az}"].output.id]}',
        "List of public subnet IDs",
    ),
    out(
        "database_subnets",
        '${[for az in local.azs : terraform_data.subnet["database-${az}"].output.id]}',
        "List of database subnet IDs",
    ),
    out(
        "elasticache_subnets",
        '${[for az in local.azs : terraform_data.subnet["elasticache-${az}"].output.id]}',
        "List of elasticache subnet IDs",
    ),
    out("cidr", "${terraform_data.vpc.output.cidr_block}", "CIDR block used by the VPC"),
    out("vpc_owner_id", "${terraform_data.vpc.output.owner_id}", "AWS account ID owning the VPC"),
]

DUMMY_REDIS_VARIABLES = [
    var("account", "string", "Target AWS account ID", frozen=True),
    var("region", "string", "AWS region", default="eu-north-1", frozen=True),
    var("name", "string", "Redis replication group name", frozen=True),
    var("redis_version", "string", "Valkey/Redis engine version", default="8.0", options=["8.0", "8.1", "8.2"]),
    var("node_type", "string", "Redis node type", default="cache.t4g.small", options=REDIS_NODE_TYPES),
    var("vpc_id", "string", "VPC ID for subnet and security-group discovery", frozen=True),
    var("ingress_cidrs", "list(string)", "CIDR blocks allowed to connect", default=[]),
    var("number_of_nodes", "number", "Number of cache nodes", default=2),
    var("tags", "map(string)", "Tags applied to created resources", default={}),
    var("family", "string", "Redis/Valkey parameter group family", default="valkey8", restricted=True),
    var("default_user_access_string", "string", "Default user access string", default="off -@all"),
    var("user_prefix", "string", "Prefix for generated IAM Redis users", frozen=True),
    var(
        "parameters",
        "object({\n  parameters = optional(list(any), [])\n})",
        "Redis parameter list wrapper",
        default={"parameters": []},
    ),
]
DUMMY_REDIS_OUTPUTS = [
    out(
        "redis_primary_endpoint",
        "${terraform_data.replication_group.output.primary_endpoint_address}",
        "Primary Redis endpoint",
    ),
    out(
        "reader_endpoint_address",
        "${terraform_data.replication_group.output.reader_endpoint_address}",
        "Reader endpoint",
    ),
    out("cluster_arn", "${terraform_data.replication_group.output.arn}", "ElastiCache cluster ARN"),
    out(
        "replication_group_id",
        "${terraform_data.replication_group.output.replication_group_id}",
        "Replication group ID",
    ),
    out("iam_user_arn", '${terraform_data.user["rw"].output.arn}', "Generated IAM user ARN"),
    out("iam_user_read_only_arn", '${terraform_data.user["ro"].output.arn}', "Generated read-only IAM user ARN"),
    out("user_prefix", "${var.user_prefix}", "User prefix used by Redis module"),
]

DUMMY_REDIS_IAM_VARIABLES = [
    var("cluster_arn", "string", "ElastiCache cluster ARN from the Redis module", frozen=True),
    var(
        "iam_user_arn",
        "string",
        "Redis IAM user ARN from the Redis module (iam_user_arn or iam_user_read_only_arn)",
        frozen=True,
    ),
    var("redis_primary_endpoint", "string", "Primary Redis endpoint from the Redis module", frozen=True),
    var("redis_port", "number", "Redis port", default=6379),
    var(
        "aws_iam_role_name", "string", "Service account IAM role name that needs Redis connect permission", frozen=True
    ),
    var("account", "string", "Target AWS account ID", frozen=True),
    var("region", "string", "AWS region", default="eu-north-1", frozen=True),
    var("policy_name", "string", "Policy name prefix", frozen=True),
    var("tags", "map(any)", "Tags applied to created resources", default={}),
]
DUMMY_REDIS_IAM_OUTPUTS = [
    out(
        "policy_name_effective", "${terraform_data.redis_iam.output.name}", "IAM inline policy name created on the role"
    ),
    out("target_role", "${terraform_data.attach.output.role}", "Role that receives Redis IAM permissions"),
    out("policy_arn", "${terraform_data.attach.output.policy_arn}", "IAM policy ARN attached to the role"),
    out(
        "redis_username", "${terraform_data.redis_user.output.name}", "Redis user the service account authenticates as"
    ),
    out("redis_user_arn", "${terraform_data.redis_user.output.arn}", "ElastiCache user ARN granted to the role"),
    out(
        "connection_url",
        "rediss://${terraform_data.redis_user.output.name}@${var.redis_primary_endpoint}:${var.redis_port}",
        "Passwordless TLS connection URL; use an IAM auth token as the password",
    ),
]

DUMMY_EKS_VARIABLES = [
    var("account", "string", "Target AWS account ID", frozen=True),
    var("region", "string", "AWS region", default="eu-north-1", frozen=True),
    var("name", "string", "EKS cluster name", frozen=True),
    var(
        "kubernetes_version",
        "string",
        "Kubernetes version of the EKS control plane",
        default="1.36",
        options=["1.34", "1.35", "1.36"],
    ),
    var("vpc_id", "string", "VPC ID for subnet discovery", frozen=True),
    var(
        "admin_role_arn",
        "string",
        "Optional IAM role ARN granted cluster admin through an EKS access entry",
        default="",
    ),
    var("endpoint_public_access", "bool", "Whether the Kubernetes API endpoint is publicly reachable", default=True),
    var(
        "public_access_cidrs",
        "list(string)",
        "CIDR blocks allowed to reach the public API endpoint",
        default=["0.0.0.0/0"],
    ),
    var(
        "node_subnet_tier",
        "string",
        "Subnet Tier tag used for worker nodes",
        default="public",
        options=["public", "private"],
    ),
    var("instance_types", "list(string)", "EC2 instance types for the managed node group", default=["t3.medium"]),
    var("capacity_type", "string", "Node group capacity type", default="ON_DEMAND", options=["ON_DEMAND", "SPOT"]),
    var("desired_size", "number", "Desired number of worker nodes", default=2),
    var("min_size", "number", "Minimum number of worker nodes", default=1),
    var("max_size", "number", "Maximum number of worker nodes", default=3),
    var("tags", "map(string)", "Tags applied to created resources", default={}),
]
DUMMY_EKS_OUTPUTS = [
    out("cluster_name", "${terraform_data.cluster.output.name}", "EKS cluster name"),
    out("cluster_arn", "${terraform_data.cluster.output.arn}", "EKS cluster ARN"),
    out("cluster_endpoint", "${terraform_data.cluster.output.endpoint}", "Kubernetes API server endpoint"),
    out("cluster_version", "${terraform_data.cluster.output.version}", "Kubernetes version of the control plane"),
    out(
        "cluster_certificate_authority_data",
        "${terraform_data.cluster.output.certificate_authority}",
        "Base64-encoded cluster CA certificate",
    ),
    out(
        "cluster_security_group_id",
        "${terraform_data.cluster.output.cluster_security_group_id}",
        "Cluster security group created by EKS",
    ),
    out("cluster_role_arn", "${terraform_data.cluster_role.output.arn}", "IAM role ARN used by the EKS control plane"),
    out("oidc_issuer_url", "${terraform_data.cluster.output.oidc_issuer}", "OIDC issuer URL of the cluster"),
    out("oidc_provider_arn", "${terraform_data.oidc_provider.output.arn}", "IAM OIDC provider ARN for IRSA"),
    out("node_group_name", "${terraform_data.node_group.output.name}", "Managed node group name"),
    out("node_role_arn", "${terraform_data.node_role.output.arn}", "IAM role ARN used by worker nodes"),
]

DUMMY_RDS_POSTGRES_VARIABLES = [
    var("account", "string", "Target AWS account ID", frozen=True),
    var("region", "string", "AWS region", default="eu-north-1", frozen=True),
    var("name", "string", "RDS instance identifier", frozen=True),
    var(
        "engine_version",
        "string",
        "PostgreSQL engine version (major or major.minor)",
        default="17",
        options=["15", "16", "17"],
    ),
    var("instance_class", "string", "RDS instance class", default="db.t4g.micro", options=RDS_INSTANCE_CLASSES),
    var("allocated_storage", "number", "Initial storage in GiB", default=20),
    var("max_allocated_storage", "number", "Storage autoscaling upper limit in GiB", default=100),
    var("vpc_id", "string", "VPC ID for subnet and security-group discovery", frozen=True),
    var("ingress_cidrs", "list(string)", "CIDR blocks allowed to connect", default=[]),
    var("db_name", "string", "Name of the initial database", default="app", frozen=True),
    var(
        "master_username",
        "string",
        "Master user name (password is managed in Secrets Manager)",
        default="dbadmin",
        frozen=True,
    ),
    var("multi_az", "bool", "Whether to deploy a Multi-AZ standby", default=False),
    var("backup_retention_period", "number", "Days to retain automated backups", default=7),
    var("iam_database_authentication_enabled", "bool", "Whether IAM database authentication is enabled", default=True),
    var("deletion_protection", "bool", "Whether deletion protection is enabled", default=False, restricted=True),
    var("skip_final_snapshot", "bool", "Whether to skip the final snapshot on destroy", default=True, restricted=True),
    var(
        "parameters",
        "object({\n  parameters = optional(list(any), [])\n})",
        "PostgreSQL parameter list wrapper",
        default={"parameters": []},
    ),
    var("tags", "map(string)", "Tags applied to created resources", default={}),
]
DUMMY_RDS_POSTGRES_OUTPUTS = [
    out("db_instance_identifier", "${terraform_data.postgres.output.identifier}", "RDS instance identifier"),
    out("db_instance_arn", "${terraform_data.postgres.output.arn}", "RDS instance ARN"),
    out(
        "db_instance_resource_id",
        "${terraform_data.postgres.output.resource_id}",
        "RDS instance resource ID (used in rds-db:connect IAM policies)",
    ),
    out("db_instance_address", "${terraform_data.postgres.output.address}", "Hostname of the RDS instance"),
    out("db_instance_port", "${terraform_data.postgres.output.port}", "Port the database listens on"),
    out(
        "db_instance_endpoint",
        "${terraform_data.postgres.output.address}:${terraform_data.postgres.output.port}",
        "Connection endpoint in host:port form",
    ),
    out("db_name", "${terraform_data.postgres.output.db_name}", "Name of the initial database"),
    out("master_username", "${terraform_data.postgres.output.username}", "Master user name"),
    out(
        "master_user_secret_arn",
        "${terraform_data.postgres.output.master_user_secret_arn}",
        "Secrets Manager ARN holding the master user password",
    ),
    out(
        "engine_version_actual",
        "${terraform_data.postgres.output.engine_version_actual}",
        "Running PostgreSQL engine version",
    ),
    out(
        "security_group_id", "${terraform_data.security_group.output.id}", "Security group attached to the RDS instance"
    ),
]

DUMMY_EKS_NAMESPACE_VARIABLES = [
    var("account", "string", "Target AWS account ID", frozen=True),
    var("region", "string", "AWS region", default="eu-north-1", frozen=True),
    var("cluster_name", "string", "EKS cluster name from the EKS module", frozen=True),
    var("namespace", "string", "Kubernetes namespace name", frozen=True),
    var("labels", "map(string)", "Labels applied to the namespace", default={}),
    var(
        "resource_quota",
        (
            'object({\n  requests_cpu    = optional(string, "2")\n'
            '  requests_memory = optional(string, "4Gi")\n'
            '  limits_cpu      = optional(string, "4")\n'
            '  limits_memory   = optional(string, "8Gi")\n'
            "  pods            = optional(number, 20)\n})"
        ),
        "Resource quota applied to the namespace",
        default={},
    ),
    var("tags", "map(string)", "Tags applied to created resources", default={}),
]
DUMMY_EKS_NAMESPACE_OUTPUTS = [
    out("namespace", "${terraform_data.namespace.output.name}", "Kubernetes namespace name"),
    out("namespace_uid", "${terraform_data.namespace.output.uid}", "Kubernetes namespace UID"),
    out("cluster_name", "${terraform_data.namespace.output.cluster_name}", "EKS cluster the namespace lives in"),
    out(
        "resource_quota_name",
        "${terraform_data.resource_quota.output.name}",
        "Resource quota attached to the namespace",
    ),
]

DUMMY_EKS_SERVICE_ACCOUNT_VARIABLES = [
    var("account", "string", "Target AWS account ID", frozen=True),
    var("region", "string", "AWS region", default="eu-north-1", frozen=True),
    var("cluster_name", "string", "EKS cluster name from the EKS module", frozen=True),
    var("oidc_provider_arn", "string", "IAM OIDC provider ARN from the EKS module", frozen=True),
    var("oidc_issuer_url", "string", "OIDC issuer URL from the EKS module", frozen=True),
    var("namespace", "string", "Kubernetes namespace from the namespace module", frozen=True),
    var("service_account_name", "string", "Kubernetes service account name", frozen=True),
    var(
        "policy_arns",
        "list(string)",
        "Additional managed IAM policy ARNs attached to the service account role",
        default=[],
    ),
    var("tags", "map(string)", "Tags applied to created resources", default={}),
]
DUMMY_EKS_SERVICE_ACCOUNT_OUTPUTS = [
    out("iam_role_arn", "${terraform_data.role.output.arn}", "IAM role ARN assumed by the service account (IRSA)"),
    out("iam_role_name", "${terraform_data.role.output.name}", "IAM role name assumed by the service account"),
    out("service_account_name", "${terraform_data.service_account.output.name}", "Kubernetes service account name"),
    out(
        "namespace", "${terraform_data.service_account.output.namespace}", "Kubernetes namespace of the service account"
    ),
]

DUMMY_RDS_POSTGRES_CREDENTIALS_VARIABLES = [
    var("account", "string", "Target AWS account ID", frozen=True),
    var("region", "string", "AWS region", default="eu-north-1", frozen=True),
    var(
        "aws_iam_role_name",
        "string",
        "Service account IAM role name that needs database connect permission",
        frozen=True,
    ),
    var("db_instance_resource_id", "string", "RDS instance resource ID from the RDS module", frozen=True),
    var("db_instance_address", "string", "RDS instance hostname from the RDS module", frozen=True),
    var("db_instance_port", "number", "RDS instance port from the RDS module", default=5432, frozen=True),
    var("db_name", "string", "Database name from the RDS module", frozen=True),
    var("db_username", "string", "Database user created for IAM authentication", frozen=True),
    var(
        "privileges", "list(string)", "Privileges granted to the user on the database", default=["CONNECT", "TEMPORARY"]
    ),
    var("policy_name", "string", "Policy name prefix", frozen=True),
    var("tags", "map(any)", "Tags applied to created resources", default={}),
]
DUMMY_RDS_POSTGRES_CREDENTIALS_OUTPUTS = [
    out(
        "policy_name_effective", "${terraform_data.rds_iam.output.name}", "IAM policy name created for database access"
    ),
    out("target_role", "${terraform_data.attach.output.role}", "Role that receives database IAM permissions"),
    out("policy_arn", "${terraform_data.attach.output.policy_arn}", "IAM policy ARN attached to the role"),
    out("db_username", "${terraform_data.db_user.output.name}", "Database user for IAM authentication"),
    out("db_user_arn", "${local.db_user_arn}", "rds-db ARN of the database user"),
    out(
        "connection_url",
        "postgresql://${terraform_data.db_user.output.name}@${var.db_instance_address}:${var.db_instance_port}/${var.db_name}?sslmode=require",
        "Passwordless connection URL; use an IAM auth token as the password",
    ),
]


TEMPLATES: list[TemplateFixture] = [
    TemplateFixture(key="organization", name="Organization", labels=["organization", "cloud"]),
    TemplateFixture(
        key="service",
        name="Service",
        labels=["service", "cloud"],
        parents=["organization"],
        naming_convention="service-{service_name}",
        required_configuration_variables=["service_name"],
    ),
    TemplateFixture(
        key="dummy",
        name="Dummy",
        labels=["dummy", "demo"],
        parents=["organization"],
        naming_convention="dummy-{environment}-{name}",
        folder="demo/00-dummy/",
        version="dummy-v1.0",
        variables=DUMMY_VARIABLES,
        outputs=DUMMY_OUTPUTS,
    ),
    TemplateFixture(
        key="dummy_account",
        name="Dummy Account",
        labels=["dummy", "account"],
        parents=["organization"],
        naming_convention="dummy-account-{environment_name}-{account}",
        folder="dummy/01-account/",
        version="account-v1.0",
        variables=DUMMY_ACCOUNT_VARIABLES,
        outputs=DUMMY_ACCOUNT_OUTPUTS,
    ),
    TemplateFixture(
        key="dummy_environment",
        name="Dummy Environment",
        labels=["dummy", "environment"],
        parents=["dummy_account"],
        naming_convention="dummy-environment-{env}-{region}",
        required_configuration_variables=["region", "environment_name"],
    ),
    TemplateFixture(
        key="dummy_vpc",
        name="Dummy VPC",
        labels=["dummy", "vpc"],
        parents=["dummy_environment"],
        naming_convention="dummy-vpc-{environment_name}-{region}-{name}",
        folder="dummy/02-vpc/",
        version="vpc-v1.0",
        variables=DUMMY_VPC_VARIABLES,
        outputs=DUMMY_VPC_OUTPUTS,
        references=[ref("account", "dummy_account")],
    ),
    TemplateFixture(
        key="dummy_redis",
        name="Dummy Redis",
        labels=["dummy", "redis"],
        parents=["dummy_vpc"],
        naming_convention="dummy-redis-{environment_name}-{region}-{name}",
        folder="dummy/03-redis/",
        version="redis-v1.0",
        variables=DUMMY_REDIS_VARIABLES,
        outputs=DUMMY_REDIS_OUTPUTS,
        references=[ref("account", "dummy_account"), ref("vpc_id", "dummy_vpc")],
    ),
    TemplateFixture(
        key="dummy_eks",
        name="Dummy EKS",
        labels=["dummy", "eks", "kubernetes"],
        parents=["dummy_vpc"],
        naming_convention="dummy-eks-{environment_name}-{region}-{name}",
        folder="dummy/05-eks/",
        version="eks-v1.0",
        variables=DUMMY_EKS_VARIABLES,
        outputs=DUMMY_EKS_OUTPUTS,
        references=[ref("account", "dummy_account"), ref("vpc_id", "dummy_vpc")],
    ),
    TemplateFixture(
        key="dummy_rds_postgres",
        name="Dummy RDS PostgreSQL",
        labels=["dummy", "rds", "postgres"],
        parents=["dummy_vpc"],
        naming_convention="dummy-rds-postgres-{environment_name}-{region}-{name}",
        folder="dummy/06-rds-postgres/",
        version="rds-postgres-v1.0",
        variables=DUMMY_RDS_POSTGRES_VARIABLES,
        outputs=DUMMY_RDS_POSTGRES_OUTPUTS,
        references=[ref("account", "dummy_account"), ref("vpc_id", "dummy_vpc")],
    ),
    TemplateFixture(
        key="dummy_eks_namespace",
        name="Dummy EKS Namespace",
        labels=["dummy", "eks", "kubernetes", "namespace"],
        parents=["dummy_eks"],
        naming_convention="dummy-eks-namespace-{environment_name}-{region}-{namespace}",
        folder="dummy/07-eks-namespace/",
        version="eks-namespace-v1.0",
        variables=DUMMY_EKS_NAMESPACE_VARIABLES,
        outputs=DUMMY_EKS_NAMESPACE_OUTPUTS,
        references=[ref("account", "dummy_account"), ref("cluster_name", "dummy_eks")],
    ),
    TemplateFixture(
        key="dummy_eks_service_account",
        name="Dummy EKS Service Account",
        labels=["dummy", "eks", "kubernetes", "service_account"],
        # a service account belongs to a service
        parents=["dummy_eks_namespace", "service"],
        naming_convention="dummy-eks-sa-{environment_name}-{region}-{namespace}-{service_account_name}",
        folder="dummy/08-eks-service-account/",
        version="eks-service-account-v1.0",
        variables=DUMMY_EKS_SERVICE_ACCOUNT_VARIABLES,
        outputs=DUMMY_EKS_SERVICE_ACCOUNT_OUTPUTS,
        references=[
            ref("account", "dummy_account"),
            ref("cluster_name", "dummy_eks_namespace"),
            ref("namespace", "dummy_eks_namespace"),
            ref("oidc_provider_arn", "dummy_eks"),
            ref("oidc_issuer_url", "dummy_eks"),
        ],
    ),
    TemplateFixture(
        key="dummy_redis_iam",
        name="Dummy Redis IAM Credentials",
        labels=["dummy", "redis", "iam_credentials"],
        parents=["dummy_redis", "dummy_eks_service_account"],
        naming_convention="dummy-redis-iam-credentials-{environment_name}-{region}-{policy_name}",
        folder="dummy/04-redis-iam/",
        version="redis-iam-v1.0",
        variables=DUMMY_REDIS_IAM_VARIABLES,
        outputs=DUMMY_REDIS_IAM_OUTPUTS,
        references=[
            ref("account", "dummy_account"),
            ref("cluster_arn", "dummy_redis"),
            ref("iam_user_arn", "dummy_redis"),
            ref("redis_primary_endpoint", "dummy_redis"),
            ref("aws_iam_role_name", "dummy_eks_service_account", "iam_role_name"),
        ],
    ),
    TemplateFixture(
        key="dummy_rds_postgres_credentials",
        name="Dummy RDS PostgreSQL IAM Credentials",
        labels=["dummy", "rds", "postgres", "iam_credentials"],
        parents=["dummy_rds_postgres", "dummy_eks_service_account"],
        naming_convention="dummy-rds-postgres-credentials-{environment_name}-{region}-{policy_name}",
        folder="dummy/09-rds-postgres-credentials/",
        version="rds-postgres-credentials-v1.0",
        variables=DUMMY_RDS_POSTGRES_CREDENTIALS_VARIABLES,
        outputs=DUMMY_RDS_POSTGRES_CREDENTIALS_OUTPUTS,
        references=[
            ref("account", "dummy_account"),
            ref("aws_iam_role_name", "dummy_eks_service_account", "iam_role_name"),
            ref("db_instance_resource_id", "dummy_rds_postgres"),
            ref("db_instance_address", "dummy_rds_postgres"),
            ref("db_instance_port", "dummy_rds_postgres"),
            ref("db_name", "dummy_rds_postgres"),
        ],
    ),
]

TEMPLATES_BY_KEY: dict[str, TemplateFixture] = {t.key: t for t in TEMPLATES}
