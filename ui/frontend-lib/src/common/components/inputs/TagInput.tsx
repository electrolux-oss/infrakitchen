import { forwardRef } from "react";

import {
  Add as AddIcon,
  DeleteOutline as DeleteOutlineIcon,
} from "@mui/icons-material";
import {
  TextField,
  FormControlLabel,
  IconButton,
  Checkbox,
  Typography,
  Grid,
  Box,
  Tooltip,
} from "@mui/material";

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
  [key: string]: any;
}

const TagInput = forwardRef<any, TagInputProps>((props, _ref) => {
  const { errors, label, value, onChange, name, showErrors = false } = props;
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
      <Grid container spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <Grid
          size={{
            xs: 12,
            sm: 11,
          }}
        >
          <Typography variant="h5" component="h3" sx={{ mb: 0 }}>
            {label}
          </Typography>
        </Grid>
        <Grid
          size={{
            xs: 12,
            sm: 1,
          }}
          sx={{ display: "flex", justifyContent: "center" }}
        >
          <Tooltip title="Add entry">
            <IconButton onClick={handleAdd} aria-label="Add entry">
              <AddIcon />
            </IconButton>
          </Tooltip>
        </Grid>
      </Grid>
      {currentValue.map((item: Tag, index: number) => (
        <Grid container spacing={2} alignItems="center" key={index}>
          <Grid
            size={{
              xs: 12,
              sm: 4,
            }}
          >
            <TextField
              label="Name"
              variant="outlined"
              margin="normal"
              value={item.name}
              onChange={(e) => handleFieldChange(index, "name", e.target.value)}
              error={
                fieldErrors?.[index]?.name
                  ? true
                  : hasValidationError && sanitizeTag(item).name === ""
              }
              helperText={fieldErrors?.[index]?.name?.message || ""}
              fullWidth
              required
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 4,
            }}
          >
            <TextField
              label="Value"
              variant="outlined"
              value={item.value}
              onChange={(e) =>
                handleFieldChange(index, "value", e.target.value)
              }
              error={
                fieldErrors?.[index]?.value
                  ? true
                  : hasValidationError && sanitizeTag(item).value === ""
              }
              helperText={fieldErrors?.[index]?.value?.message || ""}
              margin="normal"
              fullWidth
              required
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 3,
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
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
            />
          </Grid>
          <Grid
            size={{
              xs: 12,
              sm: 1,
            }}
            sx={{ display: "flex", justifyContent: "center" }}
          >
            <Tooltip title="Remove entry">
              <IconButton
                onClick={() => handleRemove(index)}
                aria-label="Remove entry"
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Tooltip>
          </Grid>
        </Grid>
      ))}

      {showErrors && typeof fieldErrors?.message === "string" && (
        <Typography variant="body2" color="error.main" sx={{ mt: 1 }}>
          {fieldErrors.message}
        </Typography>
      )}
    </Box>
  );
});

TagInput.displayName = "TagInput";
export default TagInput;
