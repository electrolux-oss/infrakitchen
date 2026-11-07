import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "../../ui";
import { Label } from "../../ui/Label";

/** One changed attribute of a drifted object, see server tools/tf_drift.py. */
export interface DriftAttribute {
  path: string;
  /** the real value */
  before: string;
  /** the configured value, which an apply sets */
  after: string;
}

/** An object the next apply would change. */
export interface DriftChange {
  address: string;
  /** "create": the object is missing, e.g. deleted outside of InfraKitchen */
  action: "update" | "create" | "delete" | "replace";
  attributes: DriftAttribute[];
  attributes_truncated?: boolean;
}

const ACTION_LABELS: Record<
  string,
  { label: string; tone: "warning" | "error" }
> = {
  update: { label: "changed", tone: "warning" },
  create: { label: "missing", tone: "error" },
  delete: { label: "deleted on apply", tone: "error" },
  replace: { label: "replaced on apply", tone: "error" },
};

const DriftChangeItem = ({ change }: { change: DriftChange }) => {
  const action = ACTION_LABELS[change.action];
  return (
    <li className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-body2 break-all">{change.address}</span>
        {action && (
          <Label label={action.label} tone={action.tone} size="small" />
        )}
      </div>
      {change.attributes.length > 0 && (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Attribute</TableCell>
                <TableCell>Real value</TableCell>
                <TableCell>Configured value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {change.attributes.map((attribute) => (
                <TableRow key={attribute.path}>
                  <TableCell className="font-mono break-all">
                    {attribute.path}
                  </TableCell>
                  <TableCell className="font-mono break-all">
                    {attribute.before}
                  </TableCell>
                  <TableCell className="font-mono break-all">
                    {attribute.after}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {change.attributes_truncated && (
        <span className="text-caption text-fg-muted">
          More attributes changed, the list is truncated.
        </span>
      )}
    </li>
  );
};

/** Drifted objects with their changed attributes, the real value next to the configured one. */
export const DriftChangesTable = ({ changes }: { changes: DriftChange[] }) => (
  <ul className="m-0 flex list-none flex-col gap-4 p-0">
    {changes.map((change) => (
      <DriftChangeItem key={change.address} change={change} />
    ))}
  </ul>
);
