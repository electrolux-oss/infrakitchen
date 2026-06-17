import { useCallback } from "react";

import { TextField } from "@mui/material";

import {
  CommonField,
  GetReferenceUrlValue,
} from "../../common/components/CommonField";
import { CommonEditableField } from "../../common/components/editors/CommonEditableField";
import { StringTagEditor } from "../../common/components/editors/StringTagEditor";
import { FavoriteButton } from "../../common/components/FavoriteButton";
import { Labels } from "../../common/components/Labels";
import { OverviewCard } from "../../common/components/OverviewCard";
import { RelativeTime } from "../../common/components/RelativeTime";
import { useConfig } from "../../common/context";
import { useEntityProvider } from "../../common/context/EntityContext";
import { usePermissionProvider } from "../../common/context/PermissionContext";
import { notify, notifyError } from "../../common/hooks/useNotification";
import StatusChip from "../../common/StatusChip";
import { sameStringSet } from "../../common/utils";
import { ExecutorUpdateFieldInput, EXECUTOR_UPDATE_MUTATION } from "../graphql";
import { ExecutorResponse } from "../types";

import { SourceCodeConfigEditor } from "./SourceCodeConfigEditor";

export interface ExecutorAboutProps {
  executor: ExecutorResponse;
}

export const ExecutorOverview = ({ executor }: ExecutorAboutProps) => {
  const { ikApi } = useConfig();
  const { refreshEntity } = useEntityProvider();
  const { checkActionPermission } = usePermissionProvider();
  const canEdit = checkActionPermission("api:executor", "write");

  const saveField = useCallback(
    async (input: ExecutorUpdateFieldInput) => {
      try {
        await ikApi.graphqlRequest(EXECUTOR_UPDATE_MUTATION, {
          id: executor.id,
          input,
        });
        notify("Executor updated successfully", "success");
        refreshEntity?.();
      } catch (error) {
        notifyError(error);
        throw error;
      }
    },
    [ikApi, executor.id, refreshEntity],
  );

  return (
    <OverviewCard
      name={executor.name}
      description={executor.description || "No description"}
      actions={
        <FavoriteButton
          componentId={String(executor.id)}
          componentType="executor"
          ariaLabel="Add executor to favorites"
          isFavorite={executor.isFavorite}
        />
      }
    >
      <CommonField
        name={"State"}
        value={<StatusChip status={executor.status} state={executor.state} />}
      />
      <CommonEditableField<string>
        name={"Description"}
        canEdit={canEdit}
        value={executor.description ?? ""}
        ariaLabel="Edit description"
        display={<span>{executor.description || "No description"}</span>}
        onSave={(value) => saveField({ description: value })}
        renderEditor={({ value, onChange }) => (
          <TextField
            value={value}
            onChange={(e) => onChange(e.target.value)}
            label="Description"
            fullWidth
            multiline
            minRows={2}
            margin="normal"
            autoFocus
          />
        )}
      />
      <CommonField
        name={"Code Repository"}
        value={
          executor.sourceCode ? (
            <GetReferenceUrlValue {...executor.sourceCode} />
          ) : null
        }
      />
      <SourceCodeConfigEditor executor={executor} canEdit={canEdit} />

      <CommonField
        name={"Created"}
        value={
          <RelativeTime date={executor.createdAt} user={executor.creator} />
        }
      />
      <CommonField
        name={"Last Updated"}
        value={<RelativeTime date={executor.updatedAt} />}
      />
      <CommonEditableField<string[]>
        name={"Labels"}
        canEdit={canEdit}
        value={executor.labels}
        ariaLabel="Edit labels"
        isEqual={sameStringSet}
        display={<Labels labels={executor.labels} />}
        onSave={(value) => saveField({ labels: value })}
        renderEditor={({ value, onChange }) => (
          <StringTagEditor
            value={value}
            onChange={onChange}
            label="Labels"
            helperText="Press Enter to add a label"
          />
        )}
        size={12}
      />
    </OverviewCard>
  );
};
