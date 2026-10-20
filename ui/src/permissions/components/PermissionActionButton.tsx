import { useState } from "react";

import { useConfig } from "../../common";
import { deleteIconButtonClass } from "../../common/components/buttons/deleteIconButtonClass";
import { notifyError } from "../../common/hooks/useNotification";
import { HeroCheckIcon } from "../../icons";
import { HeroTrashIcon } from "../../icons";
import { HeroXMarkIcon } from "../../icons";
import {
  Spinner,
  Button,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "../../ui";
import {
  CASCADE_DELETE_PERMISSION_MUTATION,
  DELETE_PERMISSION_MUTATION,
} from "../graphql/mutations";

interface DeletePermissionActionButtonProps {
  permission_id: string;
  onDelete?: () => void;
  enableCascadeDelete?: boolean;
}

export const DeletePermissionButton = (
  props: DeletePermissionActionButtonProps,
) => {
  const { permission_id, onDelete, enableCascadeDelete = false } = props;
  const { ikApi } = useConfig();

  const [openDialog, setOpenDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    if (!isLoading) {
      setOpenDialog(false);
    }
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
        setOpenDialog(false);
      })
      .catch((error) => {
        notifyError(error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleCascadeDeletePermission = () => {
    if (!permission_id) {
      notifyError(new Error("Permission ID is required to delete."));
      return;
    }

    setIsLoading(true);
    ikApi
      .graphqlRequest<{ cascadeDeletePermission: boolean }>(
        CASCADE_DELETE_PERMISSION_MUTATION,
        { id: permission_id },
      )
      .then(() => {
        if (onDelete) {
          onDelete();
        }
        setOpenDialog(false);
      })
      .catch((error) => {
        notifyError(error);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  return (
    <>
      <IconButton
        title={`Delete`}
        onClick={handleOpenDialog}
        size="small"
        className={deleteIconButtonClass}
      >
        <HeroTrashIcon fontSize="small" />
      </IconButton>

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle className="font-bold text-error" id="alert-dialog-title">
          {"Confirm Deletion"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete this? This action cannot be undone.
          </DialogContentText>
          {enableCascadeDelete && (
            <DialogContentText className="mt-4">
              Cascade delete will also remove matching child resource policies
              inherited from this policy.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions className="p-4 pt-0">
          <div className="flex flex-row gap-2">
            <Button
              className="font-bold normal-case"
              color="inherit"
              onClick={handleCloseDialog}
              startIcon={<HeroXMarkIcon />}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              className="font-bold normal-case"
              variant="contained"
              color="error"
              onClick={handleDeletePermission}
              startIcon={
                isLoading ? (
                  <Spinner size={20} color="inherit" />
                ) : (
                  <HeroCheckIcon />
                )
              }
              disabled={isLoading}
            >
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
            {enableCascadeDelete && (
              <Button
                className="font-bold normal-case"
                variant="contained"
                color="error"
                onClick={handleCascadeDeletePermission}
                startIcon={
                  isLoading ? (
                    <Spinner size={20} color="inherit" />
                  ) : (
                    <HeroTrashIcon />
                  )
                }
                disabled={isLoading}
              >
                {isLoading ? "Deleting..." : "Cascade Delete"}
              </Button>
            )}
          </div>
        </DialogActions>
      </Dialog>
    </>
  );
};
