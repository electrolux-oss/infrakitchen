import { CommonDialog } from "../../../common";

import { EntityRolePolicyCreateCard } from "./EntityRolePoliciesCreateCard";
import { EntityUserPolicyCreateCard } from "./EntityUserPolicyCreateCard";

interface EntityPolicyRoleCreateDialogProps {
  entity_id: string;
  entity_name: string;
  open: boolean;
  onClose: () => void;
}

export const EntityPolicyRoleCreateDialog = (
  props: EntityPolicyRoleCreateDialogProps,
) => {
  const { onClose, open } = props;

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Create Role Policy"
      content={<EntityRolePolicyCreateCard {...props} />}
    />
  );
};

interface RolePolicyEntityCreateDialogProps {
  role_name: string;
  open: boolean;
  onClose: () => void;
}

export const RolePolicyEntityCreateDialog = (
  props: RolePolicyEntityCreateDialogProps,
) => {
  const { role_name, onClose, open } = props;

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Create Resource Policy"
      content={
        <EntityRolePolicyCreateCard role_name={role_name} onClose={onClose} />
      }
    />
  );
};

interface EntityPolicyUserCreateDialogProps {
  user_id: string;
  open: boolean;
  onClose: () => void;
}

export const EntityPolicyUserCreateDialog = (
  props: EntityPolicyUserCreateDialogProps,
) => {
  const { user_id, onClose, open } = props;

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Create User Policy"
      content={
        <EntityUserPolicyCreateCard user_id={user_id} onClose={onClose} />
      }
    />
  );
};

interface UserPolicyEntityCreateDialogProps {
  entity_id: string;
  entity_name: string;
  open: boolean;
  onClose: () => void;
}

export const UserPolicyEntityCreateDialog = (
  props: UserPolicyEntityCreateDialogProps,
) => {
  const { entity_name, entity_id, onClose, open } = props;

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Create User Policy"
      content={
        <EntityUserPolicyCreateCard
          entity_id={entity_id}
          entity_name={entity_name}
          onClose={onClose}
        />
      }
    />
  );
};
