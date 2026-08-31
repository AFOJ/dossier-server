/**
 * Renders a date pair for the resume templates.
 *
 * Dates are raw strings passed through untouched. Whatever is provided
 * is rendered: both -> "start - end", one -> that value, none -> "".
 */

/** True when the string exists and carries at least one visible character. */
export function isPresent(value: string | null | undefined): boolean {
  return value !== null && value !== undefined && /\S/.test(value)
}

export function formatDateRange(start?: string | null, end?: string | null): string {
  const startDate = isPresent(start) ? start! : undefined
  const endDate = isPresent(end) ? end! : undefined

  if (startDate !== undefined && endDate !== undefined && startDate === endDate) {
    return startDate
  }

  const presentDates = [startDate, endDate].filter((date): date is string => date !== undefined)
  return presentDates.join(" - ")
}
