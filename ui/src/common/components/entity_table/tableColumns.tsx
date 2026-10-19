import { RenderCellParams } from "../../../ui";
import { Entity } from "../entities/Entity";
import { UserAvatar } from "../entities/UserAvatar";
import { RelativeTime } from "../fields/RelativeTime";
import { serverSearchReference } from "../filter_panel/referenceLoaders";
import { Labels } from "../labels/Labels";

import { EntityTableColumn } from "./EntityTable";

/**
 * Shared fixed width for every relative-time column (Created, Updated, Time,
 * …). 112px fits the largest short value ("12mo ago") plus the column
 * header's text + sort icon + resize handle.
 */
export const RELATIVE_TIME_COLUMN_WIDTH = 112;

/** Options for a relative-time column (renderer = RelativeTime, size small). */
export interface RelativeTimeColumnOptions {
  /** API sort field, when it differs from the column `field`. */
  sortField?: string;
  /**
   * Date accessor, for entities whose API field name differs from the row
   * property (e.g. field "created_at" but `row.createdAt`). Defaults to
   * `params.value`, which matches when the field and row property agree.
   */
  value?: (params: RenderCellParams) => string | Date | null | undefined;
  /** Fixed column width; defaults to {@link RELATIVE_TIME_COLUMN_WIDTH}. */
  width?: number;
}

/** Options for the Created + Last Updated column pair. */
export interface CreatedUpdatedColumnOptions {
  createdField?: string;
  updatedField?: string;
  createdSortField?: string;
  updatedSortField?: string;
  createdValue?: (params: RenderCellParams) => string | Date | null | undefined;
  updatedValue?: (params: RenderCellParams) => string | Date | null | undefined;
  /**
   * Fold the creator avatar into the Created cell (time + avatar) instead of
   * a separate Creator column; the creator reference filter is kept.
   */
  withCreator?: boolean;
}

/** A single "relative time" column (e.g. Created, Last Updated, Time). */
export const relativeTimeColumn = (
  field: string,
  headerName: string,
  options: RelativeTimeColumnOptions = {},
): EntityTableColumn => ({
  field,
  headerName,
  width: options.width ?? RELATIVE_TIME_COLUMN_WIDTH,
  align: "right",
  headerAlign: "right",
  ...(options.sortField ? { sortField: options.sortField } : {}),
  renderCell: (params: RenderCellParams) => {
    const date = options.value
      ? options.value(params)
      : (params.value as string | Date | null | undefined);
    return date ? <RelativeTime date={date} compact /> : null;
  },
});

/** Created time plus creator avatar in one cell; filters by creator. */
export const createdByColumn = (
  options: CreatedUpdatedColumnOptions,
): EntityTableColumn => {
  const field = options.createdField ?? "createdAt";
  const time = relativeTimeColumn(field, "Created", {
    sortField: options.createdSortField,
    value: options.createdValue,
    width: RELATIVE_TIME_COLUMN_WIDTH,
  });
  return {
    ...time,
    fetchFields: ["creator", field],
    filter: {
      field: "created_by",
      label: "Creator",
      operators: ["eq", "in"],
      valueType: "reference",
      defaultOperator: "eq",
      makeReferenceLoader: serverSearchReference({
        entityPlural: "users",
        labelField: "identifier",
      }),
    },
    renderCell: (params: RenderCellParams) => {
      const date = options.createdValue
        ? options.createdValue(params)
        : (params.value as string | Date | null | undefined);
      const user = params.row.creator;
      return (
        <div className="flex min-w-0 items-center justify-end gap-1.5">
          {date ? <RelativeTime date={date} compact /> : null}
          {user?.id && <UserAvatar id={user.id} identifier={user.identifier} />}
        </div>
      );
    },
  };
};

/** The recurring Created / Last Updated column pair. */
export const createdUpdatedColumns = (
  options: CreatedUpdatedColumnOptions = {},
): EntityTableColumn[] => [
  options.withCreator
    ? createdByColumn(options)
    : relativeTimeColumn(options.createdField ?? "createdAt", "Created", {
        sortField: options.createdSortField,
        value: options.createdValue,
      }),
  relativeTimeColumn(options.updatedField ?? "updatedAt", "Updated", {
    sortField: options.updatedSortField,
    value: options.updatedValue,
  }),
];

/**
 * The recurring Labels column (compact chips + contains_all filter). The only
 * per-entity difference is the labelsEntity used to load filter options.
 */
export const labelsColumn = (labelsEntity: string): EntityTableColumn => ({
  field: "labels",
  headerName: "Labels",
  flex: 1,
  sortable: false,
  filter: {
    field: "labels",
    operators: ["contains_all"],
    valueType: "autocomplete-multiple",
    defaultOperator: "contains_all",
    labelsEntity,
  },
  valueGetter: (_value: any, row: any) => (row.labels || []).join(", "),
  renderCell: (params: RenderCellParams) => (
    <Labels labels={params.row.labels || []} />
  ),
});

/** Shared width for avatar-only user columns: just the avatar plus padding. */
export const USER_AVATAR_COLUMN_WIDTH = 80;

/** Options for the shared creator/user column. */
export interface UserColumnOptions {
  /** Column field; defaults to "creator". */
  field?: string;
  /** Header label; defaults to "Creator". */
  headerName?: string;
  /** Row accessor for the user object; defaults to `row.creator`. */
  value?: (row: any) => any;
  /** API sort field; pass null to omit (tables whose API can't sort by user). */
  sortField?: string | null;
  /** Filter field on the API; defaults to "created_by". */
  filterField?: string;
  /** Disable client/server sorting entirely. */
  sortable?: boolean;
  /** Omit the reference filter (for tables that can't filter by created_by). */
  disableFilter?: boolean;
}

/**
 * The recurring Creator / User column, rendered as an avatar only — it already
 * links to the user and shows the identifier in a tooltip, so the name would
 * just repeat it. Sorting and filtering still use the full identifier.
 */
export const userColumn = (
  options: UserColumnOptions = {},
): EntityTableColumn => {
  const field = options.field ?? "creator";
  const getUser = options.value ?? ((row: any) => row?.creator);
  const sortField =
    options.sortField === undefined ? `${field}.identifier` : options.sortField;

  return {
    field,
    headerName: options.headerName ?? "Creator",
    width: USER_AVATAR_COLUMN_WIDTH,
    ...(options.sortable === false ? { sortable: false } : {}),
    ...(sortField ? { sortField } : {}),
    ...(options.disableFilter
      ? {}
      : {
          filter: {
            field: options.filterField ?? "created_by",
            operators: ["eq", "in"],
            valueType: "reference",
            defaultOperator: "eq",
            makeReferenceLoader: serverSearchReference({
              entityPlural: "users",
              labelField: "identifier",
            }),
          },
        }),
    valueGetter: (_value: any, row: any) => getUser(row)?.identifier || "",
    renderCell: (params: RenderCellParams) => {
      const user = getUser(params.row);
      if (!user?.id) return null;
      return <Entity entity={{ ...user, entityType: "user" }} hideName />;
    },
  };
};

/**
 * Right alignment for columns whose value is a number, following the usual
 * convention that digits line up by place value. Spread into a column def.
 */
export const NUMERIC_COLUMN_ALIGN = {
  align: "right",
  headerAlign: "right",
} as const;
