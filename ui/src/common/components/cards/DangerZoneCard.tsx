import { Fragment, ReactNode, useMemo, useState } from "react";

import { useNavigate } from "react-router";

import { HeroExclamationTriangleIcon } from "../../../icons";
import { CASCADE_DESTROY_RESOURCE_MUTATION } from "../../../resources/graphql";
import { Alert, Button, Card, CardHeader } from "../../../ui";
import { ENTITY_ACTION } from "../../../utils";
import { useConfig } from "../../context";
import { useEntityProvider } from "../../context/EntityContext";
import { notify, notifyError } from "../../hooks/useNotification";
import { ActionButton } from "../buttons/ActionButton";
import { DeleteButton } from "../buttons/DeleteEntityButton";
import { InlineCode } from "../code/InlineCode";
import { CascadeDestroyDialog } from "../dialogs/CascadeDestroyDialog";
import { CommonDialog } from "../dialogs/CommonDialog";
import { ConfirmNameField } from "../fields/ConfirmNameField";

export type DangerZoneSeverity = "destructive" | "warning";

/**
 * Configuration for a single danger-zone action. The card renders each action
 * as a list row (label + result description, like feature flags) with a
 * trigger button, and the confirmation dialog is built generically from this
 * config — so new actions can be added without changing the card itself.
 */
export interface DangerZoneAction {
  /** Entity action key; the row shows when this key is in the entity's action list. */
  key: string;
  /** Label of the action. */
  label: string;
  /**
   * "destructive" — irreversible (destroy, delete, cascade destroy): red styling.
   * "warning" — reversible or high-impact (disable): neutral styling and wording
   * that makes clear the action can be undone.
   */
  severity: DangerZoneSeverity;
  /** What the action does / its result, shown under the label in the card list. */
  description?: ReactNode;
  /** Explanation of the action's effect, shown in the confirmation dialog. */
  helperText?: ReactNode;
  /** Require typing the entity name to confirm (e.g. Destroy). */
  requireNameConfirmation?: boolean;
  /** Custom footer actions for the confirmation dialog; receives a close callback. */
  renderDialogActions?: (close: () => void) => ReactNode;
  /** Render a fully custom dialog instead of the generic confirmation. */
  renderDialog?: (open: boolean, close: () => void) => ReactNode;
  /** Refresh the entity and its action list after confirming. Defaults to true. */
  refreshAfterConfirm?: boolean;
}

export interface DangerZoneCardProps {
  /**
   * Actions to surface. Defaults to the standard
   * destroy / delete / disable / cascade destroy set.
   */
  dangerZoneActions?: DangerZoneAction[];
  /** Card subtitle. Defaults to a generic line — not every action is irreversible. */
  description?: ReactNode;
}

export const DangerZoneCard = ({
  dangerZoneActions,
  description,
}: DangerZoneCardProps) => {
  const { ikApi, linkPrefix } = useConfig();
  const { actions, entity, refreshActions, refreshEntity } =
    useEntityProvider();
  const [destroyConfirm, setDestroyConfirm] = useState("");
  const [dialogValues, setDialogValues] = useState<{
    [key: string]: boolean;
  }>({});
  const [cascadeDestroyLoading, setCascadeDestroyLoading] =
    useState<boolean>(false);

  const navigate = useNavigate();

  const changeDialog = async (dialog: string) => {
    setDialogValues((dialogValues) => {
      return { ...dialogValues, [dialog]: !dialogValues[dialog] as boolean };
    });
  };

  const changeDialogWithRefresh = async (dialog: string) => {
    changeDialog(dialog);
    // Refresh the action list AND the entity: actions drive which danger
    // rows show, while the entity (status) drives header actions like
    // Create Resource / Enable — only refreshing one leaves the page stale.
    if (refreshActions) refreshActions();
    if (refreshEntity) refreshEntity();
  };

  const actionConfigs = useMemo<DangerZoneAction[]>(() => {
    if (dangerZoneActions) {
      return dangerZoneActions;
    }
    if (!entity) {
      // The default configs render entity name / id; wait until it loads.
      return [];
    }
    return [
      {
        key: ENTITY_ACTION.DESTROY,
        label: "Destroy",
        severity: "destructive" as const,
        description: (
          <>
            Permanently destroys this {entity.entityName}. This cannot be
            undone.
          </>
        ),
        helperText: (
          <>
            This will permanently destroy{" "}
            <strong>{entity.name || entity.identifier}</strong>. This cannot be
            undone.
          </>
        ),
        requireNameConfirmation: true,
      },
      {
        key: ENTITY_ACTION.DELETE,
        label: "Delete",
        severity: "destructive" as const,
        description: (
          <>
            Permanently removes this {entity.entityName}. This cannot be undone.
          </>
        ),
        helperText: (
          <>
            Are you sure you want to delete{" "}
            <InlineCode>{entity.name || entity.identifier}</InlineCode>? This
            cannot be undone.
          </>
        ),
        renderDialogActions: (close) => (
          <DeleteButton
            onClose={close}
            onDelete={() => navigate(`${linkPrefix}/${entity.entityName}s`)}
            ikApi={ikApi}
            entity_name={entity.entityName}
            entity_id={entity.id}
          >
            Delete
          </DeleteButton>
        ),
        refreshAfterConfirm: false,
      },
      {
        key: ENTITY_ACTION.DISABLE,
        label: "Disable",
        severity: "warning" as const,
        description: (
          <>
            Disables this {entity.entityName}. It can be enabled again at any
            time.
          </>
        ),
        helperText: (
          <>
            Are you sure you want to disable{" "}
            <InlineCode>{entity.name || entity.identifier}</InlineCode>? It can
            be enabled again at any time.
          </>
        ),
      },
      {
        key: ENTITY_ACTION.CASCADE_DESTROY,
        label: "Cascade Destroy",
        severity: "destructive" as const,
        description: (
          <>
            Permanently destroys this {entity.entityName} and everything that
            depends on it. This cannot be undone.
          </>
        ),
        renderDialog: (open, close) => (
          <CascadeDestroyDialog
            open={open}
            onClose={close}
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
                  changeDialog(ENTITY_ACTION.CASCADE_DESTROY);
                  navigate(
                    `${linkPrefix}workflows/${response.cascadeDestroyResource.id}`,
                  );
                })
                .catch((error: unknown) => {
                  notifyError(error);
                  changeDialog(ENTITY_ACTION.CASCADE_DESTROY);
                })
                .finally(() => {
                  setCascadeDestroyLoading(false);
                });
            }}
          />
        ),
      },
    ];
  }, [
    dangerZoneActions,
    entity,
    ikApi,
    linkPrefix,
    navigate,
    cascadeDestroyLoading,
  ]);

  const visibleActions = actionConfigs.filter((config) =>
    actions.includes(config.key),
  );

  if (visibleActions.length === 0) {
    return null;
  }

  if (!entity) {
    return null;
  }

  return (
    <Card className="w-full border border-error">
      <CardHeader
        title={<h2 className="m-0 text-h6 text-error">Danger Zone</h2>}
        subheader={
          <p className="m-0 text-body2 text-error">
            {description ??
              "Some of these actions cannot be undone. Review carefully before continuing."}
          </p>
        }
      />
      <div className="flex flex-col divide-y divide-divider px-4 pb-4">
        {visibleActions.map((config) => (
          <div
            className="flex items-center justify-between gap-4 py-2"
            key={config.key}
          >
            <div className="min-w-0">
              <h6 className="m-0 text-subtitle2 text-fg">{config.label}</h6>
              {config.description && (
                <span className="text-caption text-fg-muted">
                  {config.description}
                </span>
              )}
            </div>
            <Button
              className="shrink-0"
              variant="contained"
              color="error"
              onClick={() => changeDialog(config.key)}
            >
              {config.label}
            </Button>
          </div>
        ))}
      </div>
      {visibleActions.map((config) =>
        config.renderDialog ? (
          <Fragment key={config.key}>
            {config.renderDialog(!!dialogValues[config.key], () =>
              changeDialog(config.key),
            )}
          </Fragment>
        ) : (
          <CommonDialog
            key={config.key}
            maxWidth={config.requireNameConfirmation ? "sm" : "xs"}
            title="Confirmation"
            open={!!dialogValues[config.key]}
            onClose={() => changeDialog(config.key)}
            content={
              <div className="flex flex-col gap-4">
                <Alert
                  severity={
                    config.severity === "destructive" ? "error" : "warning"
                  }
                  icon={<HeroExclamationTriangleIcon />}
                >
                  {config.helperText ?? (
                    <>
                      Are you sure you want to {config.label.toLowerCase()}{" "}
                      <InlineCode>
                        {entity.name || entity.identifier}
                      </InlineCode>
                      ?
                    </>
                  )}
                </Alert>
                {config.requireNameConfirmation && (
                  <ConfirmNameField
                    name={entity.name || entity.identifier}
                    value={destroyConfirm}
                    onChange={setDestroyConfirm}
                  />
                )}
              </div>
            }
            actions={
              config.renderDialogActions ? (
                config.renderDialogActions(() => changeDialog(config.key))
              ) : (
                <ActionButton
                  action={config.key}
                  onSubmit={() =>
                    config.refreshAfterConfirm === false
                      ? changeDialog(config.key)
                      : changeDialogWithRefresh(config.key)
                  }
                  disabled={
                    config.requireNameConfirmation &&
                    destroyConfirm !== (entity.name || entity.identifier)
                  }
                  color="error"
                  variant="contained"
                >
                  {config.label}
                </ActionButton>
              )
            }
          />
        ),
      )}
    </Card>
  );
};
