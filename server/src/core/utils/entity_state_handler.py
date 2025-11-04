from core.base_models import BaseEntity
from core.config import InfrakitchenConfig
from core.constants.model import ModelState, ModelStatus
from core.errors import EntityWrongState


async def reject_entity(entity_instance: BaseEntity):
    if entity_instance.state == ModelState.PROVISION:
        # initial state for entity
        entity_instance.status = ModelStatus.REJECTED

    elif entity_instance.state == ModelState.DESTROY:
        # destroy reject return to the previous state provisioned
        entity_instance.status = ModelStatus.DONE
        entity_instance.state = ModelState.PROVISIONED


async def approve_entity(entity_instance: BaseEntity, abstract: bool = False):
    if abstract is True and entity_instance.state in [
        ModelState.PROVISION,
        ModelState.PROVISIONED,
    ]:
        entity_instance.status = ModelStatus.DONE
        entity_instance.state = ModelState.PROVISIONED
    elif abstract is True and entity_instance.state == ModelState.DESTROY:
        entity_instance.status = ModelStatus.DONE
        entity_instance.state = ModelState.DESTROYED
    elif abstract is not True:
        entity_instance.status = ModelStatus.READY
    else:
        raise ValueError(f"Entity cannot be approved, has wrong state {entity_instance.state}")


async def destroy_entity(entity_instance: BaseEntity):
    def can_be_destroyed():
        if entity_instance.state == ModelState.PROVISIONED:
            return True

        if entity_instance.status == ModelStatus.ERROR and entity_instance.state == ModelState.PROVISION:
            return True

        return False

    if can_be_destroyed() is False:
        raise ValueError(f"Entity cannot be destroyed, has wrong state {entity_instance.state}")

    if InfrakitchenConfig().approval_flow is True:
        entity_instance.status = ModelStatus.APPROVAL_PENDING
    else:
        entity_instance.status = ModelStatus.READY
    entity_instance.state = ModelState.DESTROY


async def delete_entity(entity_instance: BaseEntity):
    def can_be_deleted():
        if entity_instance.status == ModelStatus.DONE and entity_instance.state == ModelState.DESTROYED:
            return True

        if (
            entity_instance.status in [ModelStatus.READY, ModelStatus.REJECTED, ModelStatus.APPROVAL_PENDING]
            and entity_instance.state == ModelState.PROVISION
        ):
            return True

        return False

    if can_be_deleted() is False:
        raise ValueError(f"Entity has wrong state for deletion {entity_instance.state}")


async def execute_entity(entity_instance: BaseEntity):
    def can_be_executed():
        if entity_instance.status == ModelStatus.READY:
            return True

        if entity_instance.status == ModelStatus.ERROR and (
            entity_instance.state == ModelState.PROVISION
            or entity_instance.state == ModelState.DESTROY
            or entity_instance.state == ModelState.PROVISIONED
        ):
            return True

        if entity_instance.status == ModelStatus.DONE and entity_instance.state == ModelState.PROVISIONED:
            return True

        return False

    if can_be_executed() is False:
        raise EntityWrongState(
            f"Entity cannot be executed, has wrong state {entity_instance.state} or status {entity_instance.status}"
        )
    entity_instance.status = ModelStatus.QUEUED


async def recreate_entity(entity_instance: BaseEntity, is_resource: bool = True):
    def can_be_recreated():
        if entity_instance.status == ModelStatus.DONE and entity_instance.state == ModelState.DESTROYED:
            return True

        if entity_instance.status == ModelStatus.REJECTED:
            return True

        if entity_instance.status == ModelStatus.READY and entity_instance.state == ModelState.DESTROY:
            return True

        return False

    if can_be_recreated() is False:
        raise EntityWrongState(
            f"Entity cannot be recreated, has wrong state {entity_instance.state} or status {entity_instance.status}"
        )

    if entity_instance.state == ModelState.PROVISION and entity_instance.status == ModelStatus.REJECTED:
        if InfrakitchenConfig().approval_flow is True and is_resource is True:
            entity_instance.status = ModelStatus.APPROVAL_PENDING
        else:
            entity_instance.status = ModelStatus.READY

    elif entity_instance.state == ModelState.DESTROY and entity_instance.status == ModelStatus.READY:
        entity_instance.status = ModelStatus.READY
        entity_instance.state = ModelState.PROVISIONED
    elif entity_instance.state == ModelState.DESTROYED and entity_instance.status == ModelStatus.DONE:
        if InfrakitchenConfig().approval_flow is True and is_resource is True:
            entity_instance.status = ModelStatus.APPROVAL_PENDING
        else:
            entity_instance.status = ModelStatus.READY
        entity_instance.state = ModelState.PROVISION
    else:
        raise EntityWrongState(f"Entity cannot be recreated, has wrong state {entity_instance.state}")


# Automation
def make_failed(entity_instance: BaseEntity) -> None:
    if entity_instance.state == ModelState.DESTROYED:
        return None
    entity_instance.status = ModelStatus.ERROR


def make_retry(entity_instance: BaseEntity):
    if entity_instance.status == ModelStatus.IN_PROGRESS:
        entity_instance.status = ModelStatus.ERROR


def make_in_progress(entity_instance: BaseEntity):
    if entity_instance.status == ModelStatus.READY:
        entity_instance.status = ModelStatus.IN_PROGRESS
    elif entity_instance.status == ModelStatus.ERROR:
        entity_instance.status = ModelStatus.IN_PROGRESS
    elif entity_instance.status == ModelStatus.DONE:
        entity_instance.status = ModelStatus.IN_PROGRESS
    elif entity_instance.status == ModelStatus.QUEUED:
        entity_instance.status = ModelStatus.IN_PROGRESS


def make_done(entity_instance: BaseEntity):
    if entity_instance.status == ModelStatus.IN_PROGRESS:
        entity_instance.status = ModelStatus.DONE

    if entity_instance.state == ModelState.DESTROY:
        entity_instance.state = ModelState.DESTROYED
    elif entity_instance.state == ModelState.PROVISION:
        entity_instance.state = ModelState.PROVISIONED


def is_in_progress(entity_instance: BaseEntity) -> bool:
    if entity_instance.status == ModelStatus.IN_PROGRESS:
        return True
    return False
