import { useState } from "react";

import { useNavigate } from "react-router";

import { useConfig, usePermissionProvider } from "../../common";
import { CascadeActionDialog } from "../../common/components/dialogs/CascadeActionDialog";
import { useEntityProvider } from "../../common/context/EntityContext";
import { buildEntityActionMutation } from "../../common/graphql/entityActionMutation";
import { notify, notifyError } from "../../common/hooks/useNotification";
import {
  HeroChevronDownIcon,
  HeroClipboardDocumentListIcon,
  HeroDocumentTextIcon,
  HeroMagnifyingGlassIcon,
  HeroPlayCircleIcon,
  HeroRectangleGroupIcon,
} from "../../icons";
import {
  Button,
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "../../ui";
import { ENTITY_ACTION } from "../../utils/constants";
import {
  CASCADE_DRYRUN_RESOURCE_MUTATION,
  CASCADE_EXECUTE_RESOURCE_MUTATION,
} from "../graphql";

import { CloneResourceButton } from "./CloneResourceButton";

type CascadeRunMode = "plan" | "apply";
type CascadeMenuMode = CascadeRunMode | "blueprint";

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

/**
 * "More" dropdown on the resource page: Metadata and Clone, then the cascade
 * actions on the resource and its descendants (Cascade Plan / Apply, and
 * Create Blueprint from the templates of the same tree).
 */
export const ResourceMoreMenu = () => {
  const { entity, actions, refreshActions, refreshEntity } =
    useEntityProvider();
  const { ikApi, linkPrefix } = useConfig();
  const { checkActionPermission } = usePermissionProvider();
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<CascadeMenuMode | null>(null);
  const [loading, setLoading] = useState(false);

  if (!entity) return null;
  const canMetadata = checkActionPermission("api:resource", "read");
  const canClone = checkActionPermission("api:resource", "write");
  // Abstract resources have nothing to run, so no cascade plan or apply;
  // their tree can still become a blueprint
  const canPlan =
    !entity.abstract && actions.includes(ENTITY_ACTION.CASCADE_DRYRUN);
  const canApply =
    !entity.abstract && actions.includes(ENTITY_ACTION.CASCADE_EXECUTE);
  const canBlueprint = checkActionPermission("api:blueprint", "write");
  const canCheckDrift =
    !entity.abstract && actions.includes(ENTITY_ACTION.CHECK_DRIFT);
  const hasCascade = canPlan || canApply || canBlueprint;
  if (!canMetadata && !canClone && !canCheckDrift && !hasCascade) return null;
  const entityName = entity.name || entity.identifier || entity.id;

  const openPage = (path: string) => {
    setAnchor(null);
    navigate(`${linkPrefix}${path}`);
  };

  const choose = (next: CascadeMenuMode) => {
    setAnchor(null);
    setMode(next);
  };

  const checkDrift = async () => {
    setAnchor(null);
    try {
      await ikApi.graphqlRequest(buildEntityActionMutation("resource"), {
        id: entity.id,
        input: { action: ENTITY_ACTION.CHECK_DRIFT },
      });
      notify("Drift check queued", "success");
      if (refreshActions) refreshActions();
      if (refreshEntity) refreshEntity();
    } catch (error) {
      notifyError(error);
    }
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

  // Nothing is saved here: the create page opens with the templates filled in
  const createBlueprint = (templateIds: string[]) => {
    setMode(null);
    navigate(`${linkPrefix}blueprints/create`, {
      state: { templateIds, name: `${entityName} blueprint` },
    });
  };

  return (
    <>
      <Button
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        endIcon={<HeroChevronDownIcon />}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        More
      </Button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {canMetadata && (
          <MenuItem onClick={() => openPage(`resources/${entity.id}/metadata`)}>
            <ListItemIcon>
              <HeroDocumentTextIcon />
            </ListItemIcon>
            <ListItemText>Metadata</ListItemText>
          </MenuItem>
        )}
        {canClone && <CloneResourceButton onSelect={() => setAnchor(null)} />}
        {canCheckDrift && (
          <MenuItem onClick={() => void checkDrift()}>
            <ListItemIcon>
              <HeroMagnifyingGlassIcon />
            </ListItemIcon>
            <ListItemText>Check drift</ListItemText>
          </MenuItem>
        )}
        {(canMetadata || canClone || canCheckDrift) && hasCascade && (
          <Divider />
        )}
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
        {canBlueprint && (
          <MenuItem onClick={() => choose("blueprint")}>
            <ListItemIcon>
              <HeroRectangleGroupIcon />
            </ListItemIcon>
            <ListItemText>Create Blueprint</ListItemText>
          </MenuItem>
        )}
      </Menu>
      {mode && (
        <CascadeActionDialog
          mode={mode}
          open
          onClose={() => setMode(null)}
          entityId={entity.id}
          entityName={entityName}
          loading={loading}
          onConfirm={(excludeIds, templateIds) =>
            mode === "blueprint"
              ? createBlueprint(templateIds)
              : void start(mode, excludeIds)
          }
        />
      )}
    </>
  );
};
