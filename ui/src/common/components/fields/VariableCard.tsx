import React, { ReactNode } from "react";

import { Chip } from "../../../ui";
import { cn } from "../../../utils/cn";
import { CodeBlock } from "../code/CodeBlock";
import { InlineCode } from "../code/InlineCode";

import { PlaceholderDescription } from "./PlaceholderDescription";

export interface VariableCardProps {
  /** Variable name shown as the card heading */
  name: string;
  /** Drives the required/optional chip */
  required?: boolean;
  /** HCL type expression; multi-line types render in a code block */
  type?: string | null;
  description?: string | null;
  /** Extra chips rendered after the required/optional chip */
  chips?: ReactNode;
  /** Extra content rendered below the description in the left column */
  footer?: ReactNode;
  /** Right column content (default value, input, ...) */
  children?: ReactNode;
  className?: string;
}

/**
 * Shared shell for the variable cards used by template version details
 * (read-only defaults) and the resource variable forms (editable inputs).
 */
export const VariableCard: React.FC<VariableCardProps> = ({
  name,
  required = false,
  type,
  description,
  chips,
  footer,
  children,
  className,
}) => (
  <div
    className={cn("mb-4 rounded-surface border border-divider p-4", className)}
  >
    <div className="grid grid-cols-1 items-center md:grid-cols-[2fr_1fr]">
      <div className="min-w-0">
        <span className="mr-2 text-body1 font-medium">{name}</span>{" "}
        {required ? (
          <Chip label="required" appearance="solid" color="error" />
        ) : (
          <Chip label="optional" appearance="solid" color="info" />
        )}
        {chips}
        {type && (
          <div className="mt-2 flex items-start gap-2">
            <span className="text-caption text-fg-muted">Type:</span>
            {type.includes("\n") ? (
              <CodeBlock disableCopy className="max-h-[200px] max-w-full">
                {type}
              </CodeBlock>
            ) : (
              <InlineCode disableCopy>{type}</InlineCode>
            )}
          </div>
        )}
        <span className="mt-2 block text-caption text-fg-muted">
          {description ? description : <PlaceholderDescription />}
        </span>
        {footer}
      </div>

      <div className="mt-2 min-w-0 md:mt-0">{children}</div>
    </div>
  </div>
);
