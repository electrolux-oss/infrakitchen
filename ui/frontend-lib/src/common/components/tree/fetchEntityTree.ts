import { InfraKitchenApi } from "../../..";
import {
  RESOURCE_TREE_QUERY,
  GqlResourceTreeNode,
} from "../../../resources/graphql";
import {
  GqlTemplateTreeNode,
  TEMPLATE_TREE_QUERY,
} from "../../../templates/graphql";

import { TreeResponse } from "./types";

export async function fetchEntityTree(
  ikApi: InfraKitchenApi,
  entityName: string,
  entityId: string,
  direction: "parents" | "children",
): Promise<TreeResponse> {
  if (entityName === "resource") {
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
