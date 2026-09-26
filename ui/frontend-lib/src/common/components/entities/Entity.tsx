import { ReactNode, useLayoutEffect, useRef, useState } from "react";

import CallSplitOutlinedIcon from "@mui/icons-material/CallSplitOutlined";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Box, Tooltip } from "@mui/material";
import { SxProps, Theme } from "@mui/system";

import { ProviderIcon } from "../../../icons/Icons";
import VersionLifecycleStateChip from "../../VersionLifecycleStateChip";
import { Label } from "../labels/Label";

import { CodeRepository } from "./CodeRepository";
import { EntityLink } from "./EntityLink";
import { UserAvatar } from "./UserAvatar";

export interface EntityRecord {
  id?: string;
  name?: string;
  identifier?: string;
  /** Entity type in snake_case, e.g. ``"source_code"``. */
  entityType?: string;
  /** Wire alias for ``entityType`` — raw entity-data blobs use this name. */
  entityName?: string;
  /** Provider route segment used by integration detail links. */
  integrationProvider?: string;
  /** Nullable: the GraphQL layer returns `null` for the unused ref kind. */
  sourceCodeVersion?: string | null;
  sourceCodeBranch?: string | null;
  lifecycleState?: string | null;
  breakingChanges?: string | null;
  template?: { name?: string } | null;
  /** Populated for code repositories (``entityType === "source_code"``). */
  sourceCodeUrl?: string;
  sourceCodeProvider?: string;
  /** Populated for workspaces (``entityType === "workspace"``). */
  workspaceProvider?: string;
}

export interface EntityProps {
  entity?: EntityRecord | null;
  /** Show the type/template label chip (hidden by default). */
  showLabel?: boolean;
  /** Styles forwarded to the rendered link. */
  sx?: SxProps<Theme>;
  /** Class name forwarded to the rendered link. */
  linkClassName?: string;
  /** Size of the provider icon shown for integration entities. */
  providerIconSize?: number;
  /** Render the entity name without a navigational link. */
  disableLink?: boolean;
  /** Truncate the link text on a single line (see EntityLink). */
  noWrap?: boolean;
  /** Force the label chip onto its own line below the name, instead of auto-detecting based on available width. */
  stacked?: boolean;
  /** Show the lifecycle chip for Template Version entities when lifecycle data is available. */
  showLifecycleState?: boolean;
  /** Labelled chip, or a compact dot for dense contexts like grid rows. */
  lifecycleVariant?: "chip" | "dot";
  /** Render only the icon/avatar, omitting the name. For dense columns. */
  hideName?: boolean;
}

// ``entityName`` is the entity type in snake_case (and EntityLink's
// routing key), not the display name — title-case it for the tag fallback
// shown when the entity has no template name. Types whose internal name
// differs from their product name get an explicit override.
const ENTITY_TYPE_DISPLAY_NAMES: Record<string, string> = {
  source_code_version: "Template Version",
};

export function humanizeEntityType(entityName?: string): string {
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
  linkClassName,
  providerIconSize,
  disableLink = false,
  noWrap = false,
  stacked = false,
  showLifecycleState = true,
  lifecycleVariant = "chip",
  hideName = false,
}: EntityProps) => {
  const isSourceCodeVersion =
    (entity?.entityType || entity?.entityName) === "source_code_version";
  const displayText = isSourceCodeVersion
    ? entity?.sourceCodeVersion ||
      entity?.sourceCodeBranch ||
      entity?.name ||
      entity?.identifier
    : entity?.name || entity?.identifier;
  const rowRef = useRef<HTMLDivElement>(null);
  const [labelWrapped, setLabelWrapped] = useState(false);

  // When the name + label chip don't fit on one line, drop the chip to its own
  // line below the name.
  useLayoutEffect(() => {
    if (!entity || !showLabel || stacked) {
      setLabelWrapped(false);
      return;
    }
    const el = rowRef.current;
    const link = el?.querySelector("a");
    if (!el || !link) return;
    const update = () => {
      const labelEl = el.querySelector(".Entity-typeLabel");
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
  }, [entity, showLabel, stacked, displayText]);

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
        disableLink={disableLink}
      />
    );
    tagLabel = "Code Repository";
  } else if (entityType === "user") {
    content = (
      <>
        <UserAvatar id={entity.id} identifier={displayText} />
        {/* The avatar links to the user and shows the identifier on hover. */}
        {!hideName &&
          (entity.id ? (
            <EntityLink
              id={entity.id}
              entityName={entityType}
              name={entity.name}
              identifier={entity.identifier}
              sx={sx}
              className={linkClassName}
              noWrap={noWrap}
            />
          ) : (
            <>{displayText}</>
          ))}
      </>
    );
    tagLabel = "User";
  } else if (entity.id) {
    const SourceCodeRefIcon =
      entityType === "source_code_version"
        ? entity.sourceCodeVersion
          ? LocalOfferOutlinedIcon
          : CallSplitOutlinedIcon
        : null;
    const entityName = disableLink ? (
      <Box
        component="span"
        sx={[
          noWrap
            ? {
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }
            : {},
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        {displayText}
      </Box>
    ) : (
      <EntityLink
        id={entity.id}
        entityName={entityType}
        urlProvider={
          entityType === "integration" ? entity.integrationProvider : undefined
        }
        name={displayText}
        identifier={entity.identifier}
        sx={sx}
        className={linkClassName}
        noWrap={noWrap}
      />
    );

    const showLifecycle =
      entityType === "source_code_version" &&
      showLifecycleState &&
      !!entity.lifecycleState;

    // In the dense "dot" layout, the breaking-changes warning icon is shown
    // separately after the name instead of bundled with the dot, so the
    // order reads as: dot, ref icon, name, warning icon.
    const lifecycleIndicator = showLifecycle && (
      <VersionLifecycleStateChip
        lifecycleState={entity.lifecycleState!}
        breakingChanges={entity.breakingChanges ?? undefined}
        variant={lifecycleVariant}
        hideBreakingChangesWarning={lifecycleVariant === "dot"}
      />
    );
    const hasBreakingChanges = Boolean(entity.breakingChanges?.trim());
    const trailingBreakingChangesWarning = showLifecycle &&
      lifecycleVariant === "dot" &&
      hasBreakingChanges && (
        <Tooltip title={entity.breakingChanges}>
          <WarningAmberIcon color="warning" fontSize="small" />
        </Tooltip>
      );

    content = (
      <>
        {/* The dot leads the row; the labelled chip trails the name. */}
        {lifecycleVariant === "dot" && lifecycleIndicator}
        {entityType === "integration" && (
          <ProviderIcon
            provider={entity.integrationProvider}
            size={providerIconSize}
          />
        )}
        {entityType === "workspace" && (
          <ProviderIcon
            provider={entity.workspaceProvider}
            size={providerIconSize}
          />
        )}
        {SourceCodeRefIcon && (
          <SourceCodeRefIcon
            color="action"
            sx={{ fontSize: 18, flexShrink: 0 }}
          />
        )}
        {entityName}
        {lifecycleVariant === "dot" && trailingBreakingChangesWarning}
        {lifecycleVariant !== "dot" && lifecycleIndicator}
      </>
    );
    tagLabel = entity.template?.name || humanizeEntityType(entityType);
  } else {
    content = <>{displayText}</>;
    tagLabel = entity.template?.name || humanizeEntityType(entityType);
  }
  const label =
    showLabel && tagLabel ? (
      <Label className="Entity-typeLabel" label={tagLabel} />
    ) : null;
  const contentRow = {
    display: "flex",
    alignItems: "center",
    gap: 0.75,
    minWidth: 0,
  } as const;

  if (labelWrapped || stacked) {
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
        <Box sx={{ ...contentRow, width: "100%" }}>{content}</Box>
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
