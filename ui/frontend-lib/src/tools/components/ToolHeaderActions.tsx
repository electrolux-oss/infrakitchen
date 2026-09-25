import { useState } from "react";

import { Button } from "@mui/material";

import { useConfig } from "../../common";
import { useEntityProvider } from "../../common/context/EntityContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import {
  DOWNLOAD_TOOL_MUTATION,
  SET_DEFAULT_TOOL_MUTATION,
  TOOL_ACTION_MUTATION,
} from "../graphql";
import { ToolDetail, toolLabel } from "../types";

/** Header actions of the tool page, clearing the default, disable and delete are in the danger zone. */
export const ToolHeaderActions = () => {
  const { ikApi } = useConfig();
  const { entity, actions, refreshEntity, refreshActions } =
    useEntityProvider();
  const tool = entity as ToolDetail | undefined;

  const [submitting, setSubmitting] = useState(false);

  if (!tool) {
    return null;
  }

  const run = async (request: () => Promise<unknown>, message: string) => {
    try {
      setSubmitting(true);
      await request();
      notify(message, "success");
      refreshEntity?.();
      refreshActions?.();
    } catch (error: any) {
      notifyError(error);
    } finally {
      setSubmitting(false);
    }
  };

  const retryDownload = () =>
    run(
      () =>
        ikApi.graphqlRequest(DOWNLOAD_TOOL_MUTATION, {
          input: {
            name: tool.name,
            version: tool.version,
            os: tool.os,
            arch: tool.arch,
          },
        }),
      `Downloading ${tool.name} ${tool.version}`,
    );

  const setDefault = () =>
    run(
      () => ikApi.graphqlRequest(SET_DEFAULT_TOOL_MUTATION, { id: tool.id }),
      `${toolLabel(tool)} is the global default`,
    );

  const enable = () =>
    run(
      () =>
        ikApi.graphqlRequest(TOOL_ACTION_MUTATION, {
          id: tool.id,
          input: { action: "enable" },
        }),
      `${toolLabel(tool)} is enabled`,
    );

  return (
    <>
      {actions.includes("enable") && (
        <Button onClick={enable} disabled={submitting}>
          Enable
        </Button>
      )}
      {actions.includes("download") && (
        <Button onClick={retryDownload} disabled={submitting}>
          Retry download
        </Button>
      )}
      {actions.includes("set_default") && (
        <Button onClick={setDefault} disabled={submitting}>
          Set default
        </Button>
      )}
    </>
  );
};
