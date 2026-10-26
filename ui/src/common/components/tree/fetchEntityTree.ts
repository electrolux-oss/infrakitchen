import { InfraKitchenApi } from "../../..";
import {
  buildResourceTreeQuery,
  GqlResourceTreeNode,
} from "../../../resources/graphql";
import {
  buildTemplateTreeQuery,
  GqlTemplateTreeNode,
} from "../../../templates/graphql";

import { TreeResponse } from "./types";

// Levels below the root entity fetched when no depth is chosen ("all").
export const MAX_TREE_DEPTH = 100;

export async function fetchEntityTree(
  ikApi: InfraKitchenApi,
  entityName: string,
  entityId: string,
  direction: "parents" | "children",
  depth: number = MAX_TREE_DEPTH,
): Promise<TreeResponse> {
  // The query builders count the root as the first level.
  const queryDepth = depth + 1;

  if (entityName === "resource") {
    const RESOURCE_TREE_QUERY = `
      query ResourceTree($id: UUID!, $direction: String!) {
        resourceTree(id: $id, direction: $direction) {
          ${buildResourceTreeQuery(queryDepth)}
        }
      }
    `;
    const response = await ikApi.graphqlRequest<{
      resourceTree: GqlResourceTreeNode | null;
    }>(RESOURCE_TREE_QUERY, {
      id: entityId,
      direction,
    });

    if (!response.resourceTree) {
      throw new Error("Could not load resource tree");
    }

    return response.resourceTree;
  }

  if (entityName === "template") {
    const TEMPLATE_TREE_FIELDS = buildTemplateTreeQuery(queryDepth);
    const TEMPLATE_TREE_QUERY = `
      query TemplateTree($id: UUID!, $direction: String!) {
        templateTree(id: $id, direction: $direction) {
          ${TEMPLATE_TREE_FIELDS}
        }
      }
    `;
    const response = await ikApi.graphqlRequest<{
      templateTree: GqlTemplateTreeNode | null;
    }>(TEMPLATE_TREE_QUERY, {
      id: entityId,
      direction,
    });

    if (!response.templateTree) {
      throw new Error("Could not load template tree");
    }

    return response.templateTree;
  }

  throw new Error(`Tree query is not supported for entity ${entityName}`);
}
