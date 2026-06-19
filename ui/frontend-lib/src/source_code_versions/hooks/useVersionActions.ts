import { useState } from "react";

import { useConfig } from "../../common";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { ENTITY_ACTION, ENTITY_STATUS } from "../../utils";
import {
  CREATE_SOURCE_CODE_VERSION_MUTATION,
  DELETE_SOURCE_CODE_VERSION_MUTATION,
  GqlSourceCodeVersion,
  SOURCE_CODE_VERSION_ACTION_MUTATION,
} from "../graphql";
import { RefType, SourceCodeVersionCreate } from "../types";

export function useVersionActions(
  sourceCodeId: string,
  entity: GqlSourceCodeVersion | undefined,
  onRefresh: () => void,
) {
  const { ikApi } = useConfig();
  const [localInProgress, setLocalInProgress] = useState(false);

  const dispatchAction = async (id: string, action: string) => {
    await ikApi.graphqlRequest(SOURCE_CODE_VERSION_ACTION_MUTATION, {
      id,
      input: { action },
    });
  };

  const toggleEnabled = async () => {
    if (!entity) return;

    try {
      if (entity.status === ENTITY_STATUS.DONE) {
        await dispatchAction(entity.id, ENTITY_ACTION.DISABLE);
        notify("Version disabled successfully", "success");
      } else if (entity.status === ENTITY_STATUS.DISABLED) {
        await dispatchAction(entity.id, ENTITY_ACTION.ENABLE);
        await dispatchAction(entity.id, ENTITY_ACTION.SYNC);
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
      sourceCodeId: sourceCodeId,
      ...(type === RefType.BRANCH
        ? { sourceCodeBranch: entry }
        : { sourceCodeVersion: entry }),
      templateId: templateId,
      sourceCodeFolder: folder,
      description: "",
      labels: [],
    };

    try {
      const response = await ikApi.graphqlRequest<{
        createSourceCodeVersion: { id: string };
      }>(CREATE_SOURCE_CODE_VERSION_MUTATION, { input: payload });
      onRefresh();
      const created = response.createSourceCodeVersion;
      await dispatchAction(created.id, ENTITY_ACTION.SYNC);
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
      await ikApi.graphqlRequest(DELETE_SOURCE_CODE_VERSION_MUTATION, {
        id: entity.id,
      });
      onRefresh();
    } catch (error) {
      notifyError(error);
    }
  };

  const triggerSync = async () => {
    if (!entity) return;
    await dispatchAction(entity.id, ENTITY_ACTION.SYNC);
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
