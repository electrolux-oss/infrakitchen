import { useId } from "react";

import { Button } from "@mui/material";

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
  const formId = useId();

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      actions={
        <Button type="submit" form={formId} variant="contained" color="primary">
          Submit
        </Button>
      }
      title="Create Role Policy"
      content={<EntityRolePolicyCreateCard {...props} formId={formId} />}
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
  const formId = useId();

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Create Resource Policy"
      actions={
        <Button type="submit" form={formId} variant="contained" color="primary">
          Submit
        </Button>
      }
      content={
        <EntityRolePolicyCreateCard
          role_name={role_name}
          onClose={onClose}
          formId={formId}
        />
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
  const formId = useId();

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Create User Policy"
      actions={
        <Button type="submit" form={formId} variant="contained" color="primary">
          Submit
        </Button>
      }
      content={
        <EntityUserPolicyCreateCard
          user_id={user_id}
          onClose={onClose}
          formId={formId}
        />
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
  const formId = useId();

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Create User Policy"
      actions={
        <Button type="submit" form={formId} variant="contained" color="primary">
          Submit
        </Button>
      }
      content={
        <EntityUserPolicyCreateCard
          entity_id={entity_id}
          entity_name={entity_name}
          onClose={onClose}
          formId={formId}
        />
      }
    />
  );
};
