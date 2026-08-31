import { describe, it, expect } from "vitest"
import { formatDateRange } from "../src/lib/dates.js"

describe("formatDateRange", () => {
  it("renders both dates as start - end", () => {
    expect(formatDateRange("January 2025", "February 2026")).toBe("January 2025 - February 2026")
    expect(formatDateRange("2014-10-01", "2018-09-30")).toBe("2014-10-01 - 2018-09-30")
  })

  it("renders only the start date when end is missing", () => {
    expect(formatDateRange("June 2022", null)).toBe("June 2022")
    expect(formatDateRange("June 2022", undefined)).toBe("June 2022")
  })

  it("renders only the end date when start is missing", () => {
    expect(formatDateRange(null, "PRESENT")).toBe("PRESENT")
    expect(formatDateRange(undefined, "2018-09-30")).toBe("2018-09-30")
  })

  it("treats blank strings as absent", () => {
    expect(formatDateRange("", "June 2022")).toBe("June 2022")
    expect(formatDateRange("June 2022", "  ")).toBe("June 2022")
  })

  it("returns an empty string when neither date is present", () => {
    expect(formatDateRange(null, undefined)).toBe("")
    expect(formatDateRange()).toBe("")
  })

  it("renders a single date when start and end are the same", () => {
    expect(formatDateRange("June 2022", "June 2022")).toBe("June 2022")
    expect(formatDateRange("2025-01-15", "2025-01-15")).toBe("2025-01-15")
  })
})
