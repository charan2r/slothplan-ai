from contextlib import asynccontextmanager
from datetime import date

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from .config import Settings
from .database import Database
from .extraction import extract
from .models import ExtractRequest, PlanRequest, Preferences, Task, TaskBatch, TaskCreate
from .scheduler import make_plan


def create_app(settings: Settings | None = None):
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app):
        app.state.db = Database(settings.db_path)
        yield

    app = FastAPI(title='SlothPlan AI', version='1.0.0', lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins),
                       allow_methods=['GET', 'POST', 'PUT', 'DELETE'], allow_headers=['Content-Type'])

    @app.get('/api/health')
    def health():
        return {'status': 'ok', 'ai_configured': bool(settings.api_key),
                'model': settings.model, 'provider': settings.provider, 'fallback_enabled': settings.fallback}

    @app.get('/api/tasks', response_model=list[Task])
    def tasks():
        return app.state.db.tasks()

    @app.post('/api/tasks', response_model=Task, status_code=201)
    def create_task(task: TaskCreate):
        return app.state.db.create_many([task])[0]

    @app.post('/api/tasks/batch', response_model=list[Task], status_code=201)
    def create_batch(batch: TaskBatch):
        return app.state.db.create_many(batch.tasks)

    @app.put('/api/tasks/{task_id}', response_model=Task)
    def update_task(task_id: str, task: TaskCreate):
        result = app.state.db.replace(task_id, task)
        if not result:
            raise HTTPException(404, 'Task not found.')
        return result

    @app.delete('/api/tasks/{task_id}', status_code=204)
    def delete_task(task_id: str):
        if not app.state.db.delete(task_id):
            raise HTTPException(404, 'Task not found.')
        return Response(status_code=204)

    @app.post('/api/extract')
    async def extract_tasks(request: ExtractRequest):
        return await extract(request, settings)

    @app.get('/api/preferences', response_model=Preferences)
    def preferences():
        return app.state.db.preferences()

    @app.put('/api/preferences', response_model=Preferences)
    def save_preferences(prefs: Preferences):
        app.state.db.put('preferences', prefs.model_dump())
        return prefs

    @app.post('/api/plan')
    def generate_plan(request: PlanRequest):
        db = app.state.db
        plan = make_plan(db.tasks(), request, db.preferences())
        db.put('plan:' + request.date.isoformat(), plan)
        return plan

    @app.get('/api/plan')
    def get_plan(date: date = Query(...)):
        return app.state.db.get('plan:' + date.isoformat())

    return app


app = create_app()
