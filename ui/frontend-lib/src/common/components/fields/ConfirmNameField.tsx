import { InputAdornment, TextField } from "../../../ui";
import { cn } from "../../../utils/cn";
import { InlineCode } from "../code/InlineCode";

interface ConfirmNameFieldProps {
  /** The entity name the user must type to confirm. */
  name: string;
  value: string;
  onChange: (value: string) => void;
}

export const ConfirmNameField = ({
  name,
  value,
  onChange,
}: ConfirmNameFieldProps) => {
  const matched = value === name;

  return (
    <div>
      <p className="m-0 mb-2 text-body2">
        To confirm, type <InlineCode>{name}</InlineCode> below.
      </p>
      <TextField
        fullWidth
        placeholder={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={value.length > 0 && !matched}
        endAdornment={
          value.length > 0 && (
            <InputAdornment position="end">
              <span
                className={cn(
                  "text-caption",
                  matched ? "text-success" : "text-error",
                )}
              >
                {matched ? "✓" : "✗"}
              </span>
            </InputAdornment>
          )
        }
        autoComplete="off"
      />
    </div>
  );
};
