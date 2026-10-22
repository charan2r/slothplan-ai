import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from uuid import uuid4

from .models import TaskCreate, Preferences


def utc_now():
    return datetime.now(timezone.utc).isoformat()


class Database:
    def __init__(self, path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.executescript('''
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY, data TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS state (
                    key TEXT PRIMARY KEY, data TEXT NOT NULL
                );
            ''')

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(self.path, timeout=10)
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def tasks(self):
        with self.connect() as conn:
            return [json.loads(row[0]) for row in conn.execute('SELECT data FROM tasks ORDER BY rowid')]

    def create_many(self, drafts):
        tasks = []
        with self.connect() as conn:
            for draft in drafts:
                data = TaskCreate.model_validate(draft.model_dump()).model_dump(mode='json')
                task = dict(data, id=str(uuid4()), created_at=utc_now(),
                            completed_at=utc_now() if data['status'] == 'done' else None)
                conn.execute('INSERT INTO tasks VALUES (?, ?)', (task['id'], json.dumps(task)))
                tasks.append(task)
            self.invalidate(conn)
        return tasks

    def replace(self, task_id, data):
        with self.connect() as conn:
            row = conn.execute('SELECT data FROM tasks WHERE id=?', (task_id,)).fetchone()
            if not row:
                return None
            old = json.loads(row[0])
            task = dict(data.model_dump(mode='json'), id=task_id, created_at=old['created_at'],
                        completed_at=(old['completed_at'] or utc_now()) if data.status == 'done' else None)
            conn.execute('UPDATE tasks SET data=? WHERE id=?', (json.dumps(task), task_id))
            self.invalidate(conn)
            return task

    def delete(self, task_id):
        with self.connect() as conn:
            found = conn.execute('DELETE FROM tasks WHERE id=?', (task_id,)).rowcount
            if found:
                self.invalidate(conn)
            return bool(found)

    def invalidate(self, conn):
        conn.execute("DELETE FROM state WHERE key LIKE 'plan:%'")

    def get(self, key, default=None):
        with self.connect() as conn:
            row = conn.execute('SELECT data FROM state WHERE key=?', (key,)).fetchone()
            return json.loads(row[0]) if row else default

    def put(self, key, data):
        with self.connect() as conn:
            conn.execute('INSERT INTO state VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET data=excluded.data',
                         (key, json.dumps(data)))
            if key == 'preferences':
                self.invalidate(conn)

    def preferences(self):
        return Preferences.model_validate(self.get('preferences', {}))
