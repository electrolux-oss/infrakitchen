import { useCallback, useEffect, useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { addDays, format, parseISO } from "date-fns";

import { useConfig } from "../../common";
import { CommonDialog } from "../../common/components/CommonDialog";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { GqlUser } from "../graphql";
import {
  CREATE_PERSONAL_ACCESS_TOKEN_MUTATION,
  DELETE_PERSONAL_ACCESS_TOKEN_MUTATION,
  GqlPersonalAccessToken,
  GqlPersonalAccessTokenCreate,
  PERSONAL_ACCESS_TOKENS_QUERY,
  PersonalAccessTokenInput,
} from "../graphql";

const formatExpirySummary = (value: string | null) => {
  if (!value) return "Never";
  return format(parseISO(value), "MMM dd, yyyy HH:mm");
};

const isExpired = (value: string | null) => {
  if (!value) return false;
  return parseISO(value).getTime() <= Date.now();
};

const formatDateTimeLocal = (value: Date) => {
  return format(value, "yyyy-MM-dd'T'HH:mm");
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
  const [name, setName] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const minExpiresAt = formatDateTimeLocal(new Date());
  const expirationOptions = [7, 30, 90, 180];

  useEffect(() => {
    if (!open) return;
    setName("");
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

    const input = {
      name: trimmedName,
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
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            fullWidth
            autoFocus
            helperText="Use a descriptive label so you can tell tokens apart later."
          />
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
            helperText="Leave blank for a token that does not expire."
          />
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {expirationOptions.map((days) => (
              <Button
                key={days}
                size="small"
                variant="outlined"
                disabled={isLoading}
                onClick={() =>
                  setExpiresAt(formatDateTimeLocal(addDays(new Date(), days)))
                }
              >
                {days} days
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
  token,
  onClose,
}: {
  open: boolean;
  token: string | null;
  onClose: () => void;
}) => {
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
              <Typography variant="body2" color="text.secondary">
                This is the only time the full token value will be shown. Copy
                it now and store it in a secure password manager or secret
                vault.
              </Typography>
            </Box>
          </Stack>
          <Alert severity="warning" variant="outlined">
            Anyone with this token can access your account through the CLI and
            API until the token is deleted or expires.
          </Alert>
          <Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", mb: 0.75 }}
            >
              Access token
            </Typography>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                border: (theme) => `1px solid ${theme.palette.divider}`,
                borderRadius: 1.5,
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
                  fontFamily: "monospace",
                  fontSize: 13,
                  lineHeight: 1.6,
                  wordBreak: "break-all",
                }}
              >
                {token ?? ""}
              </Typography>
              <Tooltip title="Copy token">
                <IconButton
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
            <Typography variant="caption" color="text.secondary">
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

  if (!isConfirming) {
    return (
      <Button
        size="small"
        variant="outlined"
        color="error"
        startIcon={<DeleteOutlineIcon />}
        onClick={() => setIsConfirming(true)}
      >
        Delete
      </Button>
    );
  }

  return (
    <Stack direction="row" spacing={1}>
      <Button
        size="small"
        variant="outlined"
        color="success"
        startIcon={<CheckIcon />}
        disabled={isLoading}
        onClick={() => onDelete(token.id)}
      >
        Confirm
      </Button>
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        startIcon={<CloseIcon />}
        disabled={isLoading}
        onClick={() => setIsConfirming(false)}
      >
        Cancel
      </Button>
    </Stack>
  );
};

export const UserPersonalAccessTokensCard = ({ user }: { user: GqlUser }) => {
  const { ikApi, currentUser } = useConfig();
  const [tokens, setTokens] = useState<GqlPersonalAccessToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdTokenValue, setCreatedTokenValue] = useState<string | null>(
    null,
  );

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
      const createdToken = response.createPersonalAccessToken;
      setTokens((previous) => [createdToken, ...previous]);
      setCreatedTokenValue(createdToken.token);
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
      <OverviewCard
        name="Personal Access Tokens"
        description="Create and delete tokens for CLI and API access on your account."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              onClick={loadTokens}
              disabled={isLoading}
            >
              Refresh
            </Button>
            <Button
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
            gridColumn: "1 / -1",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {isLoading ? (
            <Typography variant="body2" color="text.secondary">
              Loading tokens...
            </Typography>
          ) : tokens.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No personal access tokens yet.
            </Typography>
          ) : (
            tokens.map((token) => {
              return (
                <Box
                  key={token.id}
                  sx={{
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    borderRadius: 2,
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
                      <Typography variant="h6">{token.name}</Typography>
                      {isExpired(token.expiresAt) ? (
                        <Chip label="Expired" size="small" color="error" />
                      ) : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Prefix: <code>{token.tokenPrefix}</code>
                    </Typography>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      spacing={2}
                      useFlexGap
                    >
                      <Typography variant="body2" color="text.secondary">
                        Expires: {formatExpirySummary(token.expiresAt)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Last used:{" "}
                        {token.lastUsedAt ? (
                          <RelativeTime date={token.lastUsedAt} />
                        ) : (
                          "Never"
                        )}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Created: <RelativeTime date={token.createdAt} />
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
      </OverviewCard>
      <TokenDialog
        open={dialogOpen}
        isLoading={isSaving}
        onClose={() => setDialogOpen(false)}
        onSave={handleCreate}
      />
      <TokenValueDialog
        open={Boolean(createdTokenValue)}
        token={createdTokenValue}
        onClose={() => setCreatedTokenValue(null)}
      />
    </>
  );
};
