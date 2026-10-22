export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function moveDate(value: string, offset: number) {
  const d = new Date(`${value}T12:00:00`)
  d.setDate(d.getDate() + offset)
  return localDate(d)
}
export function minutesLabel(minutes: number) {
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : `${minutes}m`
}
export function dateLabel(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
