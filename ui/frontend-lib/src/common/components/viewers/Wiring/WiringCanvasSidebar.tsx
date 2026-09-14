import React, { useEffect, useState } from "react";

import AddIcon from "@mui/icons-material/Add";
import NumbersIcon from "@mui/icons-material/Numbers";
import SearchIcon from "@mui/icons-material/Search";
import StorageIcon from "@mui/icons-material/Storage";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import TuneIcon from "@mui/icons-material/Tune";
import {
  Box,
  Button,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import {
  TEMPLATE_SHORT_FIELDS,
  GqlTemplateShort,
} from "../../../../templates/graphql";
import { useConfig } from "../../../context";
import { AbstractChip } from "../../labels/AbstractChip";

import { useCanvasPalette } from "./helpers";
import { GenericTemplate } from "./types";
import {
  ConstantType,
  WiringCanvasExternalTemplate,
} from "./WiringCanvas.types";

export const DRAG_TYPE = "application/ik-template";
export const DRAG_TYPE_EXTERNAL = "application/ik-external-template";

/**
 * Compact styling for the draggable palette entries: `ListItemButton` inherits
 * app-navigation geometry that is far too roomy for a 220px palette.
 */
const PALETTE_ITEM_SX = {
  borderRadius: "var(--template-surface-radius)",
  m: 0,
  mb: 0.5,
  px: 1,
  py: 0.25,
  minHeight: 0,
  gap: 0.5,
  cursor: "grab",
  "&:active": { cursor: "grabbing" },
  border: "1px dashed",
  borderColor: "divider",
  bgcolor: "action.hover",
  "&:hover": { bgcolor: "action.selected" },
} as const;

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
  const palette = useCanvasPalette();
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
    <Box
      sx={{
        width: 220,
        minWidth: 220,
        borderRight: `1px solid ${palette.divider}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: "text.secondary",
          }}
        >
          Available Templates
        </Typography>
        <TextField
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          sx={{ mt: 0.5 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon
                    fontSize="small"
                    sx={{ color: "text.disabled" }}
                  />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>
      <List
        dense
        sx={{
          flex: missingParentTemplates.length > 0 ? "0 1 auto" : 1,
          overflowY: "auto",
          px: 0.5,
          py: 0,
          maxHeight: missingParentTemplates.length > 0 ? "50%" : undefined,
        }}
      >
        {filteredTemplates.length === 0 && (
          <Typography
            variant="caption"
            sx={{
              color: "text.disabled",
              px: 1.5,
              py: 1,
              display: "block",
            }}
          >
            {search ? "No matches" : "All templates added"}
          </Typography>
        )}

        {filteredTemplates.map((t) => (
          <ListItemButton
            key={t.id}
            draggable
            onDragStart={(e) => handleDragStart(e, t)}
            onClick={() => onAdd(t as unknown as GenericTemplate)}
            sx={PALETTE_ITEM_SX}
          >
            <ListItemText
              primary={t.name}
              slotProps={{ primary: { variant: "body2", noWrap: true } }}
            />
            {t.abstract && <AbstractChip />}
            <Tooltip title="Add to canvas" arrow>
              <AddIcon
                fontSize="small"
                sx={{ color: "text.disabled", ml: 0.5 }}
              />
            </Tooltip>
          </ListItemButton>
        ))}
      </List>
      {missingParentTemplates.length > 0 && (
        <>
          <Divider />
          <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: "warning.main",
                display: "flex",
                alignItems: "center",
                gap: 0.5,
              }}
            >
              <StorageIcon sx={{ fontSize: 14 }} />
              Input Templates
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
              }}
            >
              Parent templates - add to wire outputs to dependent resources.
            </Typography>
          </Box>

          <List dense sx={{ flex: 1, overflowY: "auto", px: 0.5, py: 0 }}>
            {availableParentTemplates.length === 0 && (
              <Typography
                variant="caption"
                sx={{
                  color: "text.disabled",
                  px: 1.5,
                  py: 1,
                  display: "block",
                }}
              >
                All parent templates added
              </Typography>
            )}

            {availableParentTemplates.map((t) => (
              <ListItemButton
                key={t.id}
                draggable
                onDragStart={(e) => handleExternalDragStart(e, t)}
                onClick={() => onExternalTemplateAdd(t)}
                sx={{ ...PALETTE_ITEM_SX, borderColor: "warning.dark" }}
              >
                <ListItemText
                  primary={t.name}
                  slotProps={{ primary: { variant: "body2", noWrap: true } }}
                />
                {t.abstract && <AbstractChip />}
                <Tooltip title="Add as input" arrow>
                  <AddIcon
                    fontSize="small"
                    sx={{ color: "warning.main", ml: 0.5 }}
                  />
                </Tooltip>
              </ListItemButton>
            ))}
          </List>
        </>
      )}
      <Divider />
      <Box sx={{ px: 1.5, pt: 1, pb: 1.5 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            color: "secondary.main",
            display: "flex",
            alignItems: "center",
            gap: 0.5,
          }}
        >
          <TuneIcon sx={{ fontSize: 14 }} />
          Constants
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
          }}
        >
          Fixed values wired to inputs.
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5, mt: 1 }}>
          <Button
            color="secondary"
            startIcon={<TextFieldsIcon />}
            onClick={() => onConstantAdd("string")}
            sx={{ flex: 1 }}
          >
            String
          </Button>
          <Button
            color="secondary"
            startIcon={<NumbersIcon />}
            onClick={() => onConstantAdd("number")}
            sx={{ flex: 1 }}
          >
            Number
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
