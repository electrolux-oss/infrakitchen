import { useCallback, useEffect, useMemo, useState } from "react";

import { useConfig } from "../../common";
import { deleteIconButtonClass } from "../../common/components/buttons/deleteIconButtonClass";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { InlineCode } from "../../common/components/code/InlineCode";
import { CommonDialog } from "../../common/components/dialogs/CommonDialog";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { Label } from "../../common/components/labels/Label";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { copyToClipboard } from "../../common/utils/clipboard";
import {
  AddIcon,
  CheckIcon,
  CloseIcon,
  ContentCopyIcon,
  DeleteOutlinedIcon,
  VerifiedUserIcon,
} from "../../icons/material";
import {
  Alert,
  Checkbox,
  FormControlLabel,
  Button,
  IconButton,
  Tooltip,
  TextField,
} from "../../ui";
import { GqlUser } from "../graphql";
import {
  CREATE_PERSONAL_ACCESS_TOKEN_MUTATION,
  DELETE_PERSONAL_ACCESS_TOKEN_MUTATION,
  GqlPersonalAccessToken,
  GqlPersonalAccessTokenCreate,
  PERSONAL_ACCESS_TOKENS_QUERY,
  PersonalAccessTokenInput,
} from "../graphql";

const isExpired = (value: string | null) => {
  if (!value) return false;
  return new Date(value).getTime() <= Date.now();
};

const formatDateTimeLocal = (value: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
};

// Entity/action pairs offered for scoped tokens, derived from the owner's own
// bootstrap permissions. Admin is intentionally excluded: scoped tokens never
// carry admin authority.
const SCOPE_ACTIONS = ["read", "write"] as const;

const normalizeAction = (action: string | undefined) => {
  // "admin" implies both read and write for scoping purposes.
  if (action === "admin") return SCOPE_ACTIONS;
  if (action === "write") return ["write"];
  if (action === "read") return ["read"];
  return [];
};

interface TokenDialogProps {
  open: boolean;
  isLoading: boolean;
  onClose: () => void;
  onSave: (input: PersonalAccessTokenInput) => Promise<void>;
}

const TokenDialog = ({
  open,
  isLoading,
  onClose,
  onSave,
}: TokenDialogProps) => {
  const { bootstrapPermissions, entities } = useConfig();
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [expiresAt, setExpiresAt] = useState("");
  const minExpiresAt = formatDateTimeLocal(new Date());
  const expirationOptions = [7, 30, 90, 180];

  // Entities the owner can act on, with the actions scoping permits. Keys
  // arrive as "api:<entity>" (and "*" for super admins); a super admin's
  // wildcard implies read+write on every entity the server knows about.
  const availableScopes = useMemo(() => {
    if (!bootstrapPermissions)
      return [] as { entity: string; actions: string[] }[];
    const stripApiPrefix = (key: string) => key.replace(/^api:/, "");

    if (bootstrapPermissions["*"] === "admin") {
      const entityNames = new Set<string>([
        ...Object.keys(bootstrapPermissions)
          .filter((key) => key !== "*")
          .map(stripApiPrefix),
        ...(entities ?? []),
      ]);
      return Array.from(entityNames)
        .sort((a, b) => a.localeCompare(b))
        .map((entity) => ({
          entity,
          actions: SCOPE_ACTIONS.slice() as string[],
        }));
    }

    return Object.entries(bootstrapPermissions)
      .filter(([key]) => key !== "*")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, action]) => ({
        entity: stripApiPrefix(key),
        actions: normalizeAction(action).slice(),
      }));
  }, [bootstrapPermissions, entities]);

  useEffect(() => {
    if (!open) return;
    setName("");
    setSelectedScopes(new Set());
    setExpiresAt("");
  }, [open]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      notifyError(new Error("Token name is required."));
      return;
    }

    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      notifyError(new Error("Expiration must be in the future."));
      return;
    }

    const input: PersonalAccessTokenInput = {
      name: trimmedName,
      scopes:
        selectedScopes.size > 0 ? Array.from(selectedScopes).sort() : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    await onSave(input);
  };

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Create Personal Access Token"
      maxWidth="sm"
      content={
        <div
          // the Name field's floating label sits above the input's top
          // border, so the top needs more room to avoid clipping (see
          // ToolDownloadDialog's pt: 3 for the same pattern)
          className="flex flex-col gap-4 pt-6 pb-1"
        >
          <TextField
            label="Name *"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
            autoFocus
            helperText="Use a descriptive label so you can tell tokens apart later."
          />
          {availableScopes.length > 0 && (
            <div>
              <span className="mb-1 block text-caption text-fg-muted">
                Permissions
              </span>
              <div className="max-h-55 overflow-y-auto rounded-surface border border-divider p-2">
                {availableScopes.map(({ entity, actions }) => (
                  <div
                    className="flex flex-row items-center gap-4 px-2"
                    key={entity}
                  >
                    <p className="m-0 min-w-27.5 text-body2">{entity}</p>
                    {SCOPE_ACTIONS.map((action) => {
                      const scope = `${action}:${entity}`;
                      const allowed = actions.includes(action);
                      const checked = selectedScopes.has(scope);
                      const checkbox = (
                        <Checkbox
                          size="small"
                          disabled={!allowed}
                          checked={checked}
                          onChange={(_, next) => {
                            setSelectedScopes((previous) => {
                              const updated = new Set(previous);
                              if (next) {
                                updated.add(scope);
                              } else {
                                updated.delete(scope);
                              }
                              return updated;
                            });
                          }}
                        />
                      );
                      return (
                        <FormControlLabel
                          className="ml-0"
                          key={scope}
                          // Disabled here too: FormControlLabel keys its
                          // cursor:default + greyed label off this prop, not
                          // off the inner Checkbox's.
                          disabled={!allowed}
                          control={
                            allowed ? (
                              checkbox
                            ) : (
                              <Tooltip
                                title={`You don't have ${action} permission on ${entity}.`}
                                placement="top"
                              >
                                <span>{checkbox}</span>
                              </Tooltip>
                            )
                          }
                          label={action}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
              <Alert className="mt-2" severity="info" variant="outlined">
                Optionally restrict this token to specific permissions — it
                cannot exceed your own.
              </Alert>
            </div>
          )}
          <TextField
            label="Expiration"
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            fullWidth
            inputProps={{ min: minExpiresAt }}
            helperText={
              selectedScopes.size > 0
                ? "Scoped personal access token — leave blank to never expire."
                : "Leave blank for a token that does not expire."
            }
          />
          <div className="flex flex-row flex-wrap gap-2">
            {expirationOptions.map((hours) => (
              <Button
                key={hours}
                disabled={isLoading}
                onClick={() =>
                  setExpiresAt(
                    formatDateTimeLocal(
                      new Date(Date.now() + hours * 24 * 60 * 60 * 1000),
                    ),
                  )
                }
              >
                {`${hours} days`}
              </Button>
            ))}
          </div>
        </div>
      }
      actions={
        <Button variant="contained" onClick={handleSave} disabled={isLoading}>
          Create
        </Button>
      }
    />
  );
};

const TokenValueDialog = ({
  open,
  createdToken,
  onClose,
}: {
  open: boolean;
  createdToken: GqlPersonalAccessTokenCreate | null;
  onClose: () => void;
}) => {
  const token = createdToken?.token ?? null;
  const handleCopy = async () => {
    if (!token) return;
    try {
      await copyToClipboard(token);
      notify("Token copied to clipboard", "success");
    } catch (error) {
      notifyError(error);
    }
  };

  return (
    <CommonDialog
      open={open}
      onClose={onClose}
      title="Personal Access Token Ready"
      maxWidth="md"
      content={
        <div className="flex flex-col gap-5 pt-2">
          <div className="flex flex-row items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success-light text-success-contrast">
              <VerifiedUserIcon fontSize="small" />
            </div>
            <div className="min-w-0">
              <h6 className="m-0 text-h6">Store this token securely</h6>
              <p className="m-0 text-body2 text-fg-muted">
                This is the only time the full token value will be shown. Copy
                it now and store it in a secure password manager or secret
                vault.
              </p>
            </div>
          </div>
          <Alert severity="warning" variant="outlined">
            {createdToken?.scopes
              ? "Anyone with this token can perform the granted actions on your behalf until the token is deleted or expires."
              : "Anyone with this token can access your account through the CLI and API until the token is deleted or expires."}
          </Alert>
          <div>
            <span className="mb-1.5 block text-caption text-fg-muted">
              Access token
            </span>
            <div className="flex items-center gap-2 rounded-code border border-divider bg-paper px-3 py-2">
              <code className="m-0 min-w-0 flex-1 font-mono text-[13px] leading-[1.6] font-normal break-all">
                {token ?? ""}
              </code>
              <Tooltip title="Copy token">
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  edge="end"
                  aria-label="Copy token"
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-2 sm:flex-row">
            <span className="text-caption text-fg-muted">
              After this dialog closes, only the token prefix will remain
              visible.
            </span>
          </div>
        </div>
      }
      actions={
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      }
    />
  );
};

const DeleteTokenButton = ({
  token,
  isLoading,
  onDelete,
}: {
  token: GqlPersonalAccessToken;
  isLoading: boolean;
  onDelete: (tokenId: string) => Promise<void>;
}) => {
  const [isConfirming, setIsConfirming] = useState(false);

  // Two-step confirm lives in a compact menu-style popover row to the left of
  // the shared delete icon button, so it doesn't stretch the card row.
  if (!isConfirming) {
    return (
      <IconButton
        title={"Delete Token"}
        aria-label="Delete token"
        size="small"
        onClick={() => setIsConfirming(true)}
        disabled={isLoading}
        className={deleteIconButtonClass}
      >
        <DeleteOutlinedIcon fontSize="small" />
      </IconButton>
    );
  }

  return (
    <div className="flex flex-row items-center gap-1">
      <IconButton
        className="border-0 bg-transparent text-error"
        title="Confirm delete"
        aria-label="Confirm delete token"
        size="small"
        disabled={isLoading}
        onClick={() => onDelete(token.id)}
      >
        <CheckIcon fontSize="small" />
      </IconButton>
      <IconButton
        title="Cancel"
        aria-label="Cancel delete"
        size="small"
        disabled={isLoading}
        onClick={() => setIsConfirming(false)}
        className={deleteIconButtonClass}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </div>
  );
};

export const UserPersonalAccessTokensCard = ({ user }: { user: GqlUser }) => {
  const { ikApi, currentUser } = useConfig();
  const [tokens, setTokens] = useState<GqlPersonalAccessToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdToken, setCreatedToken] =
    useState<GqlPersonalAccessTokenCreate | null>(null);

  const isOwnUserPage = currentUser?.id === user.id;

  const loadTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await ikApi.graphqlRequest<{
        personalAccessTokens: GqlPersonalAccessToken[];
      }>(PERSONAL_ACCESS_TOKENS_QUERY);
      setTokens(response.personalAccessTokens ?? []);
    } catch (error) {
      notifyError(error);
    } finally {
      setIsLoading(false);
    }
  }, [ikApi]);

  useEffect(() => {
    if (!isOwnUserPage) {
      setTokens([]);
      setIsLoading(false);
      return;
    }
    loadTokens();
  }, [isOwnUserPage, loadTokens]);

  if (!isOwnUserPage) {
    return null;
  }

  const handleCreate = async (input: PersonalAccessTokenInput) => {
    setIsSaving(true);
    try {
      const response = await ikApi.graphqlRequest<{
        createPersonalAccessToken: GqlPersonalAccessTokenCreate;
      }>(CREATE_PERSONAL_ACCESS_TOKEN_MUTATION, {
        input,
      });
      const created = response.createPersonalAccessToken;
      setTokens((previous) => [created, ...previous]);
      setCreatedToken(created);
      notify("Token created", "success");
      setDialogOpen(false);
    } catch (error) {
      notifyError(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (tokenId: string) => {
    setIsSaving(true);
    try {
      await ikApi.graphqlRequest<{
        deletePersonalAccessToken: GqlPersonalAccessToken;
      }>(DELETE_PERSONAL_ACCESS_TOKEN_MUTATION, { id: tokenId });
      setTokens((previous) => previous.filter((token) => token.id !== tokenId));
      notify("Token deleted", "success");
    } catch (error) {
      notifyError(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <BaseCard
        name="Personal Access Tokens"
        description="Create and delete tokens for CLI and API access on your account."
        actions={
          <div className="flex flex-row gap-2">
            <Button size="small" onClick={loadTokens} disabled={isLoading}>
              Refresh
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setDialogOpen(true)}
            >
              Create Token
            </Button>
          </div>
        }
      >
        <div className="col-[1_/_-1] flex w-full flex-col gap-4">
          {isLoading ? (
            <p className="m-0 text-body2 text-fg-muted">Loading tokens...</p>
          ) : tokens.length === 0 ? (
            <p className="m-0 text-body2 text-fg-muted">
              No personal access tokens yet.
            </p>
          ) : (
            tokens.map((token) => {
              return (
                <div
                  className="flex flex-col justify-between gap-4 rounded-surface border border-divider p-4 md:flex-row"
                  key={token.id}
                >
                  <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
                      <p className="m-0 text-body2 font-semibold">
                        {token.name}
                      </p>
                      {token.scopes ? (
                        <Label tone="info" label="Scoped" />
                      ) : (
                        <Label tone="warning" label="Full access" />
                      )}
                      {isExpired(token.expiresAt) ? (
                        <Label label="Expired" tone="error" />
                      ) : token.expiresAt ? null : (
                        <Label label="Never expires" tone="error" />
                      )}
                    </div>
                    <p className="m-0 text-body2 text-fg-muted">
                      Prefix: <InlineCode>{token.tokenPrefix}</InlineCode>
                    </p>
                    {token.scopes ? (
                      <div className="flex flex-row flex-wrap items-center gap-1">
                        <p className="m-0 text-body2 text-fg-muted">Scopes:</p>
                        {token.scopes.map((scope) => (
                          <Label key={scope} tone="default" label={scope} />
                        ))}
                      </div>
                    ) : null}
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <span className="text-caption text-fg-muted">
                        Expires:{" "}
                        {token.expiresAt ? (
                          <RelativeTime
                            date={token.expiresAt}
                            className="text-[length:inherit]"
                          />
                        ) : (
                          "Never"
                        )}
                      </span>
                      <span className="text-caption text-fg-muted">
                        Last used:{" "}
                        {token.lastUsedAt ? (
                          <RelativeTime
                            date={token.lastUsedAt}
                            className="text-[length:inherit]"
                          />
                        ) : (
                          "Never"
                        )}
                      </span>
                      <span className="text-caption text-fg-muted">
                        Created:{" "}
                        <RelativeTime
                          date={token.createdAt}
                          className="text-[length:inherit]"
                        />
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <DeleteTokenButton
                      token={token}
                      isLoading={isSaving}
                      onDelete={handleDelete}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </BaseCard>
      <TokenDialog
        open={dialogOpen}
        isLoading={isSaving}
        onClose={() => setDialogOpen(false)}
        onSave={handleCreate}
      />
      <TokenValueDialog
        open={Boolean(createdToken)}
        createdToken={createdToken}
        onClose={() => setCreatedToken(null)}
      />
    </>
  );
};
