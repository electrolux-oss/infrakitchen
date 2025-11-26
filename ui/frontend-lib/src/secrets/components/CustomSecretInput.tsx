import { forwardRef, useState, useEffect, useRef } from "react";

import {
  Add as AddIcon,
  Remove as RemoveIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";
import {
  TextField,
  IconButton,
  Typography,
  Grid,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
    const [localValue, setLocalValue] = useState<CustomSecret[]>(value || []);
    const [isOpen, setIsOpen] = useState(true);
    const accordionRef = useRef<HTMLDivElement>(null);
    const stringifiedValue = JSON.stringify(value);

    useEffect(() => {
      if (isOpen) {
        setTimeout(() => {
          accordionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 100);
      }
    }, [isOpen]);

    useEffect(() => {
      setLocalValue(value || []);
    }, [value]);

    useEffect(() => {
      if (stringifiedValue !== JSON.stringify(localValue)) {
        onChange(localValue);
      }
    }, [localValue, onChange, stringifiedValue]);

    const handleAdd = () => {
      const newLocalValue = [...localValue, { name: "", value: "" }];
      setLocalValue(newLocalValue);
      onChange(newLocalValue);
      if (localValue.length === 0) {
        setIsOpen(true);
      }
    };

    const handleRemove = (index: number) => {
      const newValue = [...localValue];
      newValue.splice(index, 1);
      setLocalValue(newValue);
      onChange(newValue);
    };

    const handleFieldChange = (
      index: number,
      fieldName: keyof CustomSecret,
      fieldValue: any,
    ) => {
      const newValue = [...localValue];
      newValue[index] = { ...newValue[index], [fieldName]: fieldValue };
      setLocalValue(newValue);
      onChange(newValue);
    };

    if (localValue.length === 0) {
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            marginTop: "16px",
            padding: "0px 16px",
          }}
        >
          <Typography variant="h5" component="h3" sx={{ flexGrow: 1, mb: 0 }}>
            {label}
          </Typography>
          <IconButton onClick={handleAdd} aria-label="Add">
            <AddIcon />
          </IconButton>
        </Box>
      );
    }

    return (
      <Accordion
        ref={accordionRef}
        expanded={isOpen}
        onChange={() => setIsOpen(!isOpen)}
        elevation={0}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography gutterBottom variant="h5" component="h3" sx={{ mb: 0 }}>
            {label}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          {localValue.map((item, index) => (
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
                  onChange={(e) =>
                    handleFieldChange(index, "name", e.target.value)
                  }
                  error={errors?.[item.name]?.[index]?.name ? true : false}
                  helperText={errors?.[item.name]?.[index]?.name?.message}
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
                  type="password"
                  value={item.value}
                  onChange={(e) =>
                    handleFieldChange(index, "value", e.target.value)
                  }
                  error={errors?.[item.name]?.[index]?.value ? true : false}
                  helperText={errors?.[item.name]?.[index]?.value?.message}
                  margin="normal"
                />
              </Grid>
              <Grid
                size={{
                  xs: 12,
                  sm: 1,
                }}
              >
                <IconButton
                  onClick={() => handleRemove(index)}
                  aria-label="Remove"
                >
                  <RemoveIcon />
                </IconButton>
              </Grid>
            </Grid>
          ))}

          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <IconButton onClick={handleAdd} aria-label="Add">
              <AddIcon />
            </IconButton>
          </Box>
        </AccordionDetails>
      </Accordion>
    );
  },
);

CustomSecretInput.displayName = "TagInput";
export default CustomSecretInput;
