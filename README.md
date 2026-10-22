# SlothPlan AI

**Do less. Live a little more.** A working personal daily planner with hosted Gemma task extraction, a React + Tailwind interface, a Python + FastAPI backend, and SQLite persistence.

## Quick start

Requirements: **Python 3.11+**, **Node.js 22+**, and npm. Run the two servers in separate terminals. Commands below assume you start inside this `slothplan-ai` folder.

### 1. Backend — Windows PowerShell

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

macOS / Linux:

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
cp .env.example .env
.venv/bin/python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

No virtual-environment activation is required. SQLite initializes automatically at `backend/data/slothplan.db`, regardless of your launch directory. Override `DATABASE_PATH` with an absolute path or a path relative to `backend/`.

For the exact backend dependency versions used in verification, install `requirements-lock.txt` in place of `requirements.txt`.

### 2. Frontend — second terminal

```bash
cd frontend
npm ci
npm run dev
```

On Windows, use `npm.cmd` if PowerShell blocks `npm.ps1`. Open **[http://127.0.0.1:5173](http://127.0.0.1:5173)**. The frontend proxies `/api` to port 8000. The API reference is at **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**.

The app works immediately without credentials using **clearly disclosed local rules**. Click **Try an example**, then **Untangle my day**, review the drafts, and add them. Nothing is pre-seeded into your database.

## Turn on hosted Gemma

Edit `backend/.env` and restart the backend. Use a provider account and key with access to your chosen model. Keys are never sent to the browser, returned by the health endpoint, or embedded in frontend assets.

OpenRouter example:

```dotenv
GEMMA_API_BASE_URL=https://openrouter.ai/api/v1
GEMMA_API_KEY=your_provider_key_here
GEMMA_MODEL=google/gemma-3-27b-it
GEMMA_PROVIDER=OpenRouter
```

Hugging Face Inference Providers example:

```dotenv
GEMMA_API_BASE_URL=https://router.huggingface.co/v1
GEMMA_API_KEY=your_hugging_face_token_here
GEMMA_MODEL=google/gemma-3-27b-it
GEMMA_PROVIDER=Hugging Face
```

The URL is a **base URL**; the backend appends `/chat/completions`. Any compatible provider or self-hosted Gemma endpoint can be used. Set the exact model ID accepted by that provider. An OpenRouter key is not interchangeable with a Hugging Face token. Provider availability, usage charges, quotas, model access and Gemma license acceptance are controlled by the provider; check its current catalog. The frontend badge reports whether credentials are configured, not a claim that the provider has been contacted successfully.

Relevant documentation: [OpenRouter Gemma 3 27B providers](https://openrouter.ai/google/gemma-3-27b-it/providers), [Hugging Face supported models](https://huggingface.co/inference/models), [Gemma model card and license](https://huggingface.co/google/gemma-3-27b-it).

### Failure handling

- Requests have a configurable timeout (`GEMMA_TIMEOUT_SECONDS`, default 25).
- Authentication failures, rate limits, unavailable models, network errors, malformed JSON and invalid task fields are handled without exposing upstream response bodies or keys.
- With `ALLOW_RULE_FALLBACK=true`, a labelled rule-based result is offered for review. The app never calls rules “Gemma” or silently saves their output.
- With `ALLOW_RULE_FALLBACK=false`, extraction returns a clear HTTP 503. Manual task entry, CRUD and scheduling still work.
- Results must pass strict server-side validation before being returned as drafts. Drafts are editable and require explicit confirmation before saving.
- An extraction request never mutates the database. Batch inserts are atomic.

The local fallback understands simple English task clauses separated by semicolons, newlines, `and`, or commas followed by common action verbs. It recognizes minute/hour durations, simple priority cues, today/tomorrow, weekdays and ISO dates. It is deliberately conservative: compound titles, complex dates, languages other than English and nuanced instructions need manual review or hosted Gemma.

## What works

- Natural-language brain dump → Gemma extraction → editable task review → atomic save and daily plan.
- Task creation, editing, completion/reopening, deletion, search and status/deadline filters.
- Task priority, effort estimate, duration, optional due date, optional earliest day and notes.
- Daily planning, date navigation, persistent schedules and a one-click **Reschedule** action.
- Preferences for available hours, work budgets, focus blocks and breaks.
- **Sloth Mode**: lower work budget (90 minutes by default), focus blocks capped at 25 minutes, breaks of at least 15 minutes, and preference for easier, shorter tasks after urgent deadlines.
- Focus timer with pause/resume. It compensates for delayed browser ticks; it does not record partial work or automatically complete tasks. **Task done** marks the entire task complete, including tasks split across multiple blocks.
- **My rhythm**: completion percentage, total estimated effort completed, remaining effort distribution and completed task list. All figures come from saved tasks.
- Responsive layouts with a desktop sidebar and mobile bottom navigation; native modal focus management, Escape handling, labelled controls, focus indicators, live status messages and reduced-motion support.

## Scheduling rules and limits

Scheduling is deterministic and testable. Gemma interprets language; Python applies the calendar constraints. Plans use the **browser's local calendar and wall-clock times**, not the server's timezone. Relative dates sent to Gemma use the browser's actual current day, even when viewing another day.

1. Completed tasks and tasks whose earliest day is in the future are excluded.
2. Overdue and due-today tasks go first, ordered by deadline and then priority. Balanced mode then sorts by earliest deadline, priority and duration. Sloth Mode ranks the remaining tasks by effort and duration, with deadline and priority as tie breakers.
3. A task is only included if **the entire task**, including required breaks, fits within both the work budget and the available hours. It is divided into focus blocks; no break is added after the final block.
4. Work budget counts focus minutes only. Breaks consume time in the available-hours window.
5. Tasks that do not fit remain visible in a deferred section and in **All tasks**. Urgent tasks that do not fit produce a warning. Deadlines are never silently changed.
6. **Build my day** plans from your preferred start time. **Reschedule** starts at the later of the current local time and your preferred start time when planning today; for other dates it uses the preferred start time. After working hours it returns a visible deferred list.
7. Task or preference changes invalidate old plans and the active day is rebuilt from preferred start time. Click **Reschedule** afterward to use only the rest of today. Plans for other dates are rebuilt when requested.

This is a **single-user, local-first app**, with one shared task list and date-based saved plans. A task may appear in plans for different days until it is completed. Plans are not reservations or a multi-day calendar. Deadlines have day precision; overnight work windows, fixed appointments, recurring tasks and partial completion are not supported.

## Privacy and open innovation

Gemma is central to language understanding when configured: it turns informal, multi-task text into structured estimates, deadlines, priorities and effort without a proprietary model dependency. Its open weights mean the model can be swapped, fine-tuned or hosted on infrastructure you control. The small chat-completions adapter keeps that choice independent of the UI and scheduler. The application code is MIT licensed; Gemma weights have their own terms.

SQLite keeps saved tasks and plans on the machine running the backend. **Hosted inference is not offline or private to your machine**: the brain-dump text and current date are sent to the configured provider, under that provider's data policies. The app does not send the existing task database to the provider. Without credentials, local-rule extraction, CRUD and scheduling need no AI service. There is no telemetry, remote font dependency, or external illustration dependency.

This app has no authentication or user isolation. Keep both servers on loopback for personal use. Public deployment requires authentication, authorization, rate limits, TLS, backups and appropriate infrastructure. CORS alone is not authentication.

## Configuration

`backend/.env.example` lists every backend setting. Environment variables take precedence over `.env`. Restart the backend after configuration changes.

`frontend/.env.example` contains **public configuration only**. Copy it to `frontend/.env` if needed:

```dotenv
# Development / preview proxy target:
BACKEND_URL=http://127.0.0.1:8000
# For a separate API origin in a built frontend (public; never a secret):
VITE_API_BASE_URL=http://127.0.0.1:8000
```

If origins change, set `CORS_ORIGINS` in the backend to an explicit comma-separated list of trusted frontend origins. A production build needs either a reverse proxy routing `/api` to FastAPI, or a configured `VITE_API_BASE_URL` and matching CORS origins. Vite's development proxy is not embedded in built assets.

## Build and tests

Backend (from `backend/`):

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

On macOS/Linux use `.venv/bin/python` in place of `.\.venv\Scripts\python.exe`.

Frontend (from `frontend/`):

```bash
npm test
npm run build
npm run preview
```

Preview runs on port 4173. Its configured proxy still points to the backend, so leave FastAPI running.

Browser integration tests exercise the **real FastAPI + SQLite backend**, on ports **8011 and 5175**, with a dedicated `backend/data/e2e.db`. Test setup clears only that dedicated database's tasks. Do not point it at your personal database. Chromium is required:

```bash
npx playwright install chromium
npm run test:e2e
```

The Playwright server configuration selects the virtual-environment Python executable for Windows or macOS/Linux automatically. Optionally set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use an already installed Chromium executable. No production credentials are used in tests. Provider behavior is tested with HTTP mocks (success, rejection, throttling, server failure, timeout and invalid model output), not paid live inference.

See [VALIDATION.md](VALIDATION.md) for the recorded verification results and [DESIGN.md](DESIGN.md) for the visual research.

## Structure

```text
frontend/
  src/App.tsx                 Connected views and task flows
  src/components/             Robot sloth, task fields, accessible modal
  src/api.ts                  Typed API client and error handling
  src/styles.css              Original visual design + Tailwind
  e2e/                        Desktop/mobile browser integration tests
backend/
  app/main.py                 FastAPI routes and application factory
  app/extraction.py           Hosted Gemma adapter and disclosed local fallback
  app/scheduler.py            Deterministic scheduling and Sloth Mode
  app/database.py             Transactional SQLite storage
  app/models.py               Request and task validation
  tests/                      API, provider and scheduling tests
```

API endpoints: `GET /api/health`; `GET/POST /api/tasks`; `POST /api/tasks/batch`; `PUT/DELETE /api/tasks/{id}`; `POST /api/extract`; `GET/PUT /api/preferences`; `GET /api/plan?date=YYYY-MM-DD`; `POST /api/plan` with `{ "date": "YYYY-MM-DD", "sloth_mode": false, "from_time": "14:30" }` (`from_time` optional). Task updates replace the editable record; see `/docs` for schemas.

## Troubleshooting

- **Cannot reach SlothPlan:** start FastAPI on port 8000, then the frontend. Check `/api/health`. For another port, update `BACKEND_URL` and restart Vite.
- **Gemma configured but local rules returned:** inspect the human-readable extraction message. Verify provider key, available model ID, quota, access and timeout. The health badge does not make a paid model request.
- **No tasks in a plan:** check earliest dates, focus budget, task duration, work hours and the deferred list. A single task larger than the budget is deferred intact.
- **Port already in use:** stop the previous server, or explicitly configure another port and update proxy/CORS settings.
- **Corporate certificate errors:** use your organization's trusted CA configuration. This project does not disable TLS verification.

The app uses system fonts and a hand-authored SVG mascot; no external assets or secrets are needed to render it.
