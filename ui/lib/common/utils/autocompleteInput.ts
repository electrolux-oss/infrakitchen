import type { AutocompleteRenderInputParams } from "@mui/material";

type AutocompleteInputProps = NonNullable<
  AutocompleteRenderInputParams["slotProps"]
>["input"];

type AutocompleteHtmlInputProps = NonNullable<
  AutocompleteRenderInputParams["slotProps"]
>["htmlInput"];

type AutocompleteInputLabelProps = NonNullable<
  AutocompleteRenderInputParams["slotProps"]
>["inputLabel"];

type AutocompleteCompatParams = AutocompleteRenderInputParams & {
  InputProps?: Partial<AutocompleteInputProps>;
  inputProps?: Partial<AutocompleteHtmlInputProps>;
  InputLabelProps?: Partial<AutocompleteInputLabelProps>;
};

type CompatOverride = Record<string, unknown>;

// MUI moved Autocomplete renderInput props from InputProps/inputProps to slotProps.input/htmlInput.
// Read either shape so the library can run against both host versions.
export function getAutocompleteInputProps(
  params: AutocompleteRenderInputParams,
): Partial<AutocompleteInputProps> {
  const compatParams = params as AutocompleteCompatParams;

  return compatParams.slotProps?.input ?? compatParams.InputProps ?? {};
}

export function getAutocompleteHtmlInputProps(
  params: AutocompleteRenderInputParams,
): Partial<AutocompleteHtmlInputProps> {
  const compatParams = params as AutocompleteCompatParams;

  return compatParams.slotProps?.htmlInput ?? compatParams.inputProps ?? {};
}

export function getAutocompleteInputLabelProps(
  params: AutocompleteRenderInputParams,
): Partial<AutocompleteInputLabelProps> {
  const compatParams = params as AutocompleteCompatParams;

  return (
    compatParams.slotProps?.inputLabel ?? compatParams.InputLabelProps ?? {}
  );
}

export function getAutocompleteTextFieldProps(
  params: AutocompleteRenderInputParams,
  overrides: {
    input?: CompatOverride;
    htmlInput?: CompatOverride;
    inputLabel?: CompatOverride;
  } = {},
): {
  slotProps: {
    input?: Partial<AutocompleteInputProps> & CompatOverride;
    htmlInput?: Partial<AutocompleteHtmlInputProps> & CompatOverride;
    inputLabel?: Partial<AutocompleteInputLabelProps> & CompatOverride;
  };
} {
  const compatParams = params as AutocompleteCompatParams;
  const input = {
    ...getAutocompleteInputProps(params),
    ...overrides.input,
  } as Partial<AutocompleteInputProps> & CompatOverride;
  const htmlInput = {
    ...getAutocompleteHtmlInputProps(params),
    ...overrides.htmlInput,
  } as Partial<AutocompleteHtmlInputProps> & CompatOverride;
  const inputLabel = {
    ...getAutocompleteInputLabelProps(params),
    ...overrides.inputLabel,
  } as Partial<AutocompleteInputLabelProps> & CompatOverride;
  const textFieldProps = {
    slotProps: {
      ...compatParams.slotProps,
      input,
      htmlInput,
      inputLabel,
    },
  };

  (textFieldProps as Record<string, unknown>).InputProps = input;
  (textFieldProps as Record<string, unknown>).inputProps = htmlInput;
  (textFieldProps as Record<string, unknown>).InputLabelProps = inputLabel;

  return textFieldProps;
}
