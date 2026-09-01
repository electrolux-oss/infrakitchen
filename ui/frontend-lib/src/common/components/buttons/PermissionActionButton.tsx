import { useState } from "react";

import { Icon } from "@iconify/react";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { Button, IconButton, Stack } from "@mui/material";

import { DELETE_PERMISSION_MUTATION } from "../../../permissions/graphql/mutations";
import { useConfig } from "../../context";
import { notifyError } from "../../hooks/useNotification";

interface DeletePermissionButtonProps {
  permission_id: string;
  onDelete?: () => void;
}

export const PermissionActionButton = (props: DeletePermissionButtonProps) => {
  const { permission_id, onDelete } = props;
  const { ikApi, linkPrefix } = useConfig();

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleInitiateDeleteConfirmation = () => {
    setIsConfirmingDelete(true);
  };

  const handleCancelDelete = () => {
    setIsConfirmingDelete(false);
  };

  const handleDeletePermission = () => {
    if (!permission_id) {
      notifyError(new Error("Permission ID is required to delete."));
      return;
    }

    setIsLoading(true);
    ikApi
      .graphqlRequest<{ deletePermission: boolean }>(
        DELETE_PERMISSION_MUTATION,
        { id: permission_id },
      )
      .then(() => {
        if (onDelete) {
          onDelete();
        }
      })
      .catch((error) => {
        notifyError(error);
        setIsLoading(false);
      });
  };

  return (
    <>
      {isConfirmingDelete ? (
        <Stack direction="row" spacing={1}>
          <Button
            color="success"
            startIcon={<CheckIcon />}
            onClick={() => handleDeletePermission()}
            sx={{ textTransform: "none", fontWeight: "bold" }}
            disabled={isLoading}
          >
            Approve
          </Button>
          <Button
            color="error"
            startIcon={<CloseIcon />}
            onClick={handleCancelDelete}
            sx={{ textTransform: "none", fontWeight: "bold" }}
            disabled={isLoading}
          >
            Cancel
          </Button>
        </Stack>
      ) : (
        <>
          <IconButton
            size="small"
            title="Link to Permission"
            href={`${linkPrefix}permissions/${permission_id}`}
          >
            <Icon icon="quill:link-out" />
          </IconButton>
          <IconButton
            size="small"
            title="Delete Permission"
            onClick={handleInitiateDeleteConfirmation}
          >
            <Icon icon="ep:delete" />
          </IconButton>
        </>
      )}
    </>
  );
};
