import React, { useEffect, useState } from "react";

import {
  AddIcon,
  DataObjectIcon,
  NumbersIcon,
  SearchIcon,
  StorageIcon,
  TextFieldsIcon,
} from "../../../../icons/material";
import {
  TEMPLATE_SHORT_FIELDS,
  GqlTemplateShort,
} from "../../../../templates/graphql";
import {
  Divider,
  Button,
  Tooltip,
  InputAdornment,
  ListItemText,
  TextField,
  List,
  ListItemButton,
} from "../../../../ui";
import { cn } from "../../../../utils/cn";
import { useConfig } from "../../../context";
import { AbstractChip } from "../../labels/AbstractChip";

import { GenericTemplate } from "./types";
import {
  ConstantType,
  WiringCanvasExternalTemplate,
} from "./WiringCanvas.types";

export const DRAG_TYPE = "application/ik-template";
export const DRAG_TYPE_EXTERNAL = "application/ik-external-template";

/**
 * Compact styling for the draggable palette entries.
 */
const PALETTE_ITEM_CLASS =
  "mb-1 min-h-0 shrink-0 cursor-grab gap-1 rounded-surface border border-dashed border-divider bg-hover px-2 py-0.5 hover:bg-selected active:cursor-grabbing";

interface WiringCanvasSidebarProps {
  selectedIds: Set<string>;
  onAdd: (template: GenericTemplate) => void;
  missingParentTemplates: WiringCanvasExternalTemplate[];
  externalTemplateIds: Set<string>;
  onExternalTemplateAdd: (template: WiringCanvasExternalTemplate) => void;
  onConstantAdd: (type: ConstantType) => void;
}

export function WiringCanvasSidebar({
  selectedIds,
  onAdd,
  missingParentTemplates,
  externalTemplateIds,
  onExternalTemplateAdd,
  onConstantAdd,
}: WiringCanvasSidebarProps) {
  const { ikApi } = useConfig();

  const [templates, setTemplates] = useState<GenericTemplate[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    ikApi
      .graphqlRequest<{ templates: GqlTemplateShort[] }>(
        `query Templates($sort: [String!], $range: [Int!]) {
          templates(sort: $sort, range: $range) {
            ${TEMPLATE_SHORT_FIELDS}
          }
        }`,
        {
          sort: ["name", "ASC"],
          range: [0, 500],
        },
      )
      .then((res) => setTemplates(res.templates || []))
      .catch(() => {});
  }, [ikApi]);

  const filteredTemplates = templates.filter(
    (t) =>
      !selectedIds.has(t.id) &&
      !externalTemplateIds.has(t.id) &&
      t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const availableParentTemplates = missingParentTemplates.filter(
    (t) => !externalTemplateIds.has(t.id),
  );

  const handleDragStart = (e: React.DragEvent, template: GenericTemplate) => {
    e.dataTransfer.setData(
      DRAG_TYPE,
      JSON.stringify({
        id: template.id,
        name: template.name,
        entityName: template.entityName,
      }),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleExternalDragStart = (
    e: React.DragEvent,
    template: WiringCanvasExternalTemplate,
  ) => {
    e.dataTransfer.setData(
      DRAG_TYPE_EXTERNAL,
      JSON.stringify({
        id: template.id,
        name: template.name,
        abstract: template.abstract,
      }),
    );
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="flex w-55 min-w-55 flex-col overflow-hidden border-r border-r-divider bg-canvas">
      <div className="px-3 pt-3 pb-1">
        <span className="text-caption font-bold text-fg-muted">
          Available Templates
        </span>
        <TextField
          className="mt-1"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          startAdornment={
            <InputAdornment position="start">
              <SearchIcon className="text-fg-disabled" fontSize="small" />
            </InputAdornment>
          }
        />
      </div>
      <List
        className={cn(
          "overflow-y-auto px-1 py-0",
          missingParentTemplates.length > 0 ? "max-h-[50%]" : undefined,
          missingParentTemplates.length > 0 ? "flex-initial" : "flex-1",
        )}
        dense
      >
        {filteredTemplates.length === 0 && (
          <span className="block px-3 py-2 text-caption text-fg-disabled">
            {search ? "No matches" : "All templates added"}
          </span>
        )}

        {filteredTemplates.map((t) => (
          <ListItemButton
            key={t.id}
            draggable
            onDragStart={(e) => handleDragStart(e, t)}
            onClick={() => onAdd(t as unknown as GenericTemplate)}
            className={PALETTE_ITEM_CLASS}
          >
            <ListItemText
              primary={t.name}
              primaryClassName="truncate font-normal"
            />
            {t.abstract && <AbstractChip />}
            <Tooltip title="Add to canvas" arrow>
              <AddIcon className="ml-1 text-fg-disabled" fontSize="small" />
            </Tooltip>
          </ListItemButton>
        ))}
      </List>
      {missingParentTemplates.length > 0 && (
        <>
          <Divider />
          <div className="px-3 pt-2 pb-1">
            <span className="flex items-center gap-1 text-caption font-bold text-warning">
              <StorageIcon className="text-[14px]" />
              Input Templates
            </span>
            <span className="text-caption text-fg-muted">
              Parent templates - add to wire outputs to dependent resources.
            </span>
          </div>

          <List className="flex-1 overflow-y-auto px-1 py-0" dense>
            {availableParentTemplates.length === 0 && (
              <span className="block px-3 py-2 text-caption text-fg-disabled">
                All parent templates added
              </span>
            )}

            {availableParentTemplates.map((t) => (
              <ListItemButton
                key={t.id}
                draggable
                onDragStart={(e) => handleExternalDragStart(e, t)}
                onClick={() => onExternalTemplateAdd(t)}
                className={cn(PALETTE_ITEM_CLASS, "border-warning-dark")}
              >
                <ListItemText
                  primary={t.name}
                  primaryClassName="truncate font-normal"
                />
                {t.abstract && <AbstractChip />}
                <Tooltip title="Add as input" arrow>
                  <AddIcon className="ml-1 text-warning" fontSize="small" />
                </Tooltip>
              </ListItemButton>
            ))}
          </List>
        </>
      )}
      <Divider />
      <div className="px-3 pt-2 pb-3">
        <span className="flex items-center gap-1 text-caption font-bold text-secondary">
          <DataObjectIcon className="text-[14px]" />
          Constants
        </span>
        <span className="text-caption text-fg-muted">
          Fixed values wired to inputs.
        </span>
        <div className="mt-2 flex gap-1">
          <Button
            className="flex-1"
            color="secondary"
            startIcon={<TextFieldsIcon />}
            onClick={() => onConstantAdd("string")}
          >
            String
          </Button>
          <Button
            className="flex-1"
            color="secondary"
            startIcon={<NumbersIcon />}
            onClick={() => onConstantAdd("number")}
          >
            Number
          </Button>
        </div>
      </div>
    </div>
  );
}
