const CHIP_CLASS =
  "mr-1 mb-1 inline-block rounded-surface bg-primary-dark px-2 py-1 text-body2 text-primary-contrast";

export interface StringChipsProps {
  values: string[];
  format?: (value: string) => string;
}

/** Renders a list of string values as styled chips, or nothing when empty. */
export const StringChips = ({ values, format }: StringChipsProps) => {
  if (!values || values.length === 0) {
    return null;
  }
  return (
    <div>
      {values.map((value) => (
        <span key={value} className={CHIP_CLASS}>
          {format ? format(value) : value}
        </span>
      ))}
    </div>
  );
};

export default StringChips;
