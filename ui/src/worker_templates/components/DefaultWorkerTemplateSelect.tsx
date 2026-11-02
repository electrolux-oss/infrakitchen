import { useState } from "react";

import { useConfig } from "../../common";
import { notify, notifyError } from "../../common/hooks/useNotification";
import { MenuItem, TextField } from "../../ui";
import {
  GqlWorkerTemplateShort,
  SET_DEFAULT_WORKER_TEMPLATE_MUTATION,
} from "../graphql";
import { defaultWorkerTemplateLabel, isEnabledWorkerTemplate } from "../types";

const STATIC_WORKERS = "";

interface DefaultWorkerTemplateSelectProps {
  templates: GqlWorkerTemplateShort[];
  defaultTemplate: GqlWorkerTemplateShort | null;
  onChanged: () => void;
}

/**
 * Picks the global default, which runs the tasks of entities without a selected template:
 * static workers or one enabled worker template.
 */
export const DefaultWorkerTemplateSelect = ({
  templates,
  defaultTemplate,
  onChanged,
}: DefaultWorkerTemplateSelectProps) => {
  const { ikApi } = useConfig();
  const [submitting, setSubmitting] = useState(false);
  const options = templates.filter(isEnabledWorkerTemplate);

  const change = async (id: string) => {
    if (id === (defaultTemplate?.id ?? STATIC_WORKERS)) return;
    try {
      setSubmitting(true);
      await ikApi.graphqlRequest(SET_DEFAULT_WORKER_TEMPLATE_MUTATION, {
        id: id || null,
      });
      const name = options.find((t) => t.id === id)?.name;
      notify(
        name
          ? `${name} is the global default`
          : "Static workers are the global default",
        "success",
      );
      onChanged();
    } catch (error: any) {
      notifyError(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <TextField
      select
      size="small"
      aria-label="Global default"
      className="min-w-64"
      value={defaultTemplate?.id ?? STATIC_WORKERS}
      disabled={submitting}
      // static workers have an empty value, which Select renders as blank unless displayEmpty is set
      selectProps={{
        displayEmpty: true,
        renderValue: () => defaultWorkerTemplateLabel(defaultTemplate),
      }}
      onChange={(event) => change(event.target.value)}
    >
      <MenuItem value={STATIC_WORKERS}>Static workers</MenuItem>
      {options.map((template) => (
        <MenuItem key={template.id} value={template.id}>
          {template.name}
        </MenuItem>
      ))}
    </TextField>
  );
};
