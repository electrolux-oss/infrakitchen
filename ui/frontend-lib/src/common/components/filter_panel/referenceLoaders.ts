import { InfraKitchenApi } from "../../../api/InfraKitchenApi";

import {
  FilterDeriveContext,
  ReferenceLoader,
  ReferenceOption,
} from "./FilterConfig";

export interface ReferenceLoaderOpts {
  /** GraphQL plural query name, e.g. "templates", "users" */
  entityPlural: string;
  /** Field to use as the display label, e.g. "name", "identifier" */
  labelField: string;
  /** Optional base filter always applied */
  baseFilter?: Record<string, any>;
}

export type StringOptionsLoader = () => Promise<string[]>;

function mapReferenceOptions(
  entities: Array<Record<string, any>>,
  labelField: string,
): ReferenceOption[] {
  return entities
    .filter((e) => e.id && e[labelField])
    .map((e) => ({ label: e[labelField], value: e.id }));
}

/**
 * Creates a reference loader that performs server-side search.
 * Uses `labelField__like` to filter on the backend.
 * Returns { label: displayField, value: id } pairs.
 * Good for large datasets (templates, projects, resources).
 */
export const makeServerSearchReferenceLoader = (
  ikApi: InfraKitchenApi,
  opts: ReferenceLoaderOpts,
): ReferenceLoader => {
  const resolveByIds = async (ids: string[]): Promise<ReferenceOption[]> => {
    if (ids.length === 0) return [];

    const filter: Record<string, any> = {
      ...opts.baseFilter,
      id__in: ids,
    };

    const response = await ikApi.graphqlRequest<Record<string, any>>(
      `query ReferenceResolveByIds($filter: JSON) {
        ${opts.entityPlural}(filter: $filter) {
          id
          ${opts.labelField}
        }
      }`,
      {
        filter,
      },
    );

    const entities: Array<Record<string, any>> =
      response[opts.entityPlural] || [];

    return mapReferenceOptions(entities, opts.labelField);
  };

  const loader = async (search: string): Promise<ReferenceOption[]> => {
    const filter: Record<string, any> = { ...opts.baseFilter };
    if (search.trim()) {
      filter[`${opts.labelField}__like`] = search.trim();
    }

    const response = await ikApi.graphqlRequest<Record<string, any>>(
      `query ReferenceSearch($filter: JSON, $sort: [String!], $range: [Int!]) {
        ${opts.entityPlural}(filter: $filter, sort: $sort, range: $range) {
          id
          ${opts.labelField}
        }
      }`,
      {
        filter,
        sort: [opts.labelField, "ASC"],
        range: [0, 50],
      },
    );

    const entities: Array<Record<string, any>> =
      response[opts.entityPlural] || [];

    return mapReferenceOptions(entities, opts.labelField);
  };

  loader.resolveByIds = resolveByIds;
  return loader;
};

/**
 * Creates a lazy loader for entity labels.
 * Fetches labels only on first use and caches them for subsequent calls.
 */
export const makeLabelsLoader = (
  ikApi: InfraKitchenApi,
  entity: string,
): StringOptionsLoader => {
  let cachedLabels: string[] | null = null;
  let fetchPromise: Promise<string[]> | null = null;

  return async (): Promise<string[]> => {
    if (cachedLabels) return cachedLabels;
    if (fetchPromise) return fetchPromise;

    fetchPromise = ikApi
      .graphqlRequest<{ labels: string[] }>(
        `query EntityLabels($entity: String!) {
          labels: labels(entity: $entity)
        }`,
        { entity },
      )
      .then((response) => {
        cachedLabels = response.labels || [];
        return cachedLabels;
      });

    return fetchPromise;
  };
};

/**
 * Factory helper for server-side search reference loaders.
 * Usage in a column's filter spec:
 *   makeReferenceLoader: serverSearchReference({ entityPlural: "templates", labelField: "name" })
 */
export const serverSearchReference =
  (opts: ReferenceLoaderOpts) =>
  (ctx: FilterDeriveContext): ReferenceLoader =>
    makeServerSearchReferenceLoader(ctx.ikApi, opts);
