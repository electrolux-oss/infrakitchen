import pytest
from unittest.mock import Mock

from uuid import uuid4
from core.constants.model import ModelActions
from core.errors import EntityExistsError, EntityNotFound
from core.permissions.schema import ApiPolicyCreate, EntityPolicyCreate, PermissionResponse

ROLE_NAME = "test_role"


class TestGetMethods:
    @pytest.mark.asyncio
    async def test_get_by_id_success(self, mock_permission_service, mock_permission_crud, mocked_role_permission):
        permission_id = str(mocked_role_permission.id)
        mock_permission_crud.get_by_id.return_value = mocked_role_permission

        result = await mock_permission_service.get_by_id(permission_id)

        assert isinstance(result, PermissionResponse)
        assert str(result.id) == permission_id
        mock_permission_crud.get_by_id.assert_awaited_once_with(permission_id)

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_permission_service, mock_permission_crud):
        mock_permission_crud.get_by_id.return_value = None
        result = await mock_permission_service.get_by_id(str(uuid4()))

        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_id_invalid_uuid(self, mock_permission_service):
        with pytest.raises(ValueError, match="Invalid UUID format"):
            await mock_permission_service.get_by_id("not-a-uuid")

    @pytest.mark.asyncio
    async def test_get_all_success(self, mock_permission_service, mock_permission_crud, mocked_role_permission):
        mock_permission_crud.get_all.return_value = [mocked_role_permission]

        result = await mock_permission_service.get_all(range=(0, 10))

        assert len(result) == 1
        assert isinstance(result[0], PermissionResponse)
        mock_permission_crud.get_all.assert_awaited_once_with(range=(0, 10))

    @pytest.mark.asyncio
    async def test_count(self, mock_permission_service, mock_permission_crud):
        mock_permission_crud.count.return_value = 50
        filter_data = {"v0": "user:123"}

        result = await mock_permission_service.count(filter=filter_data)

        assert result == 50
        mock_permission_crud.count.assert_awaited_once_with(filter=filter_data)

    @pytest.mark.asyncio
    async def test_count_roles(self, mock_permission_service, mock_permission_crud):
        mock_permission_crud.count_roles.return_value = 10

        result = await mock_permission_service.count_roles()

        assert result == 10
        mock_permission_crud.count_roles.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_all_roles_success(self, mock_permission_service, mock_permission_crud, mocked_role_permission):
        mock_permission_crud.get_all_roles.return_value = [mocked_role_permission]

        result = await mock_permission_service.get_all_roles(range=(0, 5))

        assert len(result) == 1
        assert result[0].ptype == "g"
        mock_permission_crud.get_all_roles.assert_awaited_once_with(filter=None, range=(0, 5))


class TestRoleCreation:
    NEW_ROLE_NAME = "new_role"
    USER_ID = uuid4()

    @pytest.mark.asyncio
    async def test_create_role_success(
        self,
        mock_permission_service,
        mock_permission_crud,
        mocked_role_permission,
        mock_user_crud,
        mock_casbin,
        mock_audit_log_handler,
        mocked_user,
        mock_user_dto,
    ):
        mock_permission_crud.get_all.return_value = []  # Role does not exist
        mock_user_crud.get_by_id.return_value = mocked_user
        mock_permission_crud.create.return_value = mocked_role_permission
        mocked_role_permission.v1 = self.NEW_ROLE_NAME
        mock_permission_crud.get_by_id.return_value = mocked_role_permission

        result = await mock_permission_service.create_role(self.NEW_ROLE_NAME, mocked_user.id, requester=mock_user_dto)

        assert isinstance(result, PermissionResponse)
        assert result.v1 == self.NEW_ROLE_NAME
        assert result.v0 == f"user:{mocked_user.id}"

        mock_permission_crud.get_all.assert_awaited_once()
        mock_user_crud.get_by_id.assert_awaited_once()
        mock_permission_crud.create.assert_awaited_once()
        mock_audit_log_handler.create_log.assert_awaited_once()
        mock_casbin.send_reload_event.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_role_invalid_name(self, mock_permission_service):
        with pytest.raises(ValueError, match=r"Role name must be a string of lowercase letters and \(_\)"):
            await mock_permission_service.create_role("Invalid-Role", self.USER_ID)

    @pytest.mark.asyncio
    async def test_create_role_exists(self, mock_permission_service, mock_permission_crud, mocked_role_permission):
        mock_permission_crud.get_all.return_value = [mocked_role_permission]  # Role exists

        with pytest.raises(EntityExistsError, match=f"Role {self.NEW_ROLE_NAME} already exists"):
            await mock_permission_service.create_role(self.NEW_ROLE_NAME, self.USER_ID)

    @pytest.mark.asyncio
    async def test_create_role_user_not_found(self, mock_permission_service, mock_permission_crud, mock_user_crud):
        mock_permission_crud.get_all.return_value = []
        mock_user_crud.get_by_id.return_value = None  # User not found

        with pytest.raises(EntityNotFound, match="User not found"):
            await mock_permission_service.create_role(self.NEW_ROLE_NAME, self.USER_ID)

    @pytest.mark.asyncio
    async def test_create_role_no_reload(
        self,
        mock_permission_service,
        mock_permission_crud,
        mocked_role_permission,
        mock_user_crud,
        mock_casbin,
        mock_user_dto,
    ):
        mock_permission_crud.get_all.return_value = []
        mock_user_crud.get_by_id.return_value = mock_user_dto
        mock_permission_crud.create.return_value = mocked_role_permission
        mock_permission_crud.get_by_id.return_value = mock_permission_crud.create.return_value

        await mock_permission_service.create_role(
            self.NEW_ROLE_NAME, self.USER_ID, requester=mock_user_dto, reload_permission=False
        )

        mock_casbin.send_reload_event.assert_not_awaited()


class TestUserRoleAssignment:
    ROLE_NAME = "assignable_role"
    USER_ID = uuid4()

    @pytest.mark.asyncio
    async def test_assign_user_to_role_success(
        self,
        mock_permission_service,
        mock_permission_crud,
        mock_user_crud,
        mock_audit_log_handler,
        mock_user_dto,
        mocked_user,
        mocked_role_permission,
    ):
        # Setup mocks for success
        mock_permission_crud.get_all.side_effect = [
            [],
            [mocked_role_permission],
        ]  # 1. Assignment does not exist, 2. Role exists
        mock_user_crud.get_by_id.return_value = mocked_user
        mock_permission_crud.create.return_value = Mock(id=uuid4())
        mocked_role_permission.v1 = self.ROLE_NAME
        mock_permission_crud.get_by_id.return_value = mocked_role_permission

        result = await mock_permission_service.assign_user_to_role(
            self.ROLE_NAME, self.USER_ID, requester=mock_user_dto
        )

        assert isinstance(result, PermissionResponse)
        assert result.v1 == self.ROLE_NAME
        assert result.v0 == f"user:{mock_user_dto.id}"

        assert mock_permission_crud.get_all.call_count == 2
        mock_audit_log_handler.create_log.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_assign_user_to_role_invalid_name(self, mock_permission_service):
        with pytest.raises(ValueError, match=r"Role name must be a string of lowercase letters and \(_\)"):
            await mock_permission_service.assign_user_to_role("Invalid-Role", self.USER_ID)

    @pytest.mark.asyncio
    async def test_assign_user_to_role_already_assigned(self, mock_permission_service, mock_permission_crud):
        mock_permission_crud.get_all.return_value = [Mock()]  # Assignment exists

        with pytest.raises(EntityExistsError, match="is already assigned to role"):
            await mock_permission_service.assign_user_to_role(self.ROLE_NAME, self.USER_ID)

    @pytest.mark.asyncio
    async def test_assign_user_to_role_user_not_found(
        self, mock_permission_service, mock_permission_crud, mock_user_crud
    ):
        mock_permission_crud.get_all.return_value = []
        mock_user_crud.get_by_id.return_value = None  # User not found

        with pytest.raises(EntityNotFound, match="User not found"):
            await mock_permission_service.assign_user_to_role(self.ROLE_NAME, self.USER_ID)

    @pytest.mark.asyncio
    async def test_assign_user_to_role_role_not_found(
        self, mock_permission_service, mock_permission_crud, mock_user_crud, mocked_user
    ):
        mock_permission_crud.get_all.side_effect = [[], []]  # 1. No assignment, 2. No role
        mock_user_crud.get_by_id.return_value = mocked_user

        with pytest.raises(EntityNotFound, match="Role assignable_role not found"):
            await mock_permission_service.assign_user_to_role(self.ROLE_NAME, self.USER_ID)


class TestDeletePermission:
    PERMISSION_ID = uuid4()

    @pytest.mark.asyncio
    async def test_delete_success(
        self,
        mock_permission_service,
        mock_permission_crud,
        mock_casbin,
        mock_audit_log_handler,
        mock_user_dto,
        mocked_role_permission,
    ):
        mocked_role_permission.id = self.PERMISSION_ID
        mock_permission_crud.get_by_id.return_value = mocked_role_permission

        await mock_permission_service.delete(str(self.PERMISSION_ID), mock_user_dto)

        mock_permission_crud.get_by_id.assert_awaited_once_with(str(self.PERMISSION_ID))
        mock_permission_crud.delete.assert_awaited_once()
        mock_casbin.send_reload_event.assert_awaited_once()
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            self.PERMISSION_ID, mock_user_dto.id, ModelActions.DELETE
        )

    @pytest.mark.asyncio
    async def test_delete_not_found(self, mock_permission_service, mock_permission_crud, mock_user_dto):
        mock_permission_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Permission not found"):
            await mock_permission_service.delete(str(self.PERMISSION_ID), mock_user_dto)

    @pytest.mark.asyncio
    async def test_delete_entity_permissions_success(self, mock_permission_service, mock_permission_crud):
        ENTITY_NAME = "project"
        ENTITY_ID = uuid4()

        await mock_permission_service.delete_entity_permissions(ENTITY_NAME, ENTITY_ID)

        mock_permission_crud.delete_entity_permissions.assert_awaited_once_with(ENTITY_NAME, ENTITY_ID)


class TestPolicyCreation:
    @pytest.mark.asyncio
    async def test_create_api_policy_success(
        self, mock_permission_service, mock_permission_crud, mock_casbin, mock_user_dto, mocked_role_permission
    ):
        mocked_role_permission.v0 = "admin"
        mocked_role_permission.v1 = "api:project"
        body = ApiPolicyCreate(role="admin", api="project", action="admin")
        mock_permission_crud.get_all.return_value = []
        mock_permission_crud.create.return_value = Mock(id=uuid4())
        mock_permission_crud.get_by_id.return_value = mocked_role_permission

        result = await mock_permission_service.create_api_policy(body, requester=mock_user_dto)

        assert isinstance(result, PermissionResponse)
        assert result.v0 == "admin"
        assert result.v1 == "api:project"
        mock_casbin.send_reload_event.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_api_policy_exists(self, mock_permission_service, mock_permission_crud):
        body = ApiPolicyCreate(role="admin", api="project", action="admin")
        mock_permission_crud.get_all.return_value = [Mock()]

        with pytest.raises(EntityExistsError, match="Api policy for project already exists"):
            await mock_permission_service.create_api_policy(body)

    # --- Entity Policy Tests ---

    @pytest.mark.asyncio
    async def test_create_entity_policy_by_role_success(
        self, mock_permission_service, mock_permission_crud, mock_user_dto, mocked_role_permission
    ):
        body = EntityPolicyCreate(role="project_admin", entity_name="resource", entity_id=uuid4(), action="write")

        mocked_role_permission.v0 = "project_admin"
        mocked_role_permission.v1 = f"{body.entity_name}:{body.entity_id}".lower()
        # Mocks: 1. Policy check (returns []), 2. Role check (returns [Mock()])
        mock_permission_crud.get_all.side_effect = [[], [mocked_role_permission]]
        mock_permission_crud.create.return_value = mocked_role_permission
        mock_permission_crud.get_by_id.return_value = mocked_role_permission

        result = await mock_permission_service.create_entity_policy(body, requester=mock_user_dto)

        assert isinstance(result, PermissionResponse)
        assert result.v0 == body.role
        assert result.v1 == f"{body.entity_name}:{body.entity_id}".lower()
        assert mock_permission_crud.get_all.call_count == 2  # Checking for existing policy and existing role

    @pytest.mark.asyncio
    async def test_create_entity_policy_by_user_success(
        self,
        mock_permission_service,
        mock_permission_crud,
        mock_user_crud,
        mock_user_dto,
        mocked_user,
        mocked_role_permission,
    ):
        body = EntityPolicyCreate(user_id=uuid4(), entity_name="resource", entity_id=uuid4(), action="write")

        mock_permission_crud.get_all.return_value = []  # Policy check
        mock_user_crud.get_by_id.return_value = mocked_user  # User found
        mock_permission_crud.create.return_value = Mock(id=uuid4())
        mock_permission_crud.get_by_id.return_value = mocked_role_permission

        result = await mock_permission_service.create_entity_policy(body, requester=mock_user_dto)

        assert isinstance(result, PermissionResponse)
        assert result.v0 == f"user:{mock_user_dto.id}"
        mock_user_crud.get_by_id.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_entity_policy_already_exists(
        self, mock_permission_service, mock_permission_crud, mock_user_dto
    ):
        body = EntityPolicyCreate(role="project_admin", entity_name="resource", entity_id=uuid4(), action="write")
        mock_permission_crud.get_all.return_value = [Mock()]  # Policy already exists

        with pytest.raises(EntityExistsError, match="Policy already exists"):
            await mock_permission_service.create_entity_policy(body, requester=mock_user_dto)

    @pytest.mark.asyncio
    async def test_create_entity_policy_role_not_found(
        self, mock_permission_service, mock_permission_crud, mock_user_dto
    ):
        body = EntityPolicyCreate(role="non_existent_role", entity_name="resource", entity_id=uuid4(), action="write")
        mock_permission_crud.get_all.side_effect = [[], []]  # 1. No policy, 2. No role

        with pytest.raises(EntityNotFound, match="Role non_existent_role not found"):
            await mock_permission_service.create_entity_policy(body, requester=mock_user_dto)

    @pytest.mark.asyncio
    async def test_create_entity_policy_user_not_found(
        self, mock_permission_service, mock_permission_crud, mock_user_crud, mock_user_dto
    ):
        body = EntityPolicyCreate(user_id=uuid4(), entity_name="resource", entity_id=uuid4(), action="write")
        mock_permission_crud.get_all.return_value = []
        mock_user_crud.get_by_id.return_value = None  # User not found

        with pytest.raises(EntityNotFound, match="User not found"):
            await mock_permission_service.create_entity_policy(body, requester=mock_user_dto)
