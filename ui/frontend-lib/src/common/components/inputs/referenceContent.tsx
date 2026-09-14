import { ReactNode } from "react";

import { IkEntity } from "../../../types";
import { Entity } from "../entities/Entity";

const REFERENCE_ENTITY_CONFIG: Record<
  string,
  {
    entityType: string;
    fields: string[];
    providerIconSize?: number;
    useFallbackName?: boolean;
  }
> = {
  integrations: {
    entityType: "integration",
    fields: ["integrationProvider"],
    providerIconSize: 24,
  },
  source_codes: {
    entityType: "source_code",
    fields: ["sourceCodeUrl", "sourceCodeProvider"],
  },
  source_code_versions: {
    entityType: "source_code_version",
    fields: [
      "sourceCodeVersion",
      "sourceCodeBranch",
      "lifecycleState",
      "breakingChanges",
    ],
    useFallbackName: true,
  },
};

export const getReferenceQueryFields = (
  entityName: string,
  fields: string[],
) => [
  ...fields,
  ...(REFERENCE_ENTITY_CONFIG[entityName]?.fields || []).filter(
    (field) => !fields.includes(field),
  ),
];

export const ReferenceContent = ({
  entityName,
  entity,
  fallback,
}: {
  entityName: string;
  entity: IkEntity;
  fallback: ReactNode;
}) => {
  const config = REFERENCE_ENTITY_CONFIG[entityName];
  if (!config) return fallback;

  return (
    <Entity
      entity={{
        ...entity,
        entityType: config.entityType,
        name:
          config.useFallbackName && typeof fallback === "string"
            ? fallback
            : entity.name,
      }}
      providerIconSize={config.providerIconSize}
      disableLink
    />
  );
};
