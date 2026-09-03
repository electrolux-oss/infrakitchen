import { forwardRef } from "react";

import {
  Add as AddIcon,
  DeleteOutlined as DeleteOutlineIcon,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Chip,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";

import { deleteIconButtonStyle } from "../../common/components/buttons/deleteIconButtonStyle";
import { dashedAddButtonSx } from "../../common/utils/dashedAddButtonSx";
import { solidChipColorSx } from "../../common/utils/softChip";
import { CustomSecret } from "../types";

interface CustomSecretInputProps {
  label: string;
  errors: any;
  value: CustomSecret[];
  onChange: (value: CustomSecret[]) => void;
  /** Hide the section header (label + count chip + add action) so a caller can
   * keep its own header; only the editable rows render. */
  hideHeader?: boolean;
  [key: string]: any;
}

const CustomSecretInput = forwardRef<any, CustomSecretInputProps>(
  (props, _ref) => {
    const { errors, label, value, onChange, hideHeader = false } = props;
    const currentValue: CustomSecret[] = Array.isArray(value) ? value : [];

    const handleAdd = () => {
      onChange([...currentValue, { name: "", value: "" }]);
    };

    const handleRemove = (index: number) => {
      const newValue = [...currentValue];
      newValue.splice(index, 1);
      onChange(newValue);
    };

    const handleFieldChange = (
      index: number,
      fieldName: keyof CustomSecret,
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
                every row. The trailing spacer reserves the remove-button width
                so the captions align with the fields below. */}
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
            <Box sx={{ flex: "0 0 auto", width: 30 }} />
          </Box>
        )}

        {currentValue.map((item, index) => (
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
              error={!!errors?.[item.name]?.[index]?.name}
              helperText={errors?.[item.name]?.[index]?.name?.message}
              required
              slotProps={{
                htmlInput: { "aria-label": `Secret name ${index + 1}` },
              }}
              sx={{ flex: "1 1 180px", minWidth: 160 }}
            />
            <TextField
              variant="outlined"
              type="password"
              margin="dense"
              value={item.value}
              onChange={(e) =>
                handleFieldChange(index, "value", e.target.value)
              }
              error={!!errors?.[item.name]?.[index]?.value}
              helperText={errors?.[item.name]?.[index]?.value?.message}
              required
              slotProps={{
                htmlInput: { "aria-label": `Secret value ${index + 1}` },
              }}
              sx={{ flex: "1 1 180px", minWidth: 160 }}
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
      </Box>
    );
  },
);

CustomSecretInput.displayName = "CustomSecretInput";
export default CustomSecretInput;
