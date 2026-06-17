import { useId } from "react";

import { Button } from "@mui/material";

import { CommonDialog } from "../../../common";

import { EntityRolePolicyCreateCard } from "./EntityRolePoliciesCreateCard";
import { EntityUserPolicyCreateCard } from "./EntityUserPolicyCreateCard";

interface EntityPolicyRoleCreateDialogProps {
  entityId: string;
  entityName: string;
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
      actions={
        <Button type="submit" form={formId} variant="contained" color="primary">
          Submit
        </Button>
      }
      open={open}
      onClose={onClose}
      title="Create Role Policy"
      content={<EntityRolePolicyCreateCard {...props} formId={formId} />}
    />
  );
};

interface RolePolicyEntityCreateDialogProps {
  roleName: string;
  open: boolean;
  onClose: () => void;
}

export const RolePolicyEntityCreateDialog = (
  props: RolePolicyEntityCreateDialogProps,
) => {
  const { roleName, onClose, open } = props;
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
          roleName={roleName}
          onClose={onClose}
          formId={formId}
        />
      }
    />
  );
};

interface EntityPolicyUserCreateDialogProps {
  userId: string;
  open: boolean;
  onClose: () => void;
}

export const EntityPolicyUserCreateDialog = (
  props: EntityPolicyUserCreateDialogProps,
) => {
  const { userId, onClose, open } = props;
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
          userId={userId}
          onClose={onClose}
          formId={formId}
        />
      }
    />
  );
};

interface UserPolicyEntityCreateDialogProps {
  entityId: string;
  entityName: string;
  open: boolean;
  onClose: () => void;
}

export const UserPolicyEntityCreateDialog = (
  props: UserPolicyEntityCreateDialogProps,
) => {
  const { entityName, entityId, onClose, open } = props;
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
          entityId={entityId}
          entityName={entityName}
          onClose={onClose}
          formId={formId}
        />
      }
    />
  );
};
