import { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "../../../ui";
import { Label } from "../../../ui/Label";
import { cn } from "../../../utils/cn";

/**
 * Base layout card shared by the section cards on entity detail pages (and the
 * card-like groups on overview pages). Renders an optional header — icon,
 * name, status chip and actions — above a two-column grid that hosts
 * the caller's fields, so every card keeps a consistent structure and rhythm.
 *
 * The header is only rendered when at least one of its parts is provided;
 * a card with no header collapses straight into its content grid.
 */
export interface BaseCardProps {
  /** Card title rendered next to the icon; may be any React node. */
  name?: ReactNode;
  /** Supporting text shown under the title (header subheader). */
  description?: ReactNode;
  /** Body content, typically CommonField cells of the 2-col grid. */
  children?: ReactNode;
  /** Header actions (e.g. edit / refresh buttons) rendered on the right. */
  actions?: ReactNode;
  /** Leading icon shown before the title. */
  icon?: ReactNode;
  /** Optional status text; rendered as an uppercase label after the title. */
  chip?: string;
  /** Label tone; defaults to "info". */
  chipColor?:
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning";
  /** Class names merged onto the root Card. */
  className?: string;
}

export const BaseCard = (props: BaseCardProps) => {
  const {
    name,
    description,
    children,
    actions,
    icon,
    chip,
    chipColor = "info",
    className,
  } = props;

  // Skip the header entirely unless the caller supplied at least one of its
  // pieces, so a pure content card renders without a stray empty header.
  const hasHeader = !!(name || description || actions || chip || icon);

  return (
    <Card className={cn("w-full", className)}>
      {hasHeader && (
        <CardHeader
          title={
            // Icon + title + chip share a row; the chip sits inline after the name.
            <div className="flex items-center gap-4">
              {icon}
              {name}
              {chip && <Label tone={chipColor} label={chip.toUpperCase()} />}
            </div>
          }
          subheader={description ? description : undefined}
          subheaderClassName="mt-2"
          action={actions}
        />
      )}
      <CardContent>
        {/* Two columns from md up; a field with span="full" takes the whole row. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
      </CardContent>
    </Card>
  );
};
