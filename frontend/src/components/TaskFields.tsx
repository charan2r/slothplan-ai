import type { Draft, Level } from '../types'

export default function TaskFields({ value, change, prefix = 'task' }: { value: Draft; change: (value: Draft) => void; prefix?: string }) {
  function set<K extends keyof Draft>(key: K, next: Draft[K]) { change({ ...value, [key]: next }) }
  return <div className="task-fields">
    <label htmlFor={`${prefix}-title`}>Task name<input id={`${prefix}-title`} required maxLength={200} value={value.title} onChange={e => set('title', e.target.value)} placeholder="What needs doing?"/></label>
    <div className="field-grid">
      <label htmlFor={`${prefix}-duration`}>Minutes<input id={`${prefix}-duration`} required type="number" min={5} max={480} value={value.duration} onChange={e => set('duration', Number(e.target.value))}/></label>
      <label htmlFor={`${prefix}-priority`}>Priority<select id={`${prefix}-priority`} value={value.priority} onChange={e => set('priority', e.target.value as Level)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      <label htmlFor={`${prefix}-effort`}>Effort<select id={`${prefix}-effort`} value={value.effort} onChange={e => set('effort', e.target.value as Level)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
    </div>
    <div className="field-grid two">
      <label htmlFor={`${prefix}-deadline`}>Due date <span>(optional)</span><input id={`${prefix}-deadline`} type="date" value={value.deadline || ''} min={value.not_before || undefined} onChange={e => set('deadline', e.target.value || null)}/></label>
      <label htmlFor={`${prefix}-earliest`}>Earliest day <span>(optional)</span><input id={`${prefix}-earliest`} type="date" value={value.not_before || ''} max={value.deadline || undefined} onChange={e => set('not_before', e.target.value || null)}/></label>
    </div>
    <label htmlFor={`${prefix}-notes`}>Notes <span>(optional)</span><textarea id={`${prefix}-notes`} maxLength={2000} rows={2} value={value.notes} onChange={e => set('notes', e.target.value)}/></label>
  </div>
}
