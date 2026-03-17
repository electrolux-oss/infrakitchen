import { useState } from "react";

import { useConfig } from "../../common";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { ENTITY_ACTION, ENTITY_STATUS } from "../../utils";
import {
  RefType,
  SourceCodeVersionCreate,
  SourceCodeVersionResponse,
} from "../types";

export function useVersionActions(
  sourceCodeId: string,
  entity: SourceCodeVersionResponse | undefined,
  onRefresh: () => void,
) {
  const { ikApi } = useConfig();
  const [localInProgress, setLocalInProgress] = useState(false);

  const toggleEnabled = async () => {
    if (!entity) return;

    try {
      if (entity.status === ENTITY_STATUS.DONE) {
        await ikApi.patchRaw(`source_code_versions/${entity.id}/actions`, {
          action: ENTITY_ACTION.DISABLE,
        });
        notify("Version disabled successfully", "success");
      } else if (entity.status === ENTITY_STATUS.DISABLED) {
        await ikApi.patchRaw(`source_code_versions/${entity.id}/actions`, {
          action: ENTITY_ACTION.ENABLE,
        });
        await ikApi.patchRaw(`source_code_versions/${entity.id}/actions`, {
          action: ENTITY_ACTION.SYNC,
        });
        notify("Version enabled and sync task created", "success");
      }
    } catch {
      notifyError("Action failed, please try again later");
    }
  };

  const createVersion = async (
    entry: string,
    type: RefType,
    templateId: string,
    folder: string,
  ): Promise<void> => {
    setLocalInProgress(true);

    const payload: SourceCodeVersionCreate = {
      source_code_id: sourceCodeId,
      ...(type === RefType.BRANCH
        ? { source_code_branch: entry }
        : { source_code_version: entry }),
      template_id: templateId,
      source_code_folder: folder,
      description: "",
      labels: [],
    };

    try {
      const response = await ikApi.postRaw("source_code_versions", payload);
      onRefresh();
      await ikApi.patchRaw(`source_code_versions/${response.id}/actions`, {
        action: ENTITY_ACTION.SYNC,
      });
      notify("Version created. Sync task created.", "success");
    } catch (error) {
      notifyError(error);
      throw error;
    } finally {
      setLocalInProgress(false);
    }
  };

  const deleteVersion = async () => {
    if (!entity) return;
    try {
      await ikApi.deleteRaw(`source_code_versions/${entity.id}`, {});
      onRefresh();
    } catch (error) {
      notifyError(error);
    }
  };

  const triggerSync = async () => {
    if (!entity) return;
    await ikApi.patchRaw(`source_code_versions/${entity.id}/actions`, {
      action: ENTITY_ACTION.SYNC,
    });
    notify("Sync task created.", "success");
  };

  return {
    localInProgress,
    toggleEnabled,
    createVersion,
    deleteVersion,
    triggerSync,
  };
}
