import { useCallback } from "react";

import { useNavigate, useParams } from "react-router";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import { Button } from "@mui/material";
import { gql } from "graphql-request";

import { EntityContainer } from "../../common/components/EntityContainer";
import { useConfig } from "../../common/context/ConfigContext";
import { EntityProvider } from "../../common/context/EntityContext";
import { getGraphQLClient, initGraphQLClient } from "../../graphql/client";
import { BlueprintContent } from "../components/BlueprintContent";
import { BlueprintResponse } from "../types";

const BLUEPRINT_QUERY = gql`
  query Blueprint($id: UUID!) {
    blueprint(id: $id) {
      id
      name
      description
      templates {
        id
        name
        cloudResourceTypes
      }
      wiring
      defaultVariables
      configuration
      labels
      status
      revisionNumber
      createdBy
      creator {
        id
        identifier
      }
      workflows {
        id
        status
        errorMessage
        steps {
          id
          templateId
          template {
            id
            name
          }
          resourceId
          position
          status
          errorMessage
        }
        startedAt
        completedAt
        createdAt
      }
      createdAt
      updatedAt
    }
  }
`;

interface GqlBlueprintStep {
  id: string;
  templateId: string;
  template: { id: string; name: string } | null;
  resourceId: string | null;
  position: number;
  status: string;
  errorMessage: string | null;
}

interface GqlBlueprintWorkflow {
  id: string;
  status: string;
  errorMessage: string | null;
  steps: GqlBlueprintStep[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface GqlBlueprint {
  id: string;
  name: string;
  description: string | null;
  templates:
    | { id: string; name: string; cloudResourceTypes: string[] }[]
    | null;
  wiring: any;
  defaultVariables: any;
  configuration: any;
  labels: string[] | null;
  status: string;
  revisionNumber: number;
  createdBy: string | null;
  creator: { id: string; identifier: string } | null;
  workflows: GqlBlueprintWorkflow[] | null;
  createdAt: string;
  updatedAt: string;
}

function transformBlueprint(gql: GqlBlueprint): BlueprintResponse {
  return {
    id: gql.id,
    name: gql.name,
    description: gql.description ?? "",
    templates: (gql.templates ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      cloud_resource_types: t.cloudResourceTypes ?? [],
      _entity_name: "template" as const,
    })),
    wiring: gql.wiring ?? [],
    default_variables: gql.defaultVariables ?? {},
    configuration: gql.configuration ?? {},
    labels: gql.labels ?? [],
    status: gql.status as BlueprintResponse["status"],
    revision_number: gql.revisionNumber,
    created_by: gql.creator
      ? {
          id: gql.creator.id,
          identifier: gql.creator.identifier,
          _entity_name: "user",
          provider: "",
        }
      : (gql.createdBy ?? ""),
    workflows: (gql.workflows ?? []).map((w) => ({
      id: w.id,
      status: w.status as BlueprintResponse["workflows"][0]["status"],
      error_message: w.errorMessage,
      steps: w.steps.map((s) => ({
        id: s.id,
        template_id: s.templateId,
        resource_id: s.resourceId,
        position: s.position,
        status: s.status as BlueprintResponse["workflows"][0]["status"],
        error_message: s.errorMessage,
        resolved_variables: {},
        parent_resource_ids: [],
        integration_ids: [],
        secret_ids: [],
        source_code_version_id: null,
        started_at: null,
        completed_at: null,
      })),
      wiring_snapshot: [],
      variable_overrides: {},
      created_by: "",
      started_at: w.startedAt,
      completed_at: w.completedAt,
      created_at: w.createdAt,
    })),
    created_at: gql.createdAt,
    updated_at: gql.updatedAt,
    _entity_name: "blueprint",
  };
}

export const BlueprintPage = () => {
  const { blueprint_id } = useParams();
  const navigate = useNavigate();
  const { linkPrefix, ikApi } = useConfig();

  const fetchBlueprint = useCallback(
    async (_name: string, id: string) => {
      try {
        getGraphQLClient();
      } catch {
        initGraphQLClient(ikApi);
      }
      const client = getGraphQLClient();
      const { blueprint } = await client.request<{
        blueprint: GqlBlueprint | null;
      }>(BLUEPRINT_QUERY, { id });
      if (!blueprint) throw new Error("Blueprint not found");
      return transformBlueprint(blueprint);
    },
    [ikApi],
  );

  return (
    <EntityProvider
      entity_name="blueprint"
      entity_id={blueprint_id || ""}
      fetchFn={fetchBlueprint}
    >
      <EntityContainer
        title="Blueprint Overview"
        actions={
          <Button
            variant="contained"
            color="primary"
            startIcon={<PlayArrowIcon />}
            onClick={() =>
              navigate(`${linkPrefix}blueprints/${blueprint_id}/use`)
            }
          >
            Use Blueprint
          </Button>
        }
      >
        <BlueprintContent />
      </EntityContainer>
    </EntityProvider>
  );
};

BlueprintPage.path = "/blueprints/:blueprint_id/:tab?";
