import { useCallback, useEffect, useState } from "react";

import { useConfig } from "../../common";
import { deleteIconButtonClass } from "../../common/components/buttons/deleteIconButtonClass";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { InlineCode } from "../../common/components/code/InlineCode";
import { CommonDialog } from "../../common/components/dialogs/CommonDialog";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { copyToClipboard } from "../../common/utils/clipboard";
import {
  HeroDocumentDuplicateIcon,
  HeroExclamationTriangleIcon,
  HeroShieldCheckIcon,
} from "../../icons";
import { HeroPlusCircleIcon } from "../../icons";
import { HeroTrashIcon } from "../../icons";
import {
  Alert,
  MenuItem,
  Button,
  IconButton,
  Tooltip,
  TextField,
} from "../../ui";
import { Label } from "../../ui/Label";
import { GqlUser } from "../graphql";
import {
  CREATE_PERSONAL_ACCESS_TOKEN_MUTATION,
  DELETE_PERSONAL_ACCESS_TOKEN_MUTATION,
  GqlPersonalAccessToken,
  GqlPersonalAccessTokenCreate,
  PERSONAL_ACCESS_TOKENS_QUERY,
  PersonalAccessTokenInput,
} from "../graphql";

import { ScopePicker, useAvailableScopes } from "./ScopePicker";

const isExpired = (value: string | null) => {
  if (!value) return false;
  return new Date(value).getTime() <= Date.now();
};

const formatDateTimeLocal = (value: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
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
  const availableScopes = useAvailableScopes();
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  // "never", a number of days, or "custom" (uses the date picker value).
  const [expiryChoice, setExpiryChoice] = useState("7");
  const [customExpiresAt, setCustomExpiresAt] = useState("");
  const minExpiresAt = formatDateTimeLocal(new Date());
  const expirationOptions = [7, 30, 90, 180];

  useEffect(() => {
    if (!open) return;
    setName("");
    setSelectedScopes(new Set());
    setExpiryChoice("7");
    setCustomExpiresAt("");
  }, [open]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      notifyError(new Error("Token name is required."));
      return;
    }

    let expiresAt: string | null = null;
    if (expiryChoice === "custom") {
      if (!customExpiresAt) {
        notifyError(new Error("Select an expiration date."));
        return;
      }
      if (new Date(customExpiresAt).getTime() <= Date.now()) {
        notifyError(new Error("Expiration must be in the future."));
        return;
      }
      expiresAt = new Date(customExpiresAt).toISOString();
    } else if (expiryChoice !== "never") {
      expiresAt = new Date(
        Date.now() + Number(expiryChoice) * 24 * 60 * 60 * 1000,
      ).toISOString();
    }

    const input: PersonalAccessTokenInput = {
      name: trimmedName,
      scopes:
        selectedScopes.size > 0 ? Array.from(selectedScopes).sort() : null,
      expiresAt,
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
        <div className="flex flex-col gap-4 pb-1">
          <TextField
            label="Name *"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
            autoFocus
            helperText="Name the token after what will use it, e.g. “Claude agent” or “Local script”."
          />
          <div className="flex flex-row items-start gap-3">
            <TextField
              select
              label="Expiration"
              value={expiryChoice}
              onChange={(event) => setExpiryChoice(event.target.value)}
              className="w-48 shrink-0"
              helperText={
                expiryChoice === "never"
                  ? "This token will not expire."
                  : undefined
              }
            >
              {expirationOptions.map((days) => (
                <MenuItem key={days} value={String(days)}>
                  {`${days} days`}
                </MenuItem>
              ))}
              <MenuItem value="custom">Custom</MenuItem>
              <MenuItem value="never">No expiration</MenuItem>
            </TextField>
            {expiryChoice === "custom" && (
              <TextField
                label="Expires at"
                type="datetime-local"
                value={customExpiresAt}
                onChange={(event) => setCustomExpiresAt(event.target.value)}
                className="w-60"
                inputProps={{ min: minExpiresAt }}
              />
            )}
          </div>
          <ScopePicker
            availableScopes={availableScopes}
            selectedScopes={selectedScopes}
            onChange={setSelectedScopes}
            selectionNote="This token is limited to the access chosen below."
            emptySelectionNote="No restrictions chosen: the token has the same access as your account."
          />
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
              <HeroShieldCheckIcon fontSize="small" />
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
              <code className="m-0 min-w-0 flex-1 font-mono text-(length:--text-body2) leading-[1.6] font-normal break-all">
                {token ?? ""}
              </code>
              <Tooltip title="Copy token">
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  edge="end"
                  aria-label="Copy token"
                >
                  <HeroDocumentDuplicateIcon fontSize="small" />
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

  const handleConfirm = async () => {
    await onDelete(token.id);
    setIsConfirming(false);
  };

  return (
    <>
      <IconButton
        title="Delete Token"
        aria-label="Delete token"
        size="small"
        onClick={() => setIsConfirming(true)}
        disabled={isLoading}
        className={deleteIconButtonClass}
      >
        <HeroTrashIcon fontSize="small" />
      </IconButton>
      <CommonDialog
        open={isConfirming}
        onClose={() => setIsConfirming(false)}
        title="Delete token?"
        maxWidth="xs"
        content={
          <p className="m-0 text-body2">
            Delete <strong>{token.name}</strong>? Anything using this token will
            immediately lose access. This cannot be undone.
          </p>
        }
        actions={
          <Button
            variant="contained"
            color="error"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            Delete
          </Button>
        }
      />
    </>
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
        description="Tokens give automation and AI agents access to InfraKitchen on your behalf. Limit each token to the access it needs and set an expiration."
        actions={
          <div className="flex flex-row items-center gap-2">
            <Button
              size="small"
              startIcon={<HeroPlusCircleIcon />}
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
                        <Label
                          tone="warning"
                          label="Full access"
                          icon={<HeroExclamationTriangleIcon />}
                        />
                      )}
                      {isExpired(token.expiresAt) ? (
                        <Label
                          label="Expired"
                          tone="warning"
                          icon={<HeroExclamationTriangleIcon />}
                        />
                      ) : token.expiresAt ? null : (
                        <Label
                          label="Never expires"
                          tone="error"
                          icon={<HeroExclamationTriangleIcon />}
                        />
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
