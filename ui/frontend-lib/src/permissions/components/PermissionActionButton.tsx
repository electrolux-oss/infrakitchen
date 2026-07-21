import { useState } from "react";

import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import {
  Button,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  Stack,
} from "@mui/material";

import { useConfig } from "../../common";
import { notifyError } from "../../common/hooks/useNotification";
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
        title={`Delete Permission`}
        onClick={handleOpenDialog}
        color="error"
        size="small"
      >
        <DeleteIcon fontSize="small" />
      </IconButton>

      <Dialog
        open={openDialog}
        onClose={handleCloseDialog}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle
          id="alert-dialog-title"
          sx={{ color: "error.main", fontWeight: "bold" }}
        >
          {"Confirm Deletion"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to permanently delete? This action cannot be
            undone.
          </DialogContentText>
          {enableCascadeDelete && (
            <DialogContentText sx={{ mt: 2 }}>
              Cascade delete will also remove matching child resource policies
              inherited from this policy.
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="inherit"
              onClick={handleCloseDialog}
              startIcon={<CloseIcon />}
              disabled={isLoading}
              sx={{ textTransform: "none", fontWeight: "bold" }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleDeletePermission}
              startIcon={
                isLoading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <CheckIcon />
                )
              }
              disabled={isLoading}
              sx={{ textTransform: "none", fontWeight: "bold" }}
            >
              {isLoading ? "Deleting..." : "Delete"}
            </Button>
            {enableCascadeDelete && (
              <Button
                variant="contained"
                color="error"
                onClick={handleCascadeDeletePermission}
                startIcon={
                  isLoading ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <DeleteForeverIcon />
                  )
                }
                disabled={isLoading}
                sx={{ textTransform: "none", fontWeight: "bold" }}
              >
                {isLoading ? "Deleting..." : "Cascade Delete"}
              </Button>
            )}
          </Stack>
        </DialogActions>
      </Dialog>
    </>
  );
};
