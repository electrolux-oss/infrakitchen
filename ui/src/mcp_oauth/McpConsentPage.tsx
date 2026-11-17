import { useEffect, useMemo, useState } from "react";

import { useSearchParams } from "react-router";

import { Alert, Button, Switch } from "../ui";
import {
  ScopePicker,
  readOnlyScopesFor,
  useAvailableScopes,
} from "../users/components/ScopePicker";

interface ConsentRequest {
  client_name: string;
  redirect_host: string;
  user: string;
  requested_scopes: string[];
  csrf: string;
}

const API_BASE = "/api/mcp-oauth/requests";

const errorMessage = async (response: Response) => {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // Not JSON.
  }
  return `Request failed (${response.status})`;
};

export const McpConsentPage = () => {
  const [searchParams] = useSearchParams();
  const txn = searchParams.get("txn") ?? "";
  const availableScopes = useAvailableScopes();

  const [request, setRequest] = useState<ConsentRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [fullAccess, setFullAccess] = useState(false);
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (!txn) {
      setError("Missing authorization request.");
      return;
    }
    fetch(`${API_BASE}/${encodeURIComponent(txn)}`, {
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(await errorMessage(response));
        setRequest(await response.json());
      })
      .catch((e: Error) => setError(e.message));
  }, [txn]);

  // Default selection: what the client asked for (capped at what the user may
  // grant), otherwise read-only access to everything.
  const defaultScopes = useMemo(() => {
    if (!request) return null;
    const grantable = new Set(
      availableScopes.flatMap(({ entity, actions }) =>
        actions.map((action) => `${action}:${entity}`),
      ),
    );
    const requested = request.requested_scopes.filter((scope) =>
      grantable.has(scope),
    );
    return requested.length > 0
      ? requested
      : readOnlyScopesFor(availableScopes);
  }, [request, availableScopes]);

  useEffect(() => {
    if (initialised || !defaultScopes || availableScopes.length === 0) return;
    setSelectedScopes(new Set(defaultScopes));
    setInitialised(true);
  }, [defaultScopes, availableScopes, initialised]);

  const submit = async (decision: "allow" | "deny") => {
    if (!request) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/${encodeURIComponent(txn)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csrf: request.csrf,
          decision,
          scopes: fullAccess ? null : Array.from(selectedScopes).sort(),
        }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const { redirect_url } = await response.json();
      window.location.assign(redirect_url);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-[100vh] items-center justify-center p-4">
      <div className="w-full max-w-xl rounded-surface border border-divider bg-canvas p-6 shadow-lg">
        {error ? (
          <>
            <h2 className="mt-0 text-h5">Authorization failed</h2>
            <Alert severity="error" variant="outlined">
              {error}
            </Alert>
            <p className="text-body2 text-fg-muted">
              Start the connection again from your client.
            </p>
          </>
        ) : !request ? (
          <p className="text-body2 text-fg-muted">Loading…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="mt-0 mb-1 text-h5">
                Authorize {request.client_name}
              </h2>
              <p className="m-0 text-body2">
                <b>{request.client_name}</b> wants to access InfraKitchen as{" "}
                <b>{request.user}</b> via MCP. You will be redirected to{" "}
                <code>{request.redirect_host}</code>.
              </p>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-body2">
              <Switch
                checked={fullAccess}
                onChange={() => setFullAccess((value) => !value)}
                inputProps={{ "aria-label": "Full access" }}
              />
              Full access (same as your account, including admin actions)
            </label>

            {fullAccess ? (
              <Alert severity="warning" variant="outlined">
                The client will be able to do everything you can, including
                approving, destroying and managing permissions.
              </Alert>
            ) : (
              <ScopePicker
                availableScopes={availableScopes}
                selectedScopes={selectedScopes}
                onChange={setSelectedScopes}
                subject="A connected client"
                selectionNote="The client is limited to the access chosen below. Admin actions are never included."
                emptySelectionNote="Choose at least one permission, or enable full access."
              />
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outlined"
                disabled={submitting}
                onClick={() => submit("deny")}
              >
                Deny
              </Button>
              <Button
                variant="contained"
                disabled={
                  submitting || (!fullAccess && selectedScopes.size === 0)
                }
                onClick={() => submit("allow")}
              >
                Allow
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default McpConsentPage;
