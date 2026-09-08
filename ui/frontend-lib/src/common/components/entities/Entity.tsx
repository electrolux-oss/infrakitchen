import { ReactNode, useLayoutEffect, useRef, useState } from "react";

import { Box } from "@mui/material";
import { SxProps, Theme } from "@mui/system";

import { CodeRepository } from "./CodeRepository";
import { EntityLink } from "./EntityLink";
import { Label } from "../labels/Label";
import { UserAvatar } from "./UserAvatar";

export interface EntityRecord {
  id?: string;
  name?: string;
  identifier?: string;
  /** Entity type in snake_case, e.g. ``"source_code"``. */
  entityType?: string;
  /** Wire alias for ``entityType`` — raw entity-data blobs use this name. */
  entityName?: string;
  template?: { name?: string } | null;
  /** Populated for code repositories (``entityType === "source_code"``). */
  sourceCodeUrl?: string;
  sourceCodeProvider?: string;
}

export interface EntityProps {
  entity?: EntityRecord | null;
  /** Show the type/template label chip (hidden by default). */
  showLabel?: boolean;
  /** Styles forwarded to the rendered link. */
  sx?: SxProps<Theme>;
  /** Truncate the link text on a single line (see EntityLink). */
  noWrap?: boolean;
}

// ``entityName`` is the entity type in snake_case (and EntityLink's
// routing key), not the display name — title-case it for the tag fallback
// shown when the entity has no template name. Types whose internal name
// differs from their product name get an explicit override.
const ENTITY_TYPE_DISPLAY_NAMES: Record<string, string> = {
  source_code_version: "Template Version",
};

function humanizeEntityType(entityName?: string): string {
  if (!entityName) return "";
  if (ENTITY_TYPE_DISPLAY_NAMES[entityName]) {
    return ENTITY_TYPE_DISPLAY_NAMES[entityName];
  }
  return entityName
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export const Entity = ({
  entity,
  showLabel = false,
  sx,
  noWrap = false,
}: EntityProps) => {
  const displayText = entity?.name || entity?.identifier;
  const rowRef = useRef<HTMLDivElement>(null);
  const [labelWrapped, setLabelWrapped] = useState(false);

  // When the name + label chip don't fit on one line, drop the chip to its own
  // line below the name.
  useLayoutEffect(() => {
    if (!entity || !showLabel) {
      setLabelWrapped(false);
      return;
    }
    const el = rowRef.current;
    const link = el?.querySelector("a");
    if (!el || !link) return;
    const update = () => {
      const labelEl = el.querySelector(".MuiChip-root");
      const labelWidth = labelEl?.getBoundingClientRect().width ?? 0;
      const gapPx = 6; // matches the 0.75 theme spacing between items
      const available = el.clientWidth - labelWidth - gapPx;
      const range = document.createRange();
      range.selectNodeContents(link);
      const textWidth = range.getBoundingClientRect().width;
      range.detach();
      setLabelWrapped(textWidth > available + 1);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [entity, showLabel, displayText]);

  if (!entity) {
    return null;
  }
  // Raw entity-data blobs expose the type as `entityName` on the wire;
  // prefer the clearer `entityType` when constructing records directly.
  const entityType = entity.entityType ?? entity.entityName;
  let content: ReactNode;
  let tagLabel: string | undefined;
  if (entityType === "source_code") {
    content = (
      <CodeRepository
        id={entity.id}
        entityName={entityType}
        sourceCodeUrl={entity.sourceCodeUrl ?? entity.name}
        sourceCodeProvider={entity.sourceCodeProvider}
      />
    );
    tagLabel = "Code Repository";
  } else if (entityType === "user") {
    content = (
      <>
        <UserAvatar id={entity.id} identifier={displayText} />
        {entity.id ? (
          // EntityLink handles the name → identifier fallback.
          <EntityLink
            id={entity.id}
            entityName={entityType}
            name={entity.name}
            identifier={entity.identifier}
            sx={sx}
            noWrap={noWrap}
          />
        ) : (
          <>{displayText}</>
        )}
      </>
    );
    tagLabel = "User";
  } else if (entity.id) {
    // EntityLink handles the name → identifier fallback.
    content = (
      <EntityLink
        id={entity.id}
        entityName={entityType}
        name={entity.name}
        identifier={entity.identifier}
        sx={sx}
        noWrap={noWrap}
      />
    );
    tagLabel = entity.template?.name || humanizeEntityType(entityType);
  } else {
    content = <>{displayText}</>;
    tagLabel = entity.template?.name || humanizeEntityType(entityType);
  }
  const label = showLabel && tagLabel ? <Label label={tagLabel} /> : null;
  const contentRow = {
    display: "flex",
    alignItems: "center",
    gap: 0.75,
    minWidth: 0,
  } as const;

  if (labelWrapped) {
    return (
      <Box
        ref={rowRef}
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 0.5,
          minWidth: 0,
          width: "100%",
        }}
      >
        <Box sx={contentRow}>{content}</Box>
        {label}
      </Box>
    );
  }

  return (
    <Box ref={rowRef} sx={contentRow}>
      {content}
      {label}
    </Box>
  );
};
