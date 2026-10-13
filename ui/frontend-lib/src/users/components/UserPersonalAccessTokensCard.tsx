import { useCallback, useEffect, useMemo, useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { addDays, format, parseISO } from "date-fns";

import { useConfig } from "../../common";
import { deleteIconButtonStyle } from "../../common/components/buttons/deleteIconButtonStyle";
import { BaseCard } from "../../common/components/cards/BaseCard";
import { InlineCode } from "../../common/components/code/InlineCode";
import { CommonDialog } from "../../common/components/dialogs/CommonDialog";
import { RelativeTime } from "../../common/components/fields/RelativeTime";
import { Label } from "../../common/components/labels/Label";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { CODE_FONT_FAMILY } from "../../common/theme";
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
  return parseISO(value).getTime() <= Date.now();
};

const formatDateTimeLocal = (value: Date) => {
  return format(value, "yyyy-MM-dd'T'HH:mm");
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
      tokenType: "developer",
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
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            // the Name field's floating label sits above the input's top
            // border, so the top needs more room to avoid clipping (see
            // ToolDownloadDialog's pt: 3 for the same pattern)
            pt: 3,
            pb: 0.5,
          }}
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
            <Box>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", display: "block", mb: 0.5 }}
              >
                Permissions
              </Typography>
              <Box
                sx={{
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                  borderRadius: "var(--template-surface-radius)",
                  p: 1,
                  maxHeight: 220,
                  overflowY: "auto",
                }}
              >
                {availableScopes.map(({ entity, actions }) => (
                  <Stack
                    key={entity}
                    direction="row"
                    spacing={2}
                    sx={{ alignItems: "center", px: 1 }}
                  >
                    <Typography variant="body2" sx={{ minWidth: 110 }}>
                      {entity}
                    </Typography>
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
                          key={scope}
                          sx={{ ml: 0 }}
                          // Disabled here too: MUI keys the wrapper's
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
                  </Stack>
                ))}
              </Box>
              <Alert severity="info" variant="outlined" sx={{ mt: 1 }}>
                Optionally restrict this token to specific permissions — it
                cannot exceed your own.
              </Alert>
            </Box>
          )}
          <TextField
            label="Expiration"
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            fullWidth
            slotProps={{
              inputLabel: { shrink: true },
              htmlInput: { min: minExpiresAt },
            }}
            helperText={
              selectedScopes.size > 0
                ? "Scoped personal access token — leave blank to never expire."
                : "Leave blank for a token that does not expire."
            }
          />
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            sx={{
              flexWrap: "wrap",
            }}
          >
            {expirationOptions.map((hours) => (
              <Button
                key={hours}
                disabled={isLoading}
                onClick={() =>
                  setExpiresAt(formatDateTimeLocal(addDays(new Date(), hours)))
                }
              >
                {`${hours} days`}
              </Button>
            ))}
          </Stack>
        </Box>
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
      await navigator.clipboard.writeText(token);
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ alignItems: "flex-start" }}
          >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: "50%",
                bgcolor: "success.light",
                color: "success.contrastText",
                flexShrink: 0,
              }}
            >
              <VerifiedUserIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6">Store this token securely</Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                }}
              >
                This is the only time the full token value will be shown. Copy
                it now and store it in a secure password manager or secret
                vault.
              </Typography>
            </Box>
          </Stack>
          <Alert severity="warning" variant="outlined">
            {createdToken?.scopes
              ? "Anyone with this token can perform the granted actions on your behalf until the token is deleted or expires."
              : "Anyone with this token can access your account through the CLI and API until the token is deleted or expires."}
          </Alert>
          <Box>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                display: "block",
                mb: 0.75,
              }}
            >
              Access token
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                borderRadius: "var(--template-code-radius)",
                px: 1.5,
                py: 1,
                bgcolor: "background.paper",
              }}
            >
              <Typography
                component="code"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontFamily: CODE_FONT_FAMILY,
                  fontSize: 13,
                  lineHeight: 1.6,
                  wordBreak: "break-all",
                }}
              >
                {token ?? ""}
              </Typography>
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
            </Box>
          </Box>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            sx={{ justifyContent: "space-between" }}
          >
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
              }}
            >
              After this dialog closes, only the token prefix will remain
              visible.
            </Typography>
          </Stack>
        </Box>
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
        sx={deleteIconButtonStyle}
      >
        <DeleteOutlineIcon fontSize="small" />
      </IconButton>
    );
  }

  return (
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
      <IconButton
        title="Confirm delete"
        aria-label="Confirm delete token"
        size="small"
        disabled={isLoading}
        onClick={() => onDelete(token.id)}
        sx={{
          color: "error.main",
          border: "none",
          backgroundColor: "transparent",
        }}
      >
        <CheckIcon fontSize="small" />
      </IconButton>
      <IconButton
        title="Cancel"
        aria-label="Cancel delete"
        size="small"
        disabled={isLoading}
        onClick={() => setIsConfirming(false)}
        sx={deleteIconButtonStyle}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Stack>
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
          <Stack direction="row" spacing={1}>
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
          </Stack>
        }
      >
        <Box
          sx={{
            width: "100%",
            gridColumn: "1 / -1",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {isLoading ? (
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
              }}
            >
              Loading tokens...
            </Typography>
          ) : tokens.length === 0 ? (
            <Typography
              variant="body2"
              sx={{
                color: "text.secondary",
              }}
            >
              No personal access tokens yet.
            </Typography>
          ) : (
            tokens.map((token) => {
              return (
                <Box
                  key={token.id}
                  sx={{
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    borderRadius: "var(--template-surface-radius)",
                    p: 2,
                    display: "flex",
                    flexDirection: { xs: "column", md: "row" },
                    gap: 2,
                    justifyContent: "space-between",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      minWidth: 0,
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={1}
                      useFlexGap
                      sx={{ alignItems: { xs: "flex-start", sm: "center" } }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {token.name}
                      </Typography>
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
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        color: "text.secondary",
                      }}
                    >
                      Prefix: <InlineCode>{token.tokenPrefix}</InlineCode>
                    </Typography>
                    {token.scopes ? (
                      <Stack
                        direction="row"
                        spacing={0.5}
                        useFlexGap
                        sx={{ flexWrap: "wrap", alignItems: "center" }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary" }}
                        >
                          Scopes:
                        </Typography>
                        {token.scopes.map((scope) => (
                          <Label key={scope} tone="default" label={scope} />
                        ))}
                      </Stack>
                    ) : null}
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      useFlexGap
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                        }}
                      >
                        Expires:{" "}
                        {token.expiresAt ? (
                          <RelativeTime
                            date={token.expiresAt}
                            variant="inherit"
                          />
                        ) : (
                          "Never"
                        )}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                        }}
                      >
                        Last used:{" "}
                        {token.lastUsedAt ? (
                          <RelativeTime
                            date={token.lastUsedAt}
                            variant="inherit"
                          />
                        ) : (
                          "Never"
                        )}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                        }}
                      >
                        Created:{" "}
                        <RelativeTime
                          date={token.createdAt}
                          variant="inherit"
                        />
                      </Typography>
                    </Stack>
                  </Box>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <DeleteTokenButton
                      token={token}
                      isLoading={isSaving}
                      onDelete={handleDelete}
                    />
                  </Stack>
                </Box>
              );
            })
          )}
        </Box>
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
