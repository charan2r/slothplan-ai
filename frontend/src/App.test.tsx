import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { api } from './api'
import type { Plan, Task } from './types'
import { localDate } from './utils'

vi.mock('./api', () => ({ api: { health: vi.fn(), tasks: vi.fn(), preferences: vi.fn(), plan: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), batch: vi.fn(), extract: vi.fn(), generate: vi.fn(), savePreferences: vi.fn() } }))
const task: Task = { id: '1', title: 'Email the team', duration: 15, effort: 'low', priority: 'medium', notes: '', status: 'todo', deadline: null, not_before: null, created_at: '', completed_at: null }
const plan: Plan = { date: localDate(), sloth_mode: false, blocks: [], deferred: [], warnings: [], work_minutes: 0, budget_minutes: 240, break_minutes: 0 }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(api.tasks).mockResolvedValue([])
  vi.mocked(api.health).mockResolvedValue({ status: 'ok', ai_configured: false, model: 'google/gemma-3-27b-it', provider: 'test', fallback_enabled: true })
  vi.mocked(api.preferences).mockResolvedValue({ start_time: '09:00', end_time: '18:00', daily_budget: 240, sloth_budget: 90, focus_minutes: 50, break_minutes: 10 })
  vi.mocked(api.plan).mockResolvedValue(null)
  vi.mocked(api.generate).mockResolvedValue(plan)
})

describe('SlothPlan interactive flows', () => {
  it('labels manual-only mode accurately when AI and local fallback are disabled', async () => {
    vi.mocked(api.health).mockResolvedValue({ status: 'ok', ai_configured: false, model: 'gemma', provider: 'test', fallback_enabled: false })
    render(<App />)
    expect(await screen.findByText('Manual entry ready')).toBeInTheDocument()
    expect(screen.queryByText('Local rules active')).not.toBeInTheDocument()
  })

  it('creates a real task through the API and refreshes its plan', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Local rules active')
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText('Task name'), task.title)
    vi.mocked(api.create).mockResolvedValue(task)
    vi.mocked(api.tasks).mockResolvedValue([task])
    await user.click(within(dialog).getByRole('button', { name: 'Save task' }))
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ title: task.title })))
    expect(await screen.findByRole('heading', { name: task.title })).toBeInTheDocument()
    expect(api.generate).toHaveBeenCalled()
  })

  it('discloses rule fallback, allows review, and saves only after confirmation', async () => {
    const user = userEvent.setup()
    vi.mocked(api.extract).mockResolvedValue({ tasks: [{ title: task.title, duration: 15, effort: 'low', priority: 'medium', notes: '', deadline: null, not_before: null }], source: 'rules', model: null, message: 'Provider unavailable. Used local rules.' })
    render(<App />)
    await screen.findByText('Local rules active')
    await user.type(screen.getByLabelText('Describe your tasks'), 'Email the team for 15 minutes')
    await user.click(screen.getByRole('button', { name: /Untangle my day/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Extracted with local rules')).toBeInTheDocument()
    expect(api.batch).not.toHaveBeenCalled()
    const title = within(dialog).getByLabelText('Task name')
    await user.clear(title)
    await user.type(title, 'Email the design team')
    vi.mocked(api.batch).mockResolvedValue([task])
    await user.click(within(dialog).getByRole('button', { name: 'Add 1 tasks & plan' }))
    await waitFor(() => expect(api.batch).toHaveBeenCalledWith([expect.objectContaining({ title: 'Email the design team' })]))
  })

  it('switches Sloth Mode through the scheduler and persists the preference', async () => {
    const user = userEvent.setup()
    vi.mocked(api.generate).mockResolvedValue({ ...plan, sloth_mode: true, budget_minutes: 90 })
    render(<App />)
    await screen.findByText('Local rules active')
    await user.click(screen.getByRole('switch', { name: 'Sloth Mode' }))
    await waitFor(() => expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true'))
    expect(api.generate).toHaveBeenCalledWith(localDate(), true)
    expect(localStorage.getItem('sloth-mode')).toBe('true')
  })

  it('keeps user input and explains backend failures', async () => {
    const user = userEvent.setup()
    vi.mocked(api.extract).mockRejectedValueOnce(new Error('Gemma credentials were rejected. You can still add tasks manually.'))
    render(<App />)
    await screen.findByText('Local rules active')
    await user.type(screen.getByLabelText('Describe your tasks'), 'Do this tomorrow')
    await user.click(screen.getByRole('button', { name: /Untangle my day/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('credentials were rejected')
    expect(screen.getByLabelText('Describe your tasks')).toHaveValue('Do this tomorrow')
  })

  it('closes a successfully saved draft if refreshing its plan fails, preventing duplicate submissions', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByText('Local rules active')
    await user.click(screen.getByRole('button', { name: 'Add task' }))
    await user.type(screen.getByLabelText('Task name'), 'One task')
    vi.mocked(api.create).mockResolvedValue(task)
    vi.mocked(api.tasks).mockResolvedValue([task])
    vi.mocked(api.generate).mockRejectedValueOnce(new Error('Cannot refresh plan.'))
    await user.click(screen.getByRole('button', { name: 'Save task' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(api.create).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent('Your change was saved')
  })
})
