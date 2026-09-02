import { forwardRef } from "react";

import {
  Add as AddIcon,
  DeleteOutlined as DeleteOutlineIcon,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { deleteIconButtonStyle } from "../buttons/deleteIconButtonStyle";
import { dashedAddButtonSx } from "../../utils/dashedAddButtonSx";
import { solidChipColorSx } from "../../utils/softChip";

interface Tag {
  name: string;
  value: string;
  inherited_by_children: boolean;
}

interface TagInputProps {
  label: string;
  errors: any;
  value: Tag[];
  onChange: (value: Tag[]) => void;
  name?: string;
  showErrors?: boolean;
  /** Hide the section header (label + count chip + add action). When set,
   * only the editable rows render so a caller can keep its own header. */
  hideHeader?: boolean;
  [key: string]: any;
}

const TagInput = forwardRef<any, TagInputProps>((props, _ref) => {
  const {
    errors,
    label,
    value,
    onChange,
    name,
    showErrors = false,
    hideHeader = false,
  } = props;
  const currentValue: Tag[] = Array.isArray(value) ? value : [];

  const sanitizeTag = (tag: Tag): Tag => ({
    ...tag,
    name: (tag.name || "").trim(),
    value: (tag.value || "").trim(),
  });

  const fieldErrors = name ? errors?.[name] : undefined;
  const hasValidationError = showErrors && Boolean(fieldErrors);

  const handleAdd = () => {
    onChange([
      ...currentValue,
      { name: "", value: "", inherited_by_children: true },
    ]);
  };

  const handleRemove = (index: number) => {
    const newValue = [...currentValue];
    newValue.splice(index, 1);
    onChange(newValue);
  };

  const handleFieldChange = (
    index: number,
    fieldName: keyof Tag,
    fieldValue: any,
  ) => {
    const newValue = [...currentValue];
    newValue[index] = { ...newValue[index], [fieldName]: fieldValue };
    onChange(newValue);
  };

  return (
    <Box sx={{ mt: 2, px: 2 }}>
      {!hideHeader && (
        /* Section header: label, entry count */
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
          <Chip
            label={String(currentValue.length)}
            sx={solidChipColorSx("info", undefined, undefined, true)}
          />
        </Box>
      )}

      {currentValue.length > 0 && (
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 1,
            pb: 0,
            color: "text.secondary",
          }}
        >
          {/* Column captions shown once, instead of "Name"/"Value" labels on
              every row. Reserve the switch + remove-action widths so the
              captions stay aligned with the fields below. */}
          <Typography
            variant="caption"
            sx={{ flex: "1 1 180px", minWidth: 160 }}
          >
            Name
          </Typography>
          <Typography
            variant="caption"
            sx={{ flex: "1 1 180px", minWidth: 160 }}
          >
            Value
          </Typography>
          <Box sx={{ flex: "0 0 auto", width: 178 }} />
          <Box sx={{ flex: "0 0 auto", width: 28 }} />
        </Box>
      )}

      {currentValue.map((item: Tag, index: number) => (
        <Box
          key={index}
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "flex-start",
            gap: 1,
            pt: 0.25,
          }}
        >
          <TextField
            variant="outlined"
            margin="dense"
            value={item.name}
            onChange={(e) => handleFieldChange(index, "name", e.target.value)}
            error={
              fieldErrors?.[index]?.name
                ? true
                : hasValidationError && sanitizeTag(item).name === ""
            }
            helperText={fieldErrors?.[index]?.name?.message || undefined}
            required
            slotProps={{ htmlInput: { "aria-label": `Tag name ${index + 1}` } }}
            sx={{ flex: "1 1 180px", minWidth: 160 }}
          />
          <TextField
            variant="outlined"
            value={item.value}
            onChange={(e) => handleFieldChange(index, "value", e.target.value)}
            error={
              fieldErrors?.[index]?.value
                ? true
                : hasValidationError && sanitizeTag(item).value === ""
            }
            helperText={fieldErrors?.[index]?.value?.message || undefined}
            margin="dense"
            required
            slotProps={{
              htmlInput: { "aria-label": `Tag value ${index + 1}` },
            }}
            sx={{ flex: "1 1 180px", minWidth: 160 }}
          />
          <FormControlLabel
            control={
              <Switch
                checked={item.inherited_by_children}
                onChange={(e) =>
                  handleFieldChange(
                    index,
                    "inherited_by_children",
                    e.target.checked,
                  )
                }
              />
            }
            label={
              <Typography variant="body2">Inherited By Children</Typography>
            }
            sx={{ alignSelf: "center", my: 0.5, ml: 0 }}
          />
          <Tooltip title="Remove">
            <IconButton
              size="small"
              sx={{ ...deleteIconButtonStyle, alignSelf: "center", my: 0.5 }}
              onClick={() => handleRemove(index)}
              aria-label="Remove"
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ))}
      {!hideHeader && (
        /* Add action sits under the rows, matching the other list editors. */
        <Box sx={{ mt: 1 }}>
          <Button
            startIcon={<AddIcon />}
            onClick={handleAdd}
            sx={dashedAddButtonSx}
          >
            Add
          </Button>
        </Box>
      )}
      {showErrors && typeof fieldErrors?.message === "string" && (
        <Typography
          variant="body2"
          sx={{
            color: "error.main",
            mt: 1,
          }}
        >
          {fieldErrors.message}
        </Typography>
      )}
    </Box>
  );
});

TagInput.displayName = "TagInput";
export default TagInput;
