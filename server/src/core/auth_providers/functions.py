from core.constants.model import ModelActions
from core.users.functions import user_is_super_admin
from core.users.model import UserDTO


async def get_auth_provider_actions(requester: UserDTO) -> list[str]:
    if await user_is_super_admin(requester) is False:
        return []
    return [ModelActions.EDIT, ModelActions.DELETE]
