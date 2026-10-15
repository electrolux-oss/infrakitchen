import { forwardRef } from "react";

import { deleteIconButtonClass } from "../../common/components/buttons/deleteIconButtonClass";
import { dashedAddButtonClass } from "../../common/utils/dashedAddButton";
import { AddIcon, DeleteOutlinedIcon } from "../../icons/material";
import { Button, IconButton, Chip, Tooltip, TextField } from "../../ui";
import { cn } from "../../utils/cn";
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
      <div className="mt-4 px-4">
        {!hideHeader && (
          /* Section header: label, entry count */
          <div className="mb-2 flex items-center gap-2">
            <p className="m-0 text-body2 font-semibold">{label}</p>
            <Chip
              label={String(currentValue.length)}
              appearance="solid"
              color="info"
              compact
            />
          </div>
        )}

        {currentValue.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pb-0 text-fg-muted">
            {/* Column captions shown once, instead of "Name"/"Value" labels on
                every row. The trailing spacer reserves the remove-button width
                so the captions align with the fields below. */}
            <span className="min-w-40 flex-[1_1_180px] text-caption">Name</span>
            <span className="min-w-40 flex-[1_1_180px] text-caption">
              Value
            </span>
            <div className="w-7.5 flex-none" />
          </div>
        )}

        {currentValue.map((item, index) => (
          <div className="flex flex-wrap items-start gap-2 pt-0.5" key={index}>
            <TextField
              className="min-w-40 flex-[1_1_180px]"
              margin="dense"
              value={item.name}
              onChange={(e) => handleFieldChange(index, "name", e.target.value)}
              error={!!errors?.[item.name]?.[index]?.name}
              helperText={errors?.[item.name]?.[index]?.name?.message}
              required
              inputProps={{ "aria-label": `Secret name ${index + 1}` }}
            />
            <TextField
              className="min-w-40 flex-[1_1_180px]"
              type="password"
              margin="dense"
              value={item.value}
              onChange={(e) =>
                handleFieldChange(index, "value", e.target.value)
              }
              error={!!errors?.[item.name]?.[index]?.value}
              helperText={errors?.[item.name]?.[index]?.value?.message}
              required
              inputProps={{ "aria-label": `Secret value ${index + 1}` }}
            />
            <Tooltip title="Remove">
              <IconButton
                size="small"
                className={cn(deleteIconButtonClass, "my-1 self-center")}
                onClick={() => handleRemove(index)}
                aria-label="Remove"
              >
                <DeleteOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </div>
        ))}
        {!hideHeader && (
          /* Add action sits under the rows, matching the other list editors. */
          <div className="mt-2">
            <Button
              startIcon={<AddIcon />}
              onClick={handleAdd}
              className={dashedAddButtonClass}
            >
              Add
            </Button>
          </div>
        )}
      </div>
    );
  },
);

CustomSecretInput.displayName = "CustomSecretInput";
export default CustomSecretInput;
