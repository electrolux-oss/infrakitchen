import { InfraKitchenApi } from "../../api/InfraKitchenApi";
import { Entity } from "../../common/components/entities/Entity";
import { EntityTableColumn } from "../../common/components/entity_table/EntityTable";
import type {
  FilterDeriveContext,
  ReferenceLoader,
} from "../../common/components/filter_panel/FilterConfig";
import { RenderCellParams } from "../../ui";
import {
  GqlWorkerTemplateShort,
  WORKER_TEMPLATE_OPTIONS_QUERY,
} from "../graphql";

/** Options from the query every user can read, worker templates themselves are admin only. */
const workerTemplateReference = (ctx: FilterDeriveContext): ReferenceLoader => {
  const ikApi: InfraKitchenApi = ctx.ikApi;
  const load = async () =>
    (
      await ikApi.graphqlRequest<{
        workerTemplateOptions: GqlWorkerTemplateShort[];
      }>(WORKER_TEMPLATE_OPTIONS_QUERY)
    ).workerTemplateOptions.map((template) => ({
      label: template.name,
      value: template.id,
    }));
  const loader: ReferenceLoader = async (search) => {
    const options = await load();
    const term = search.trim().toLowerCase();
    return term
      ? options.filter((option) => option.label.toLowerCase().includes(term))
      : options;
  };
  loader.resolveByIds = async (ids) =>
    (await load()).filter((option) => ids.includes(option.value));
  return loader;
};

/** Worker template selected by a resource or an executor, empty means the global default. */
export const workerTemplateColumn = (): EntityTableColumn => ({
  field: "workerTemplate",
  headerName: "Worker Template",
  flex: 1,
  sortField: "worker_template.name",
  filter: {
    field: "worker_template_id",
    operators: ["eq", "in", "is_none"],
    valueType: "reference",
    defaultOperator: "eq",
    makeReferenceLoader: workerTemplateReference,
  },
  valueGetter: (_value: any, row: any) => row.workerTemplate?.name ?? "",
  renderCell: (params: RenderCellParams) => {
    const template = params.row.workerTemplate as
      GqlWorkerTemplateShort | null | undefined;
    if (!template) {
      return <p className="m-0 text-body2 text-fg-muted">Global default</p>;
    }
    return <Entity entity={{ ...template, entityName: "worker_template" }} />;
  },
});
