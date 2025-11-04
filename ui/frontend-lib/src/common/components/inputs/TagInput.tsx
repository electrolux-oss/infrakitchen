import { forwardRef, useState, useEffect, useRef } from "react";

import {
  Add as AddIcon,
  Remove as RemoveIcon,
  ExpandMore as ExpandMoreIcon,
} from "@mui/icons-material";
import {
  TextField,
  FormControlLabel,
  IconButton,
  Checkbox,
  Typography,
  Grid,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  [key: string]: any;
}

const TagInput = forwardRef<any, TagInputProps>((props, _ref) => {
  const { errors, label, value, onChange } = props;
  const [localValue, setLocalValue] = useState<Tag[]>(value || []);
  const [isOpen, setIsOpen] = useState(false);
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
    const newLocalValue = [
      ...localValue,
      { name: "", value: "", inherited_by_children: true },
    ];
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
    fieldName: keyof Tag,
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
});

TagInput.displayName = "TagInput";
export default TagInput;
