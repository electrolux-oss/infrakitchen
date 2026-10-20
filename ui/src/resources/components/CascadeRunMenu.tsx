import { useState } from "react";

import { useNavigate } from "react-router";

import { useConfig } from "../../common";
import { CascadeActionDialog } from "../../common/components/dialogs/CascadeActionDialog";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import {
  HeroChevronDownIcon,
  HeroClipboardDocumentListIcon,
  HeroPlayCircleIcon,
} from "../../icons";
import {
  Button,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from "../../ui";
import { ENTITY_ACTION } from "../../utils/constants";
import {
  CASCADE_DRYRUN_RESOURCE_MUTATION,
  CASCADE_EXECUTE_RESOURCE_MUTATION,
} from "../graphql";

type CascadeRunMode = "plan" | "apply";

const CASCADE_RUNS = {
  plan: {
    mutation: CASCADE_DRYRUN_RESOURCE_MUTATION,
    field: "cascadeDryrunResource",
    message: "Cascade plan created, execute it to start",
  },
  apply: {
    mutation: CASCADE_EXECUTE_RESOURCE_MUTATION,
    field: "cascadeExecuteResource",
    message: "Cascade apply created, execute it to start",
  },
} as const;

/** Dropdown with Cascade Plan / Cascade Apply for a resource and its descendants. */
export const CascadeRunMenu = () => {
  const { entity, actions } = useEntityProvider();
  const { ikApi, linkPrefix } = useConfig();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<CascadeRunMode | null>(null);
  const [loading, setLoading] = useState(false);

  if (!entity || entity.abstract) return null;
  const canPlan = actions.includes(ENTITY_ACTION.CASCADE_DRYRUN);
  const canApply = actions.includes(ENTITY_ACTION.CASCADE_EXECUTE);
  if (!canPlan && !canApply) return null;

  const choose = (next: CascadeRunMode) => {
    setAnchor(null);
    setMode(next);
  };

  const start = async (run: CascadeRunMode, excludeIds: string[]) => {
    const config = CASCADE_RUNS[run];
    setLoading(true);
    try {
      const response = await ikApi.graphqlRequest<
        Record<string, { id: string }>
      >(config.mutation, { id: entity.id, excludeIds });
      notify(config.message, "success");
      setMode(null);
      navigate(`${linkPrefix}workflows/${response[config.field].id}`);
    } catch (error) {
      notifyError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Tooltip title="Run on this resource and everything that depends on it">
        <Button
          aria-haspopup="menu"
          aria-expanded={Boolean(anchor)}
          endIcon={<HeroChevronDownIcon />}
          onClick={(event) => setAnchor(event.currentTarget)}
        >
          Cascade
        </Button>
      </Tooltip>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {canPlan && (
          <MenuItem onClick={() => choose("plan")}>
            <ListItemIcon>
              <HeroClipboardDocumentListIcon />
            </ListItemIcon>
            <ListItemText>Cascade Plan</ListItemText>
          </MenuItem>
        )}
        {canApply && (
          <MenuItem onClick={() => choose("apply")}>
            <ListItemIcon>
              <HeroPlayCircleIcon />
            </ListItemIcon>
            <ListItemText>Cascade Apply</ListItemText>
          </MenuItem>
        )}
      </Menu>
      {mode && (
        <CascadeActionDialog
          mode={mode}
          open
          onClose={() => setMode(null)}
          entityId={entity.id}
          entityName={entity.name || entity.identifier || entity.id}
          loading={loading}
          onConfirm={(excludeIds) => void start(mode, excludeIds)}
        />
      )}
    </>
  );
};
