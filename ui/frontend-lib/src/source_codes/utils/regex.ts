const SIMPLE_REGEX_PATTERN = /^\^\[([^\]]+)\](?:\{(\d+),(\d+)\}|(\*)|(\+))\$/;

export const TOGGLE_KEYS = [
  "lowercase",
  "uppercase",
  "digits",
  "underscore",
  "dash",
  "whitespace",
] as const;

export type ToggleKey = (typeof TOGGLE_KEYS)[number];

const TOGGLE_REGEX_FRAGMENTS: Record<ToggleKey, string[]> = {
  lowercase: ["a-z"],
  uppercase: ["A-Z"],
  digits: ["0-9"],
  underscore: ["_"],
  dash: ["\\-", "-"],
  whitespace: ["\\s", " "],
};

const CANONICAL_FRAGMENTS: Record<ToggleKey, string> = {
  lowercase: "a-z",
  uppercase: "A-Z",
  digits: "0-9",
  underscore: "_",
  dash: "\\-",
  whitespace: "\\s",
};

export const DEFAULT_TOGGLE_STATE: Record<ToggleKey, boolean> = {
  lowercase: true,
  uppercase: true,
  digits: true,
  underscore: false,
  dash: false,
  whitespace: false,
};

export const EMPTY_TOGGLE_STATE: Record<ToggleKey, boolean> = {
  lowercase: false,
  uppercase: false,
  digits: false,
  underscore: false,
  dash: false,
  whitespace: false,
};

export interface LengthState {
  min: string;
  max: string;
}

export interface ParsedRegex {
  toggles: Record<ToggleKey, boolean>;
  min: number;
  max: number;
}

const consumeFragment = (
  input: string,
  fragment: string,
): [boolean, string] => {
  const index = input.indexOf(fragment);
  if (index === -1) {
    return [false, input];
  }
  const updated = input.slice(0, index) + input.slice(index + fragment.length);
  return [true, updated];
};

/**
 * Breaks apart a simple bracket-based regex (e.g. ^[a-z]{1,4}$) into its
 * character toggle state and numeric length limits. Returns null when the
 * provided pattern contains unsupported syntax.
 */
export const parseSimpleRegex = (value: string): ParsedRegex | null => {
  const trimmed = value.trim();
  const matches = trimmed.match(SIMPLE_REGEX_PATTERN);
  if (!matches) {
    return null;
  }

  let remaining = matches[1];
  const toggles: Record<ToggleKey, boolean> = { ...EMPTY_TOGGLE_STATE };

  for (const key of TOGGLE_KEYS) {
    let found = false;
    for (const fragment of TOGGLE_REGEX_FRAGMENTS[key]) {
      const [consumed, nextRemaining] = consumeFragment(remaining, fragment);
      if (consumed) {
        found = true;
        remaining = nextRemaining;
        break;
      }
    }
    toggles[key] = found;
  }

  if (remaining.trim().length > 0) {
    return null;
  }

  const min = Number(matches[2]);
  const max = Number(matches[3]);
  const isStar = matches[4] === "*";
  const isPlus = matches[5] === "+";

  if (isStar) {
    return { toggles, min: 0, max: Number.POSITIVE_INFINITY };
  }

  if (isPlus) {
    return { toggles, min: 1, max: Number.POSITIVE_INFINITY };
  }

  if (
    Number.isNaN(min) ||
    Number.isNaN(max) ||
    min < 0 ||
    max <= 0 ||
    min > max
  ) {
    return null;
  }

  return { toggles, min, max };
};

/**
 * Generates a regex string from the provided toggle state and numeric bounds.
 * Supports finite ranges as well as open-ended patterns for *, +, and {min,}.
 */
export const buildRegexFromState = (
  state: Record<ToggleKey, boolean>,
  min: number,
  max: number,
): string => {
  const fragments = TOGGLE_KEYS.filter((key) => state[key]).map(
    (key) => CANONICAL_FRAGMENTS[key],
  );

  if (fragments.length === 0) {
    throw new Error("Cannot build regex without an enabled character set.");
  }

  const characterClass = fragments.join("");

  if (!Number.isFinite(max)) {
    if (min === 0) {
      return `^[${characterClass}]*$`;
    }
    if (min === 1) {
      return `^[${characterClass}]+$`;
    }
    return `^[${characterClass}]{${min},}$`;
  }

  return `^[${characterClass}]{${min},${max}}$`;
};

/**
 * Validates the length inputs from the UI and converts them into numeric
 * values that downstream regex helpers can consume.
 */
export const parseLengths = (
  value: LengthState,
): { valid: boolean; error: string | null; min?: number; max?: number } => {
  if (value.min === "" || value.max === "") {
    return { valid: false, error: "Both min and max lengths are required." };
  }

  const min = Number(value.min);
  if (!Number.isInteger(min) || min < 0) {
    return {
      valid: false,
      error: "Min length must be a non-negative integer.",
    };
  }

  const maxInput = value.max.trim();
  const maxIsInfinity = maxInput.toLowerCase() === "infinity";
  const max = maxIsInfinity ? Number.POSITIVE_INFINITY : Number(maxInput);

  if (!maxIsInfinity && (!Number.isInteger(max) || max <= 0)) {
    return {
      valid: false,
      error: "Max length must be a positive integer or 'Infinity'.",
    };
  }

  if (maxIsInfinity && min !== 0 && min !== 1) {
    return {
      valid: false,
      error: "Infinite max length is only supported when min is 0 or 1.",
    };
  }

  if (!maxIsInfinity && min > max) {
    return { valid: false, error: "Min length cannot exceed max length." };
  }

  return { valid: true, error: null, min, max };
};
