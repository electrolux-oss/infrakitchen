import { useLocation, useNavigate } from "react-router";

import { useConfig } from "../context/ConfigContext";

/**
 * Navigation state the "Create" shortcuts on entity pages pass to a create
 * page, which reads it to prefill its form.
 */
export interface CreatePrefillState {
  integration_id?: string;
  integration_ids?: string[];
  project_id?: string;
  source_code_branch?: string;
  source_code_id?: string;
  source_code_provider?: string;
  source_code_version_id?: string;
  storage_id?: string;
  storage_provider?: string;
  template_id?: string;
}

// Typed as a record so a key added to the interface must be added here too.
const PREFILL_KEYS: Record<keyof CreatePrefillState, true> = {
  integration_id: true,
  integration_ids: true,
  project_id: true,
  source_code_branch: true,
  source_code_id: true,
  source_code_provider: true,
  source_code_version_id: true,
  storage_id: true,
  storage_provider: true,
  template_id: true,
};

/** Prefill values passed to the current create page, if any. */
export function useCreatePrefill(): CreatePrefillState {
  const location = useLocation();
  return (location.state ?? {}) as CreatePrefillState;
}

/**
 * Cancel handler for a create page: returns to the page that opened it through
 * a shortcut, otherwise to the entity list at `listPath`.
 */
export function useCreatePageBack(listPath: string) {
  const location = useLocation();
  const navigate = useNavigate();
  const { linkPrefix } = useConfig();

  const state = location.state as Record<string, unknown> | null;
  const fromShortcut = Object.keys(PREFILL_KEYS).some(
    (key) => state?.[key] !== undefined,
  );
  // "default" is the first entry of the session, so there is nothing to go back to.
  const canGoBack = fromShortcut && location.key !== "default";

  return () =>
    canGoBack ? navigate(-1) : navigate(`${linkPrefix}${listPath}`);
}
