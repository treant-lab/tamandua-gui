import { format, formatDistanceToNow } from 'date-fns';

type DateInput = string | Date | number | null | undefined;

/**
 * Safely parse a date value (string, Date, or timestamp)
 */
export function parseDate(dateValue: DateInput): Date | null {
  if (!dateValue) return null;
  try {
    // If already a Date, check if valid
    if (dateValue instanceof Date) {
      return isNaN(dateValue.getTime()) ? null : dateValue;
    }
    // Parse string or number
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

/**
 * Safely format a date value
 */
export function formatDateSafe(
  dateValue: DateInput,
  formatStr: string,
  fallback: string = '-'
): string {
  const date = parseDate(dateValue);
  if (!date) return fallback;
  try {
    return format(date, formatStr);
  } catch {
    return fallback;
  }
}

/**
 * Safely format relative time (e.g., "2 hours ago")
 */
export function formatRelativeSafe(
  dateValue: DateInput,
  fallback: string = '-'
): string {
  const date = parseDate(dateValue);
  if (!date) return fallback;
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return fallback;
  }
}

/**
 * Format date with relative time in parentheses
 */
export function formatDateWithRelative(
  dateValue: DateInput,
  formatStr: string = 'PPpp'
): string {
  const formatted = formatDateSafe(dateValue, formatStr);
  const relative = formatRelativeSafe(dateValue, '');
  if (relative && formatted !== '-') {
    return `${formatted} (${relative})`;
  }
  return formatted;
}
