import { useState } from "react";

import { useNavigate } from "react-router";

import DeleteForeverIcon from "@mui/icons-material/DeleteForever";
import WarningIcon from "@mui/icons-material/Warning";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardHeader,
  Typography,
} from "@mui/material";

import { CASCADE_DESTROY_RESOURCE_MUTATION } from "../../resources/graphql";
import { ENTITY_ACTION } from "../../utils";
import { useConfig } from "../context";
import { useEntityProvider } from "../context/EntityContext";
import { notify, notifyError } from "../hooks/useNotification";

import { ActionButton } from "./buttons/ActionButton";
import { DeleteButton } from "./buttons/DeleteEntityButton";
import { CascadeDestroyDialog } from "./CascadeDestroyDialog";
import { CommonDialog } from "./CommonDialog";
import { ConfirmNameField } from "./ConfirmNameField";

export const DangerZoneCard = () => {
  const { ikApi, linkPrefix } = useConfig();
  const { actions, entity } = useEntityProvider();
  const [destroyConfirm, setDestroyConfirm] = useState("");
  const [dialogValues, setDialogValues] = useState<{
    [key: string]: boolean;
  }>({
    destroy: false,
    delete: false,
    disable: false,
    cascade_destroy: false,
  });
  const [cascadeDestroyLoading, setCascadeDestroyLoading] =
    useState<boolean>(false);

  const navigate = useNavigate();

  const changeDialog = async (dialog: string) => {
    setDialogValues((dialogValues) => {
      return { ...dialogValues, [dialog]: !dialogValues[dialog] as boolean };
    });
  };

  if (actions.length === 0) {
    return null;
  }

  if (!entity) {
    return null;
  }

  return (
    <Card
      sx={{
        border: `1px solid`,
        borderColor: "error.main",
        width: "100%",
      }}
    >
      <CardHeader
        title={
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 1,
            }}
          >
            <WarningIcon color="error" />
            <Typography color="error" variant="h5" component="h2">
              Danger Zone
            </Typography>
          </Box>
        }
        subheader={
          <Typography color="error">
            Irreversible and destructive actions.
          </Typography>
        }
      />
      <CardActions>
        {actions.includes("destroy") && (
          <Button
            variant="contained"
            color="error"
            onClick={() => changeDialog("destroy")}
          >
            Destroy
          </Button>
        )}
        {actions.includes("delete") && (
          <Button
            variant="contained"
            color="error"
            onClick={() => changeDialog("delete")}
          >
            Delete
          </Button>
        )}
        {actions.includes("disable") && (
          <Button
            variant="contained"
            color="error"
            onClick={() => changeDialog("disable")}
          >
            Disable
          </Button>
        )}
        {actions.includes(ENTITY_ACTION.CASCADE_DESTROY) && (
          <Button
            variant="contained"
            color="error"
            onClick={() => changeDialog("cascade_destroy")}
          >
            Cascade Destroy
          </Button>
        )}
      </CardActions>
      <CommonDialog
        maxWidth="sm"
        title={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <DeleteForeverIcon />
            <Typography variant="h6" component="span">
              Destroy
            </Typography>
          </Box>
        }
        open={dialogValues.destroy}
        onClose={() => changeDialog("destroy")}
        content={
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="warning" icon={<WarningAmberIcon />}>
              This will permanently destroy{" "}
              <strong>{entity.name || entity.identifier}</strong> and all
              associated infrastructure and data. This cannot be undone.
            </Alert>
            <ConfirmNameField
              name={entity.name || entity.identifier}
              value={destroyConfirm}
              onChange={setDestroyConfirm}
            />
          </Box>
        }
        actions={
          <ActionButton
            action={ENTITY_ACTION.DESTROY}
            onSubmit={() => changeDialog("destroy")}
            disabled={destroyConfirm !== (entity.name || entity.identifier)}
            color="error"
            variant="contained"
          >
            Destroy
          </ActionButton>
        }
      />
      <CommonDialog
        maxWidth="xs"
        title={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <WarningIcon color="error" />
            <Typography variant="h6" component="span">
              Confirmation
            </Typography>
          </Box>
        }
        open={dialogValues.delete}
        onClose={() => changeDialog("delete")}
        content={
          <>
            Are you sure you want to delete{" "}
            <mark>
              <code>{entity.name || entity.identifier}</code>
            </mark>
            ?
          </>
        }
        actions={
          <DeleteButton
            onClose={() => changeDialog("delete")}
            onDelete={() => navigate(`${linkPrefix}/${entity._entity_name}s`)}
            ikApi={ikApi}
            entity_name={entity._entity_name}
            entity_id={entity.id}
          >
            Delete
          </DeleteButton>
        }
      />
      <CommonDialog
        maxWidth="xs"
        title={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <WarningIcon color="error" />
            <Typography variant="h6" component="span">
              Confirmation
            </Typography>
          </Box>
        }
        open={dialogValues.disable}
        onClose={() => changeDialog("disable")}
        content={
          <>
            Are you sure you want to disable{" "}
            <mark>
              <code>{entity.name || entity.identifier}</code>
            </mark>
            ?
          </>
        }
        actions={
          <ActionButton
            action={ENTITY_ACTION.DISABLE}
            variant="contained"
            color="error"
            onSubmit={() => changeDialog("disable")}
          >
            Disable
          </ActionButton>
        }
      />
      <CascadeDestroyDialog
        open={dialogValues.cascade_destroy}
        onClose={() => changeDialog("cascade_destroy")}
        entityId={entity.id}
        entityName={entity.name || entity.identifier}
        loading={cascadeDestroyLoading}
        onConfirm={() => {
          setCascadeDestroyLoading(true);
          ikApi
            .graphqlRequest<{ cascadeDestroyResource: { id: string } }>(
              CASCADE_DESTROY_RESOURCE_MUTATION,
              { id: entity.id },
            )
            .then((response) => {
              notify("Cascade destroy workflow created", "success");
              changeDialog("cascade_destroy");
              navigate(
                `${linkPrefix}workflows/${response.cascadeDestroyResource.id}`,
              );
            })
            .catch((error: unknown) => {
              notifyError(error);
              changeDialog("cascade_destroy");
            })
            .finally(() => {
              setCascadeDestroyLoading(false);
            });
        }}
      />
    </Card>
  );
};
