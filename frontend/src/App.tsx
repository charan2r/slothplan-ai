import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, BarChart3, CalendarDays, Check, CheckCheck, ChevronLeft, ChevronRight, CircleHelp, Clock3, Coffee, Cpu, Flame, LayoutDashboard, ListTodo, LoaderCircle, Moon, Pause, Pencil, Play, Plus, RefreshCw, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles, Trash2, X, Zap } from 'lucide-react'
import { api } from './api'
import type { Draft, Extraction, Health, Plan, Preferences, Task, Block } from './types'
import { dateLabel, localDate, minutesLabel, moveDate } from './utils'
import Modal from './components/Modal'
import TaskFields from './components/TaskFields'
import Sloth from './components/Sloth'

const emptyDraft = (): Draft => ({ title: '', notes: '', duration: 30, priority: 'medium', effort: 'medium', deadline: null, not_before: null })
const defaults: Preferences = { start_time: '09:00', end_time: '18:00', daily_budget: 240, sloth_budget: 90, focus_minutes: 50, break_minutes: 10 }
type View = 'today' | 'tasks' | 'insights'
const example = 'Reply to emails, 15 minutes, easy; Finish the project proposal today, 50 minutes, important; Book a dentist appointment, 10 minutes; Research weekend trip ideas, 30 minutes, no rush'

export default function App() {
  const [view, setView] = useState<View>('today')
  const [date, setDate] = useState(localDate())
  const [tasks, setTasks] = useState<Task[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [prefs, setPrefs] = useState<Preferences>(defaults)
  const [mode, setMode] = useState(() => localStorage.getItem('sloth-mode') === 'true')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [text, setText] = useState('')
  const [extraction, setExtraction] = useState<Extraction | null>(null)
  const [editing, setEditing] = useState<Task | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [deleting, setDeleting] = useState<Task | null>(null)
  const [settings, setSettings] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState<Preferences>(defaults)
  const [help, setHelp] = useState(false)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [focus, setFocus] = useState<Block | null>(null)
  const [remaining, setRemaining] = useState(0)
  const [running, setRunning] = useState(false)
  const composerRef = useRef<HTMLTextAreaElement>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [t, h, p, schedule] = await Promise.all([api.tasks(), api.health(), api.preferences(), api.plan(date)])
      setTasks(t); setHealth(h); setPrefs(p); setPlan(schedule)
      if (schedule) { setMode(schedule.sloth_mode); localStorage.setItem('sloth-mode', String(schedule.sloth_mode)) }
    } catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [date]) // Date navigation is disabled while requests run.
  useEffect(() => {
    if (!notice) return
    const id = setTimeout(() => setNotice(''), 6000)
    return () => clearTimeout(id)
  }, [notice])
  useEffect(() => {
    if (!running) return
    const end = Date.now() + remaining * 1000
    const id = setInterval(() => {
      const next = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setRemaining(next)
      if (!next) { setRunning(false); setNotice('Focus block finished. Take a breath, then check off your task when it is done.') }
    }, 250)
    return () => clearInterval(id)
  }, [running])

  const pending = tasks.filter(t => t.status === 'todo')
  const completed = tasks.filter(t => t.status === 'done')
  const workBlocks = plan?.blocks.filter(b => b.kind === 'task') || []
  const scheduledIds = new Set(workBlocks.map(b => b.task_id))
  const scheduledTasks = pending.filter(t => scheduledIds.has(t.id))
  const workBudget = mode ? prefs.sloth_budget : prefs.daily_budget
  const due = pending.filter(t => t.deadline && t.deadline <= date).length
  const blocked = busy || loading || extracting

  async function action(fn: () => Promise<unknown>, message: string, regenerate = true): Promise<boolean> {
    setBusy(true); setError('')
    let saved = false
    try {
      await fn()
      saved = true
      if (regenerate) {
        setPlan(null)
        setTasks(await api.tasks())
        setPlan(await api.generate(date, mode))
      }
      setNotice(message)
      return true
    } catch (e) {
      setError((e as Error).message)
      if (saved && regenerate) setNotice('Your change was saved. Retry to refresh your task list and plan.')
      return saved
    }
    finally { setBusy(false) }
  }

  function newTask() { setDraft(emptyDraft()); setEditing('new') }
  function editTask(task: Task) {
    const { title, notes, duration, priority, effort, deadline, not_before } = task
    setDraft({ title, notes, duration, priority, effort, deadline, not_before }); setEditing(task)
  }
  async function saveTask(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    if (await action(() => editing === 'new' ? api.create(draft) : api.update({ ...editing, ...draft }), editing === 'new' ? 'Task added. A little less on your mind.' : 'Task updated. Your plan is refreshed.')) setEditing(null)
  }
  async function toggleTask(task: Task) {
    if (await action(() => api.update({ ...task, status: task.status === 'done' ? 'todo' : 'done' }), task.status === 'todo' ? 'Nice. One less thing to think about.' : 'Task reopened.')) {
      if (focus?.task_id === task.id) { setRunning(false); setFocus(null) }
    }
  }
  async function generate(fromNow = false) {
    await action(async () => {
      const now = new Date()
      const from = fromNow && date === localDate(now) ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` : undefined
      setPlan(await api.generate(date, mode, from))
    }, fromNow ? 'Plan reshuffled around the time you have left.' : 'Your gentle plan is ready.', false)
  }
  async function toggleMode() {
    const next = !mode
    await action(async () => {
      const p = await api.generate(date, next)
      setPlan(p); setMode(next); localStorage.setItem('sloth-mode', String(next))
    }, next ? 'Sloth Mode on. Shorter sessions, more rest, easier wins.' : 'Balanced Mode on. A little more room for focus.', false)
  }
  async function extract(e?: FormEvent) {
    e?.preventDefault()
    if (!text.trim() || extracting) return
    setExtracting(true); setError('')
    try { setExtraction(await api.extract(text, localDate())) }
    catch (e) { setError((e as Error).message) }
    finally { setExtracting(false) }
  }
  async function saveExtracted(e: FormEvent) {
    e.preventDefault()
    if (!extraction?.tasks.length) return
    if (await action(() => api.batch(extraction.tasks), `${extraction.tasks.length} tasks added. Your plan is ready.`)) {
      setExtraction(null); setText('')
    }
  }
  async function saveSettings(e: FormEvent) {
    e.preventDefault()
    if (await action(async () => {
      const p = await api.savePreferences(settingsDraft); setPrefs(p)
    }, 'Your pace, updated.')) setSettings(false)
  }
  function startFocus(block: Block) { setFocus(block); setRemaining(block.minutes * 60); setRunning(true) }
  function fillExample() { setText(example); composerRef.current?.focus() }

  function TaskRow({ task }: { task: Task }) {
    return <article className={`task-row ${task.status === 'done' ? 'is-done' : ''}`}>
      <button className="check-btn" aria-label={`${task.status === 'done' ? 'Reopen' : 'Complete'} ${task.title}`} aria-pressed={task.status === 'done'} disabled={blocked} onClick={() => void toggleTask(task)}>{task.status === 'done' && <Check size={14}/>}</button>
      <div className="task-row-body"><h3>{task.title}</h3><div className="task-meta"><span><Clock3 size={12}/>{minutesLabel(task.duration)}</span><span className={`priority ${task.priority}`}>{task.priority} priority</span>{task.deadline && <span className={task.deadline < localDate() && task.status === 'todo' ? 'overdue' : ''}><CalendarDays size={12}/>{dateLabel(task.deadline)}</span>}<span>{task.effort} effort</span></div></div>
      <div className="row-actions"><button className="icon-btn" aria-label={`Edit ${task.title}`} onClick={() => editTask(task)} disabled={blocked}><Pencil size={15}/></button><button className="icon-btn danger" aria-label={`Delete ${task.title}`} onClick={() => setDeleting(task)} disabled={blocked}><Trash2 size={15}/></button></div>
    </article>
  }

  const timeline = <section className="panel timeline-panel" aria-labelledby="timeline-title">
    <div className="section-heading"><div className="flex items-center gap-3"><span className="square-icon violet"><CalendarDays size={17}/></span><h2 id="timeline-title">Your daily orbit</h2></div><span className="micro-label">{workBlocks.length ? `${scheduledTasks.length} TASKS · ${plan?.break_minutes}m REST` : 'ROOM TO BREATHE'}</span></div>
    <div className="timeline-toolbar"><div className="date-switch"><button className="icon-btn" disabled={blocked} aria-label="Previous day" onClick={() => setDate(moveDate(date, -1))}><ChevronLeft size={16}/></button><label className="date-picker"><span>{date === localDate() ? 'Today' : dateLabel(date)}</span><input aria-label="Plan date" type="date" value={date} disabled={blocked} onChange={e => { if (e.target.value) setDate(e.target.value) }}/></label><button className="icon-btn" disabled={blocked} aria-label="Next day" onClick={() => setDate(moveDate(date, 1))}><ChevronRight size={16}/></button></div><button className="text-btn" disabled={blocked || !pending.length} onClick={() => void generate(true)}><RefreshCw size={13}/>Reschedule</button></div>
    {loading ? <div className="empty-state"><LoaderCircle className="spin"/><p>Finding your rhythm…</p></div> : !plan || !workBlocks.length ? <div className="empty-state orbit-empty"><div className="empty-orbit"><Moon size={27}/></div><h3>{pending.length ? 'Let’s find your easy rhythm.' : 'A clear orbit. A clear mind.'}</h3><p>{pending.length ? 'Build a plan with focus, breaks, and breathing room.' : 'Add a few tasks. We’ll take it from there.'}</p>{pending.length > 0 && <button className="btn primary" disabled={blocked} onClick={() => void generate()}>Build my day <Sparkles size={15}/></button>}</div> : <div className="timeline">
      {plan.blocks.map((block, i) => <div className={`timeline-row ${block.kind === 'break' ? 'rest-row' : ''}`} key={`${block.task_id}-${i}`}>
        <div className="timeline-time">{block.start}<span>{block.end}</span></div>
        <div className="timeline-rail"><span/></div>
        {block.kind === 'break' ? <div className="break-block"><Coffee size={15}/><span>Step away. Recharge.</span><span className="ml-auto">{block.minutes}m</span></div> : <div className={`timeline-card ${block.priority === 'high' ? 'important' : ''}`}>
          <div className="flex items-start justify-between gap-2"><h3>{block.title}</h3><button className="play-btn" aria-label={`Focus on ${block.title}, part ${block.part}`} disabled={blocked} onClick={() => startFocus(block)}><Play size={13} fill="currentColor"/></button></div>
          <div className="task-meta"><span><Clock3 size={12}/>{block.minutes} min</span><span className={`effort-dot ${block.effort}`}>{block.effort} effort</span>{(block.parts || 0) > 1 && <span>Part {block.part}/{block.parts}</span>}</div>
        </div>}
      </div>)}
      <div className="timeline-finish"><span>✧</span> That’s enough for one day.</div>
    </div>}
    {plan && plan.deferred.length > 0 && <details className="deferred"><summary>{plan.deferred.length} task{plan.deferred.length > 1 ? 's' : ''} saved for another orbit <ArrowDown size={13}/></summary><p>Still in your task list. Nothing is lost.</p>{plan.deferred.map(d => <div key={d.task_id}><span>{d.title}</span><small>{d.reason}</small></div>)}</details>}
    {plan?.warnings.map((w, i) => <p key={i} className="warning"><Flame size={15}/>{w}</p>)}
  </section>

  return <div className="app-shell">
    <a href="#main" className="skip-link">Skip to content</a>
    <aside className="sidebar">
      <a href="#" className="brand" aria-label="SlothPlan home" onClick={e => { e.preventDefault(); setView('today') }}><span className="brand-mark"><Sloth small/></span><span>slothplan<span className="brand-ai">AI</span></span></a>
      <div className="workspace-label"><span className="workspace-avatar">S</span><span>My little universe<small>Personal workspace</small></span><span className="workspace-dot"/></div>
      <p className="nav-label">WORKSPACE</p>
      <nav aria-label="Main navigation">{([{ id: 'today', label: 'My day', icon: LayoutDashboard }, { id: 'tasks', label: 'All tasks', icon: ListTodo }, { id: 'insights', label: 'My rhythm', icon: BarChart3 }] as const).map(item => <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} aria-current={view === item.id ? 'page' : undefined} onClick={() => setView(item.id)}><item.icon size={18}/>{item.label}{item.id === 'today' ? <span className="nav-dot"/> : item.id === 'tasks' ? <span className="nav-count">{pending.length}</span> : null}</button>)}</nav>
      <div className="sidebar-space"/>
      <div className="slow-card"><span className="slow-spark">✧</span><span className="micro-label">A GENTLE REMINDER</span><p>You’re a human.<br/>Not a to-do list.</p><span>Slow is a perfectly good speed.</span></div>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => { setSettingsDraft(prefs); setSettings(true) }}><Settings2 size={17}/>Your preferences</button><button className="nav-item" onClick={() => setHelp(true)}><CircleHelp size={17}/>A little help<ArrowUpRight size={13} className="ml-auto"/></button><div className="profile"><span className="profile-avatar">YO</span><div>Your own pace<small>Less hustle. More life.</small></div><Moon size={16}/></div></div>
    </aside>

    <div className="main-shell"><header className="topbar"><div className="breadcrumb">My workspace <ChevronRight size={13}/><strong>{view === 'today' ? 'My day' : view === 'tasks' ? 'All tasks' : 'My rhythm'}</strong></div><div className="topbar-right"><button className={`connection-pill ${health?.ai_configured ? 'configured' : ''}`} onClick={() => setHelp(true)} title={health?.ai_configured ? 'API credentials are configured. Provider availability is checked during extraction.' : health?.fallback_enabled ? 'Rule-based extraction is available without API credentials.' : 'Add tasks manually, or configure hosted Gemma.'}><span/>{health ? health.ai_configured ? 'Gemma configured' : health.fallback_enabled ? 'Local rules active' : 'Manual entry ready' : 'Connecting…'}</button><span className="top-divider"/><button className="icon-btn" aria-label="Preferences" onClick={() => { setSettingsDraft(prefs); setSettings(true) }}><SlidersHorizontal size={18}/></button><span className="tiny-avatar">S</span></div></header>

    <main id="main" className="main-content">
      <div className="page-heading"><div><div className="eyebrow"><span/>YOUR PACE. YOUR SPACE.</div><h1>{view === 'today' ? 'A little less hustle.' : view === 'tasks' ? 'Out of your head.' : 'Small steps add up.'}</h1><p>{view === 'today' ? 'Big plans can wait. Let’s make today feel lighter.' : view === 'tasks' ? 'Everything you need to do, with room to take it slowly.' : 'A calmer look at what you’ve done and what comes next.'}</p></div><span className="heading-date"><CalendarDays size={15}/>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>

      {error && <div role="alert" className="error-banner"><span>{error}</span><button className="text-btn" onClick={() => void load()} disabled={blocked}>Retry</button><button className="icon-btn" aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div>}
      <div role="status" aria-live="polite" className={`toast ${notice ? 'visible' : ''}`}>{notice && <><CheckCheck size={17}/>{notice}</>}</div>

      {view === 'today' && <>
        <section className={`hero ${mode ? 'sloth-active' : ''}`}>
          <div className="hero-grid" aria-hidden="true"/><div className="hero-orbit" aria-hidden="true"/>
          <div className="hero-copy"><div className="hero-badge"><span/>THE ART OF DOING JUST ENOUGH</div><h2>Do less.<br/><span>Live a little more.</span></h2><p>Offload the mental tabs. Find your easy wins.<br className="desktop-break"/> Let your day unfold at sloth speed.</p><button className="hero-cta" disabled={blocked} onClick={() => void toggleMode()}>{mode ? 'Sloth Mode is on' : 'Find my sloth speed'}<ArrowUpRight size={17}/></button></div>
          <div className="hero-visual"><span className="orbit-label label-top"><span/>LOW ENERGY. HIGH POTENTIAL.</span><Sloth/><div className="floating-badge"><Moon size={15}/><span>Currently conserving energy</span><span className="battery"><i/><i/><i/></span></div><span className="orbit-coordinate">SLOTH.OS / 01</span></div>
        </section>

        <section className="stats-grid" aria-label="Day at a glance"><div className="stat"><span className="square-icon violet"><ListTodo size={17}/></span><div><span>On your radar</span><strong>{pending.length}<small>tasks to go</small></strong></div><span className="stat-decoration">↗</span></div><div className="stat"><span className="square-icon cyan"><Clock3 size={17}/></span><div><span>Planned focus</span><strong>{minutesLabel(plan?.work_minutes || 0)}<small>of {minutesLabel(workBudget)} budget</small></strong></div><div className="mini-bars" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div></div><div className="stat"><span className="square-icon pink"><CheckCheck size={17}/></span><div><span>Off your mind</span><strong>{completed.length}<small>tasks completed</small></strong></div><span className="stat-decoration pink-text">✧</span></div></section>

        <div className="dashboard-grid"><div className="dashboard-left">
          <section className="panel composer" aria-labelledby="composer-title"><div className="section-heading"><div className="flex items-center gap-3"><span className="square-icon violet"><Sparkles size={17}/></span><h2 id="composer-title">What’s on your mind?</h2></div><span className="small-tag">BRAIN DUMP</span></div><p>Messy thoughts welcome. We’ll turn them into a plan.</p><form onSubmit={e => void extract(e)}><label htmlFor="brain-dump" className="sr-only">Describe your tasks</label><textarea id="brain-dump" ref={composerRef} maxLength={6000} rows={4} value={text} onChange={e => setText(e.target.value)} placeholder="I need to finish that proposal, reply to a few emails, and maybe book a dentist appointment…" onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); void extract() } }}/><div className="composer-footer"><span><ShieldCheck size={13}/>Review before anything is saved</span><button type="submit" className="btn primary" disabled={blocked || !text.trim()}>{extracting ? <LoaderCircle size={15} className="spin"/> : <Sparkles size={15}/>} {extracting ? 'Untangling…' : 'Untangle my day'}<ArrowRight size={14}/></button></div></form><div className="suggestions"><span>Need a nudge?</span><button onClick={fillExample}>Try an example <ArrowUpRight size={11}/></button><button onClick={() => { setText(''); newTask() }}>Add a task manually <Plus size={11}/></button></div></section>

          <section className="mode-card"><div className="mode-icon"><Moon size={24}/><span>z</span></div><div><h2>Sloth Mode <span>{mode ? 'ON' : 'OFF'}</span></h2><p>Less effort. More breathing room.</p></div><button role="switch" aria-label="Sloth Mode" aria-checked={mode} disabled={blocked} className={`toggle ${mode ? 'on' : ''}`} onClick={() => void toggleMode()}><span/></button><div className="mode-detail"><span><Zap size={13}/>{mode ? Math.min(25, prefs.focus_minutes) : prefs.focus_minutes}m focus blocks</span><span><Coffee size={13}/>{mode ? Math.max(15, prefs.break_minutes) : prefs.break_minutes}m breaks</span><span><Moon size={13}/>{minutesLabel(workBudget)} daily limit</span></div></section>

          <section className="panel task-panel"><div className="section-heading"><div className="flex items-center gap-3"><span className="square-icon cyan"><ListTodo size={17}/></span><h2>Your next small steps <span className="count-badge">{pending.length}</span></h2></div><button className="icon-btn" aria-label="Add task" disabled={blocked} onClick={newTask}><Plus size={18}/></button></div>{loading ? <p className="muted px-5 py-6">Loading your tasks…</p> : pending.length ? pending.slice(0, 4).map(t => <TaskRow key={t.id} task={t}/>) : <div className="task-empty"><div className="empty-check"><Check size={22}/></div><h3>Nothing weighing you down.</h3><p>Brain dump above, or add one small task.</p><button className="text-btn" onClick={newTask} disabled={blocked}><Plus size={14}/>Add your first task</button></div>}<button className="panel-footer" onClick={() => setView('tasks')}>View all tasks <ArrowRight size={14}/></button></section>
        </div><div className="dashboard-right">{timeline}<div className="little-note"><span>✦</span><p>Progress isn’t always a sprint.<br/><strong>Sometimes it’s just showing up.</strong></p></div></div></div>
      </>}

      {view === 'tasks' && <section className="panel all-tasks"><div className="tasks-toolbar"><div className="search-wrap"><Search size={16}/><input aria-label="Search tasks" placeholder="Find a task…" value={query} onChange={e => setQuery(e.target.value)}/></div><select aria-label="Filter tasks" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All tasks</option><option value="todo">To do</option><option value="done">Completed</option><option value="due">Due / overdue</option></select><button className="btn primary" disabled={blocked} onClick={newTask}><Plus size={16}/>New task</button></div><div className="task-list-label"><span>{tasks.length} TASKS IN YOUR UNIVERSE</span><span>ONE SMALL STEP AT A TIME</span></div>{tasks.filter(t => t.title.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || t.status === filter || (filter === 'due' && t.status === 'todo' && t.deadline && t.deadline <= date))).map(t => <TaskRow key={t.id} task={t}/>)}{!tasks.filter(t => t.title.toLowerCase().includes(query.toLowerCase()) && (filter === 'all' || t.status === filter || (filter === 'due' && t.status === 'todo' && t.deadline && t.deadline <= date))).length && <div className="empty-state"><ListTodo size={28}/><h3>{tasks.length ? 'No tasks match this view.' : 'Start with one small thing.'}</h3><p>{tasks.length ? 'Try another search or filter.' : 'A task out of your head is already a little win.'}</p></div>}</section>}

      {view === 'insights' && <><div className="insight-grid"><section className="panel rhythm-card"><span className="micro-label">YOUR PROGRESS, WITHOUT THE PRESSURE</span><div className="progress-orbit" style={{ '--progress': `${tasks.length ? completed.length / tasks.length * 360 : 0}deg` } as React.CSSProperties}><div><strong>{tasks.length ? Math.round(completed.length / tasks.length * 100) : 0}%</strong><span>off your mind</span></div></div><h2>{completed.length ? `${completed.length} small ${completed.length === 1 ? 'win' : 'wins'}. Real progress.` : 'Your first win is waiting.'}</h2><p>{completed.length ? `${minutesLabel(completed.reduce((n, t) => n + t.duration, 0))} of estimated task effort completed.` : 'No streaks to maintain. No guilt to carry.'}</p></section><section className="panel rhythm-details"><h2>Room for what matters.</h2><p>Your current task list, at a glance.</p>{(['low', 'medium', 'high'] as const).map(effort => { const count = pending.filter(t => t.effort === effort).length; return <div className="effort-insight" key={effort}><div><span>{effort === 'low' ? 'Easy wins' : effort === 'medium' ? 'A little focus' : 'Deep work'}</span><strong>{count} tasks</strong></div><div className={`effort-bar ${effort}`}><i style={{ width: `${pending.length ? count / pending.length * 100 : 0}%` }}/></div></div> })}<div className="insight-foot"><CalendarDays size={17}/><span>{due ? `${due} tasks are due or overdue for ${dateLabel(date)}.` : 'No urgent deadlines for this day.'}</span></div></section></div><section className="panel completed-panel"><div className="section-heading"><h2>Little victories</h2><span className="micro-label">COMPLETED TASKS</span></div>{completed.length ? completed.map(t => <TaskRow key={t.id} task={t}/>) : <div className="empty-state"><Coffee size={27}/><p>Your completed tasks will land here.</p></div>}</section></>}

      <footer className="app-footer"><span><span className="footer-symbol">✧</span> Built for humans, inspired by sloths.</span><span>Less friction. More living. <Moon size={12}/></span></footer>
    </main></div>

    {editing && <Modal title={editing === 'new' ? 'One small task' : 'Give this task a little edit'} close={() => setEditing(null)} busy={busy}><form onSubmit={e => void saveTask(e)}><TaskFields value={draft} change={setDraft}/>{error && <p role="alert" className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button className="btn primary" disabled={busy}>{busy && <LoaderCircle size={15} className="spin"/>}Save task</button></div></form></Modal>}
    {extraction && <Modal title="A little clarity. Your tasks, untangled." close={() => setExtraction(null)} busy={busy}><p className={`extraction-message ${extraction.source === 'rules' ? 'fallback' : ''}`}><Cpu size={18}/><span><strong>{extraction.source === 'gemma' ? 'Extracted with Gemma' : 'Extracted with local rules'}</strong>{extraction.message}</span></p><form onSubmit={e => void saveExtracted(e)}><div className="draft-list">{extraction.tasks.map((d, i) => <section className="draft-card" key={i}><div className="draft-heading"><span>TASK {String(i + 1).padStart(2, '0')}</span><button type="button" className="icon-btn danger" aria-label={`Remove draft ${i + 1}`} onClick={() => setExtraction({ ...extraction, tasks: extraction.tasks.filter((_, j) => j !== i) })}><Trash2 size={15}/></button></div><TaskFields prefix={`draft-${i}`} value={d} change={next => setExtraction({ ...extraction, tasks: extraction.tasks.map((item, j) => j === i ? next : item) })}/></section>)}</div>{error && <p role="alert" className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={() => setExtraction(null)}>Back</button><button className="btn primary" disabled={busy || !extraction.tasks.length}>{busy ? <LoaderCircle size={15} className="spin"/> : <Check size={15}/>}Add {extraction.tasks.length} tasks & plan</button></div></form></Modal>}
    {deleting && <Modal title="Let this one go?" close={() => setDeleting(null)} busy={busy}><p className="modal-copy">Delete “{deleting.title}”? This also removes it from your schedule.</p>{error && <p role="alert" className="form-error">{error}</p>}<div className="modal-actions"><button className="btn secondary" disabled={busy} onClick={() => setDeleting(null)}>Keep it</button><button className="btn destructive" disabled={busy} onClick={async () => { if (await action(() => api.remove(deleting.id), 'Task deleted. A little more room.')) { if (focus?.task_id === deleting.id) { setFocus(null); setRunning(false) } setDeleting(null) } }}>Delete task</button></div></Modal>}
    {settings && <Modal title="Set your own pace" close={() => setSettings(false)} busy={busy}><p className="modal-copy">Your focus budget counts work only. Breaks fit inside your available hours. Changes refresh your plan.</p><form onSubmit={e => void saveSettings(e)}><div className="task-fields"><div className="field-grid two"><label>Day starts<input type="time" required value={settingsDraft.start_time} onChange={e => setSettingsDraft({ ...settingsDraft, start_time: e.target.value })}/></label><label>Day ends<input type="time" required value={settingsDraft.end_time} onChange={e => setSettingsDraft({ ...settingsDraft, end_time: e.target.value })}/></label></div><div className="field-grid two"><label>Daily work budget (minutes)<input required type="number" min={30} max={480} value={settingsDraft.daily_budget} onChange={e => setSettingsDraft({ ...settingsDraft, daily_budget: Number(e.target.value) })}/></label><label>Sloth work budget (minutes)<input required type="number" min={15} max={Math.min(settingsDraft.daily_budget, 240)} value={settingsDraft.sloth_budget} onChange={e => setSettingsDraft({ ...settingsDraft, sloth_budget: Number(e.target.value) })}/></label></div><div className="field-grid two"><label>Focus block (minutes)<input required type="number" min={15} max={90} value={settingsDraft.focus_minutes} onChange={e => setSettingsDraft({ ...settingsDraft, focus_minutes: Number(e.target.value) })}/></label><label>Break (minutes)<input required type="number" min={5} max={30} value={settingsDraft.break_minutes} onChange={e => setSettingsDraft({ ...settingsDraft, break_minutes: Number(e.target.value) })}/></label></div><p className="settings-note"><Moon size={15}/>Sloth Mode caps focus blocks at 25 minutes and gives you at least 15 minutes between them.</p></div>{error && <p role="alert" className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={() => setSettings(false)}>Cancel</button><button className="btn primary" disabled={busy}>Save my pace</button></div></form></Modal>}
    {help && <Modal title="A gentler way to get things done" close={() => setHelp(false)}><div className="help-content"><p>1. Brain dump your tasks, durations and deadlines. Review the extracted details, then add them to your plan.</p><p>2. Your daily orbit respects deadlines, work hours, focus limits and breaks. Tasks that don’t fit stay in your task list.</p><p>3. Switch on Sloth Mode for a smaller work budget, shorter focus sessions and easier wins. Urgent tasks still come first.</p><p>4. Reschedule shifts unfinished tasks into the remaining hours of today. It doesn’t change deadlines or track partial work.</p><div className="help-status"><Cpu size={20}/><div><strong>{health?.ai_configured ? 'Hosted Gemma is configured' : health?.fallback_enabled ? 'Local extraction is active' : 'Manual task entry is available'}</strong><p>{health?.ai_configured ? 'Brain dumps are sent to your configured AI provider. Tasks are saved locally in your workspace database. Provider availability is checked when you extract.' : health?.fallback_enabled ? 'Local rules support simple English tasks, durations and dates. Review carefully. No text is sent to an AI provider while credentials are absent.' : 'AI extraction is not configured. You can still add, edit and schedule tasks manually.'}</p></div></div><p className="muted">This is a personal, single-user workspace. A focus timer is a gentle reminder; it doesn’t automatically mark a task done.</p></div></Modal>}
    {focus && <div className="focus-dock" role="region" aria-label="Focus timer"><span className="focus-orb"><Moon size={20}/></span><div className="focus-info"><span>ONE THING AT A TIME · PART {focus.part}/{focus.parts}</span><strong>{focus.title}</strong></div><span className="timer" role="timer">{String(Math.floor(remaining / 60)).padStart(2, '0')}:{String(remaining % 60).padStart(2, '0')}</span><button className="icon-btn" aria-label={running ? 'Pause timer' : 'Resume timer'} disabled={remaining === 0} onClick={() => setRunning(!running)}>{running ? <Pause size={18}/> : <Play size={18}/>}</button><button className="btn primary" disabled={blocked} onClick={() => { const task = tasks.find(t => t.id === focus.task_id); if (task) void toggleTask(task) }}><Check size={14}/>Task done</button><button className="icon-btn" aria-label="Close timer" onClick={() => { setRunning(false); setFocus(null) }}><X size={18}/></button></div>}
  </div>
}
