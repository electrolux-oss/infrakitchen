import { forwardRef } from "react";

import { useConfig } from "../../common";
import {
  DefaultableSelect,
  type DefaultableSelectProps,
} from "../../common/components/inputs/DefaultableSelect";
import {
  GqlWorkerTemplateShort,
  WORKER_TEMPLATE_OPTIONS_QUERY,
} from "../graphql";
import { useCanSelectWorkerTemplate } from "../hooks/useCanSelectWorkerTemplate";
import { defaultWorkerTemplateLabel, isEnabledWorkerTemplate } from "../types";

type WorkerTemplateSelectProps = Omit<
  DefaultableSelectProps<GqlWorkerTemplateShort>,
  "loadOptions" | "isSelectable" | "isDefault" | "defaultLabel" | "renderOption"
>;

/**
 * Select of enabled worker templates; users without access to worker templates
 * can only pick public ones. An empty value means the global default template is used,
 * or static workers when no default is set.
 */
export const WorkerTemplateSelect = forwardRef<
  HTMLElement,
  WorkerTemplateSelectProps
>(({ helperText, ...props }, ref) => {
  const { ikApi } = useConfig();
  const { canSelect } = useCanSelectWorkerTemplate();
  return (
    <DefaultableSelect<GqlWorkerTemplateShort>
      {...props}
      ref={ref}
      loadOptions={() =>
        ikApi
          .graphqlRequest<{ workerTemplateOptions: GqlWorkerTemplateShort[] }>(
            WORKER_TEMPLATE_OPTIONS_QUERY,
          )
          .then((response) => response.workerTemplateOptions)
      }
      isSelectable={(template) =>
        isEnabledWorkerTemplate(template) && canSelect(template)
      }
      isDefault={(template) => template.isDefault}
      defaultLabel={defaultWorkerTemplateLabel}
      renderOption={(template) => (
        <>
          {template.name}
          {!isEnabledWorkerTemplate(template) && " (disabled)"}
        </>
      )}
      helperText={
        helperText ??
        "Workers that run the tasks. Leave the global default to follow the template set in Worker Templates."
      }
    />
  );
});

WorkerTemplateSelect.displayName = "WorkerTemplateSelect";
