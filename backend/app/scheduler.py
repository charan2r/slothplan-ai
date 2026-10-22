from datetime import date, datetime, timedelta

from .models import PlanRequest, Preferences


def make_plan(tasks: list[dict], request: PlanRequest, prefs: Preferences):
    """Deterministic, deadline-first planner. Allocates whole tasks, split into focus blocks.

    Only fully fitting tasks enter the plan; no work silently disappears into partial
    allocations. Rest counts toward the clock window, but not the work budget.
    Dates and times are the user's local wall clock, supplied by the client.
    """
    day = request.date.isoformat()
    start = max(prefs.start_time, request.from_time or prefs.start_time)
    cursor = datetime.fromisoformat(f'{day}T{start}')
    end = datetime.fromisoformat(f'{day}T{prefs.end_time}')
    budget = prefs.sloth_budget if request.sloth_mode else prefs.daily_budget
    focus = min(prefs.focus_minutes, 25) if request.sloth_mode else prefs.focus_minutes
    rest = max(prefs.break_minutes, 15) if request.sloth_mode else prefs.break_minutes
    levels = {'high': 0, 'medium': 1, 'low': 2}
    eligible = [t for t in tasks if t['status'] == 'todo' and (not t['not_before'] or t['not_before'] <= day)]

    def rank(task):
        deadline = task['deadline']
        urgent = bool(deadline and deadline <= day)
        # Urgent deadlines always win. Sloth Mode then chooses low-effort quick wins.
        if request.sloth_mode:
            return (not urgent, deadline if urgent else '', levels[task['priority']] if urgent else 0,
                    {'low': 0, 'medium': 1, 'high': 2}[task['effort']], task['duration'],
                    deadline or '9999-12-31', levels[task['priority']], task['created_at'])
        return (not urgent, deadline or '9999-12-31', levels[task['priority']], task['duration'], task['created_at'])

    blocks, deferred, warnings = [], [], []
    work = 0
    for task in sorted(eligible, key=rank):
        chunks = []
        left = task['duration']
        while left:
            chunk = min(left, focus)
            chunks.append(chunk)
            left -= chunk
        # A break between each work block, including the boundary between tasks.
        needed_rest = rest * (len(chunks) - 1 + bool(blocks))
        if work + task['duration'] > budget or cursor + timedelta(minutes=task['duration'] + needed_rest) > end:
            reason = 'Work budget reached' if work + task['duration'] > budget else 'Outside your available hours'
            deferred.append({'task_id': task['id'], 'title': task['title'], 'reason': reason})
            if task['deadline'] and task['deadline'] <= day:
                warnings.append(f'"{task["title"]}" is due or overdue and does not fit. Increase your budget or shorten it.')
            continue
        for i, chunk in enumerate(chunks):
            if blocks:
                next_time = cursor + timedelta(minutes=rest)
                blocks.append({'kind': 'break', 'title': 'Recharge. You earned it.', 'task_id': None,
                               'start': cursor.strftime('%H:%M'), 'end': next_time.strftime('%H:%M'), 'minutes': rest})
                cursor = next_time
            next_time = cursor + timedelta(minutes=chunk)
            blocks.append({'kind': 'task', 'title': task['title'], 'task_id': task['id'],
                           'start': cursor.strftime('%H:%M'), 'end': next_time.strftime('%H:%M'),
                           'minutes': chunk, 'part': i + 1, 'parts': len(chunks),
                           'effort': task['effort'], 'priority': task['priority']})
            cursor = next_time
        work += task['duration']
        if task['deadline'] and task['deadline'] < day:
            warnings.append(f'"{task["title"]}" is overdue; it has been moved to the front of your plan.')

    return {'date': day, 'sloth_mode': request.sloth_mode, 'blocks': blocks, 'deferred': deferred,
            'warnings': warnings, 'work_minutes': work, 'budget_minutes': budget,
            'break_minutes': sum(b['minutes'] for b in blocks if b['kind'] == 'break'),
            'generated_at': datetime.now().isoformat(), 'from_time': request.from_time}
