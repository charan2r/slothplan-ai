import { describe, expect, it } from 'vitest'
import { localDate, minutesLabel, moveDate } from './utils'

describe('Local calendar and duration formatting', () => {
  it('keeps the local calendar day instead of converting to UTC', () => {
    expect(localDate(new Date(2026, 9, 22, 0, 15))).toBe('2026-10-22')
  })
  it('navigates month, year and leap-day boundaries', () => {
    expect(moveDate('2026-12-31', 1)).toBe('2027-01-01')
    expect(moveDate('2024-03-01', -1)).toBe('2024-02-29')
  })
  it('formats whole and partial hours', () => {
    expect(minutesLabel(0)).toBe('0m')
    expect(minutesLabel(15)).toBe('15m')
    expect(minutesLabel(60)).toBe('1h')
    expect(minutesLabel(95)).toBe('1h 35m')
  })
})
