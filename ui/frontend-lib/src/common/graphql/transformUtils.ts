export function isNonNullable<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function mapNullable<TInput, TOutput>(
  value: TInput | null | undefined,
  mapper: (value: TInput) => TOutput,
): TOutput | null {
  if (!isNonNullable(value)) {
    return null;
  }
  return mapper(value);
}

export function mapNullableArray<TInput, TOutput>(
  values: (TInput | null)[] | null | undefined,
  mapper: (value: TInput | null) => TOutput | null,
): TOutput[] | null {
  if (!isNonNullable(values)) {
    return null;
  }

  return values.map(mapper).filter(isNonNullable);
}
