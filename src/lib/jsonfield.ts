/**
 * SQLite stores structured fields as JSON strings. These helpers give typed,
 * safe access everywhere without littering `JSON.parse` calls.
 */

export function jparse<T>(value: string | null | undefined, fallback: T): T {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function jstr(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export type JsonField<T> = string; // documentation alias for serialized columns
