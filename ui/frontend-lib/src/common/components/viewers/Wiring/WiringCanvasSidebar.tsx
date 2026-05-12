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
  Chip,
  Divider,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";

import { useConfig } from "../../../context";

import { GenericTemplate } from "./types";
import {
  ConstantType,
  WiringCanvasExternalTemplate,
} from "./WiringCanvas.types";

export const DRAG_TYPE = "application/ik-template";
export const DRAG_TYPE_EXTERNAL = "application/ik-external-template";

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
  const theme = useTheme();
  const { ikApi } = useConfig();

  const [templates, setTemplates] = useState<GenericTemplate[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    ikApi
      .getList("templates", {
        pagination: { page: 1, perPage: 500 },
        sort: { field: "name", order: "ASC" },
      })
      .then((res) => setTemplates(res.data || []))
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
        _entity_name: template._entity_name,
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
        borderRight: `1px solid ${theme.palette.divider}`,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary">
          Available Templates
        </Typography>
        <TextField
          size="small"
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
            color="text.disabled"
            sx={{ px: 1.5, py: 1, display: "block" }}
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
            sx={{
              borderRadius: 1,
              mb: 0.25,
              cursor: "grab",
              "&:active": { cursor: "grabbing" },
              border: "1px dashed",
              borderColor: "divider",
              py: 0.5,
              bgcolor: "action.hover",
              "&:hover": { bgcolor: "action.selected" },
            }}
          >
            <ListItemText
              primary={t.name}
              slotProps={{ primary: { variant: "body2", noWrap: true } }}
            />
            {t.abstract && (
              <Chip
                label="Abstract"
                size="small"
                color="warning"
                variant="outlined"
                sx={{
                  fontWeight: 600,
                  fontSize: "0.6rem",
                  height: 18,
                  mr: 0.5,
                }}
              />
            )}
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
              fontWeight={700}
              color="warning.main"
              sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
            >
              <StorageIcon sx={{ fontSize: 14 }} />
              Input Templates
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Parent templates - add to wire outputs to dependent resources.
            </Typography>
          </Box>

          <List dense sx={{ flex: 1, overflowY: "auto", px: 0.5, py: 0 }}>
            {availableParentTemplates.length === 0 && (
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ px: 1.5, py: 1, display: "block" }}
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
                sx={{
                  borderRadius: 1,
                  mb: 0.25,
                  cursor: "grab",
                  "&:active": { cursor: "grabbing" },
                  border: "1px dashed",
                  borderColor: "warning.dark",
                  py: 0.5,
                  bgcolor: "action.hover",
                  "&:hover": { bgcolor: "action.selected" },
                }}
              >
                <ListItemText
                  primary={t.name}
                  slotProps={{ primary: { variant: "body2", noWrap: true } }}
                />
                {t.abstract && (
                  <Chip
                    label="Abstract"
                    size="small"
                    color="warning"
                    variant="outlined"
                    sx={{
                      fontWeight: 600,
                      fontSize: "0.6rem",
                      height: 18,
                      mr: 0.5,
                    }}
                  />
                )}
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
          fontWeight={700}
          color="secondary.main"
          sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
        >
          <TuneIcon sx={{ fontSize: 14 }} />
          Constants
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Fixed values wired to inputs.
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5, mt: 1 }}>
          <Button
            size="small"
            variant="outlined"
            color="secondary"
            startIcon={<TextFieldsIcon />}
            onClick={() => onConstantAdd("string")}
            sx={{ flex: 1 }}
          >
            String
          </Button>
          <Button
            size="small"
            variant="outlined"
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
