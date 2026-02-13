import React from "react";
import { useState } from "react";

import { useNavigate } from "react-router";

import WarningIcon from "@mui/icons-material/Warning";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardHeader,
  TextField,
  Typography,
} from "@mui/material";

import { ENTITY_ACTION } from "../../utils";
import { useConfig } from "../context";
import { useEntityProvider } from "../context/EntityContext";

import { ActionButton } from "./buttons/ActionButton";
import { DeleteButton } from "./buttons/DeleteEntityButton";
import { CommonDialog } from "./CommonDialog";

export const DangerZoneCard = () => {
  const { ikApi, linkPrefix } = useConfig();
  const { actions, entity } = useEntityProvider();
  const [entityName, setDestroyEntityName] = useState<string>("");
  const [dialogValues, setDialogValues] = useState<{
    [key: string]: boolean;
  }>({
    destroy: false,
    delete: false,
    disable: false,
  });

  const navigate = useNavigate();

  const changeDialog = async (dialog: string) => {
    setDialogValues((dialogValues) => {
      return { ...dialogValues, [dialog]: !dialogValues[dialog] as boolean };
    });
  };

  const handleEntityDestroy = (
    event: React.ChangeEvent<{ value: unknown }>,
  ) => {
    setDestroyEntityName(event.target.value as string);
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
      </CardActions>
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
        open={dialogValues.destroy}
        onClose={() => changeDialog("destroy")}
        content={
          <>
            <Alert severity="warning">Proceed with extreme caution!</Alert>
            <Typography>
              <br />
              Are you sure you want to destroy{" "}
              <mark>
                <code>{entity.name || entity.identifier}</code>
              </mark>
              ? All associated infrastructure and data will be permanently
              destroyed.
              <br />
              <br />
            </Typography>
            <Typography>
              To confirm, enter{" "}
              <mark>
                <code>{entity.name || entity.identifier}</code>
              </mark>{" "}
              in the text field.
            </Typography>
            <TextField
              variant="outlined"
              value={entityName}
              onChange={handleEntityDestroy}
              fullWidth
            />
          </>
        }
        actions={
          <ActionButton
            action={ENTITY_ACTION.DESTROY}
            onSubmit={() => changeDialog("destroy")}
            disabled={entityName !== (entity.name || entity.identifier)}
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
    </Card>
  );
};
