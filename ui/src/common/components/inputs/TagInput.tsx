import { forwardRef } from "react";

import { HeroPlusCircleIcon } from "../../../icons";
import { HeroTrashIcon } from "../../../icons";
import {
  FormControlLabel,
  Switch,
  Button,
  IconButton,
  Tooltip,
  TextField,
} from "../../../ui";
import { Label } from "../../../ui/Label";
import { cn } from "../../../utils/cn";
import { dashedAddButtonClass } from "../../utils/dashedAddButton";
import { deleteIconButtonClass } from "../buttons/deleteIconButtonClass";

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
    <div className="mt-4 px-4">
      {!hideHeader && (
        /* Section header: label, entry count */
        <div className="mb-2 flex items-center gap-2">
          <p className="m-0 text-body2 font-semibold">{label}</p>
          <Label label={String(currentValue.length)} />
        </div>
      )}

      {currentValue.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pb-0 text-fg-muted">
          {/* Column captions shown once, instead of "Name"/"Value" labels on
              every row. Reserve the switch + remove-action widths so the
              captions stay aligned with the fields below. */}
          <span className="min-w-40 flex-[1_1_180px] text-caption">Name</span>
          <span className="min-w-40 flex-[1_1_180px] text-caption">Value</span>
          <div className="w-44.5 flex-none" />
          <div className="w-7 flex-none" />
        </div>
      )}

      {currentValue.map((item: Tag, index: number) => (
        <div className="flex flex-wrap items-start gap-2 pt-0.5" key={index}>
          <TextField
            className="min-w-40 flex-[1_1_180px]"
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
            inputProps={{ "aria-label": `Tag name ${index + 1}` }}
          />
          <TextField
            className="min-w-40 flex-[1_1_180px]"
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
            inputProps={{ "aria-label": `Tag value ${index + 1}` }}
          />
          <FormControlLabel
            className="my-1 ml-0 self-center"
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
            label={<p className="m-0 text-body2">Inherited By Children</p>}
          />
          <Tooltip title="Remove">
            <IconButton
              size="small"
              className={cn(deleteIconButtonClass, "my-1 self-center")}
              onClick={() => handleRemove(index)}
              aria-label="Remove"
            >
              <HeroTrashIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </div>
      ))}
      {!hideHeader && (
        /* Add action sits under the rows, matching the other list editors. */
        <div className="mt-2">
          <Button
            startIcon={<HeroPlusCircleIcon />}
            onClick={handleAdd}
            className={dashedAddButtonClass}
          >
            Add
          </Button>
        </div>
      )}
      {showErrors && typeof fieldErrors?.message === "string" && (
        <p className="m-0 mt-2 text-body2 text-error">{fieldErrors.message}</p>
      )}
    </div>
  );
});

TagInput.displayName = "TagInput";
export default TagInput;
