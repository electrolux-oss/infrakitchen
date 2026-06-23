from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from application.batch_operations.dependencies import get_batch_operation_service
from application.batch_operations.schema import BatchOperationCreate
from application.resources.model import Resource
from application.templates.dependencies import get_template_service
from core.users.model import UserDTO


async def insert_batch_operations(session: AsyncSession, envs: list[str], user: UserDTO):
    template_service = get_template_service(session=session)
    batch_operation_service = get_batch_operation_service(session=session)

    templates = await template_service.get_all(filter={"template": "aws_redis_iam"})
    if not templates:
        raise Exception("Required template not found")
    template = templates[0]

    for env in envs:
        query = select(Resource).where(
            Resource.name.ilike(f"%{env.capitalize()}%"),
            Resource.template_id == template.id,
        )
        result = await session.execute(query)
        resources = result.scalars().all()
        create_batch_operation = BatchOperationCreate(
            name=f"Batch Operation for {template.template} in {env}",
            description=f"Batch operation for {env} environment",
            entity_ids=[resource.id for resource in resources],
            entity_type="resource",
        )
        await batch_operation_service.create_batch_operation(create_batch_operation, user)
        await session.commit()
