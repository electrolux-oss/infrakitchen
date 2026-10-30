from dataclasses import dataclass
import re

from application.integrations.model import Integration
from application.resources.model import Resource
from core.constants.model import ModelState

ECR_REPOSITORY_RE = re.compile(
    r"^(?P<account>\d{12})\.dkr\.ecr\.(?P<region>[a-z0-9-]+)\.amazonaws\.com(?:\.cn)?/"
    r"(?P<name>[a-z0-9]+(?:[._/-][a-z0-9]+)*)$"
)

# In order of preference
REPOSITORY_URL_OUTPUTS = ("repository_url", "ecr_repository_url")


@dataclass(frozen=True)
class EcrRepository:
    url: str
    registry: str
    region: str
    name: str
    integration: Integration


def get_ecr_repository(resource: Resource) -> EcrRepository:
    if resource.state != ModelState.PROVISIONED:
        raise ValueError(f"The image repository resource {resource.name} is not provisioned")

    outputs = {output.get("name"): output.get("value") for output in resource.outputs or []}
    output_name = next((name for name in REPOSITORY_URL_OUTPUTS if outputs.get(name)), None)
    if output_name is None:
        raise ValueError(
            f"The image repository resource {resource.name} has no {' or '.join(REPOSITORY_URL_OUTPUTS)} output"
        )
    url = outputs[output_name]
    match = ECR_REPOSITORY_RE.match(url) if isinstance(url, str) else None
    if not match:
        raise ValueError(f"{output_name} of {resource.name} is not an ECR repository URI: {url}")

    integration = next((i for i in resource.integration_ids if i.integration_provider == "aws"), None)
    if integration is None:
        raise ValueError(f"The image repository resource {resource.name} has no AWS integration")

    return EcrRepository(
        url=url,
        registry=url.split("/", 1)[0],
        region=match.group("region"),
        name=match.group("name"),
        integration=integration,
    )
