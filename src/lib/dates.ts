/**
 * Renders a date pair for the resume templates.
 *
 * Dates are raw strings passed through untouched. Whatever is provided
 * is rendered: both -> "start - end", one -> that value, none -> "".
 */
export function formatDateRange(start?: string | null, end?: string | null): string {
  return [start, end]
    .filter((value) => value !== null && value !== undefined && value.trim() !== "")
    .join(" - ")
}
