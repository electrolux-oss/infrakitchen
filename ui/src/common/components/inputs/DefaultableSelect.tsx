import {
  forwardRef,
  ReactElement,
  ReactNode,
  Ref,
  useEffect,
  useState,
} from "react";

import { MenuItem, TextField, type TextFieldProps } from "../../../ui";
import { notifyError } from "../../hooks/useNotification";

type Option = { id: string };

export type DefaultableSelectProps<T extends Option> = Omit<
  TextFieldProps,
  "onChange" | "value"
> & {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Called once on mount. */
  loadOptions: () => Promise<T[]>;
  /** Options that can be picked; the current selection stays visible anyway. */
  isSelectable: (option: T) => boolean;
  isDefault: (option: T) => boolean;
  /** Label of the empty value, which follows the global default. */
  defaultLabel: (defaultOption: T | null) => string;
  renderOption: (option: T) => ReactNode;
  menuItemClassName?: string;
};

/**
 * Select of an entity that has a global default, like IaC tools or worker templates.
 * An empty value means the global default is used.
 */
const DefaultableSelectInner = <T extends Option>(
  {
    value,
    onChange,
    loadOptions,
    isSelectable,
    isDefault,
    defaultLabel,
    renderOption,
    menuItemClassName,
    selectProps,
    ...props
  }: DefaultableSelectProps<T>,
  ref: Ref<HTMLElement>,
) => {
  const [options, setOptions] = useState<T[]>([]);
  const [defaultOption, setDefaultOption] = useState<T | null>(null);

  useEffect(() => {
    loadOptions()
      .then((loaded) => {
        setOptions(
          loaded.filter(
            (option) => isSelectable(option) || option.id === value,
          ),
        );
        setDefaultOption(loaded.find(isDefault) ?? null);
      })
      .catch(notifyError);
    // Loaded once; value is only used to keep the current selection visible
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <TextField
      {...props}
      ref={ref}
      select
      fullWidth
      size="small"
      margin="dense"
      value={value || ""}
      // the global default option has an empty value, which Select renders as blank unless displayEmpty is set
      selectProps={{ displayEmpty: true, ...selectProps }}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <MenuItem value="">{defaultLabel(defaultOption)}</MenuItem>
      {options.map((option) => (
        <MenuItem
          key={option.id}
          value={option.id}
          className={menuItemClassName}
        >
          {renderOption(option)}
        </MenuItem>
      ))}
    </TextField>
  );
};

export const DefaultableSelect = forwardRef(DefaultableSelectInner) as <
  T extends Option,
>(
  props: DefaultableSelectProps<T> & { ref?: Ref<HTMLElement> },
) => ReactElement;
