import { forwardRef } from "react";

import {
  Add as AddIcon,
  DeleteOutline as DeleteOutlineIcon,
} from "@mui/icons-material";
import {
  TextField,
  IconButton,
  Typography,
  Grid,
  Box,
  Tooltip,
} from "@mui/material";

import { CustomSecret } from "../types";

interface CustomSecretInputProps {
  label: string;
  errors: any;
  value: CustomSecret[];
  onChange: (value: CustomSecret[]) => void;
  [key: string]: any;
}

const CustomSecretInput = forwardRef<any, CustomSecretInputProps>(
  (props, _ref) => {
    const { errors, label, value, onChange } = props;
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
        <Grid container spacing={2} alignItems="center" sx={{ mb: 1 }}>
          <Grid size={{ xs: 12, sm: 11 }}>
            <Typography variant="h5" component="h3" sx={{ mb: 0 }}>
              {label}
            </Typography>
          </Grid>
          <Grid
            size={{ xs: 12, sm: 1 }}
            sx={{ display: "flex", justifyContent: "center" }}
          >
            <Tooltip title="Add secret">
              <IconButton onClick={handleAdd} aria-label="Add secret">
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Grid>
        </Grid>
        {currentValue.map((item, index) => (
          <Grid container spacing={2} alignItems="flex-end" key={index}>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                label="Name"
                variant="outlined"
                margin="normal"
                value={item.name}
                onChange={(e) =>
                  handleFieldChange(index, "name", e.target.value)
                }
                error={!!errors?.[item.name]?.[index]?.name}
                helperText={errors?.[item.name]?.[index]?.name?.message || ""}
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 5 }}>
              <TextField
                label="Value"
                variant="outlined"
                type="password"
                margin="normal"
                value={item.value}
                onChange={(e) =>
                  handleFieldChange(index, "value", e.target.value)
                }
                error={!!errors?.[item.name]?.[index]?.value}
                helperText={errors?.[item.name]?.[index]?.value?.message || ""}
                fullWidth
              />
            </Grid>
            <Grid
              size={{ xs: 0, sm: 1 }}
              sx={{ display: { xs: "none", sm: "block" } }}
            />
            <Grid
              size={{ xs: 12, sm: 1 }}
              sx={{ display: "flex", justifyContent: "center", mb: 1 }}
            >
              <Tooltip title="Remove secret">
                <IconButton
                  onClick={() => handleRemove(index)}
                  aria-label="Remove secret"
                >
                  <DeleteOutlineIcon />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        ))}
      </Box>
    );
  },
);

CustomSecretInput.displayName = "CustomSecretInput";
export default CustomSecretInput;
