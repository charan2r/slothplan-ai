import type { Draft, Task, Plan, Preferences, Health, Extraction } from './types'

const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${base}/api${path}`, {
      ...init, headers: { 'Content-Type': 'application/json', ...init?.headers },
      signal: AbortSignal.timeout(40000),
    })
  } catch {
    throw new Error('Cannot reach SlothPlan. Check that the backend is running, then try again.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const detail = body.detail
    throw new Error(typeof detail === 'string' ? detail : Array.isArray(detail)
      ? detail.map((d: { msg: string }) => d.msg).join(' ') : 'Something went wrong. Please try again.')
  }
  return response.status === 204 ? undefined as T : response.json()
}
const json = (method: string, body: unknown) => ({ method, body: JSON.stringify(body) })
export const api = {
  health: () => request<Health>('/health'),
  tasks: () => request<Task[]>('/tasks'),
  create: (draft: Draft) => request<Task>('/tasks', json('POST', draft)),
  batch: (tasks: Draft[]) => request<Task[]>('/tasks/batch', json('POST', { tasks })),
  update: (task: Task) => {
    const { id, created_at: _created, completed_at: _completed, ...body } = task
    return request<Task>(`/tasks/${id}`, json('PUT', body))
  },
  remove: (id: string) => request<void>(`/tasks/${id}`, { method: 'DELETE' }),
  extract: (text: string, today: string) => request<Extraction>('/extract', json('POST', { text, today })),
  preferences: () => request<Preferences>('/preferences'),
  savePreferences: (prefs: Preferences) => request<Preferences>('/preferences', json('PUT', prefs)),
  plan: (date: string) => request<Plan | null>(`/plan?date=${date}`),
  generate: (date: string, sloth_mode: boolean, from_time?: string) =>
    request<Plan>('/plan', json('POST', { date, sloth_mode, from_time })),
}
