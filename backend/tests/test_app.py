import json
import tempfile
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.models import PlanRequest, Preferences, TaskCreate
from app.scheduler import make_plan


class APITests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.settings = Settings(database_path=str(Path(self.tmp.name) / 'tasks.db'), api_key='')
        self.app = create_app(self.settings)
        self.client = TestClient(self.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.tmp.cleanup()

    def create(self, **overrides):
        data = {'title': 'Reply to email', 'duration': 15, 'effort': 'low', **overrides}
        r = self.client.post('/api/tasks', json=data)
        self.assertEqual(r.status_code, 201, r.text)
        return r.json()

    def test_crud_persistence_and_plan_invalidation(self):
        task = self.create()
        self.assertEqual(len(self.client.get('/api/tasks').json()), 1)
        r = self.client.post('/api/plan', json={'date': '2026-10-22'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['work_minutes'], 15)
        self.assertIsNotNone(self.client.get('/api/plan?date=2026-10-22').json())
        body = TaskCreate.model_validate({k: v for k, v in task.items() if k not in ('id', 'created_at', 'completed_at')}).model_dump(mode='json')
        body.update(status='done', title='Replied')
        done = self.client.put('/api/tasks/' + task['id'], json=body).json()
        self.assertIsNotNone(done['completed_at'])
        self.assertIsNone(self.client.get('/api/plan?date=2026-10-22').json())
        with TestClient(create_app(self.settings)) as second:
            self.assertEqual(second.get('/api/tasks').json()[0]['title'], 'Replied')
        self.assertEqual(self.client.delete('/api/tasks/' + task['id']).status_code, 204)
        self.assertEqual(self.client.get('/api/tasks').json(), [])
        self.assertEqual(self.client.delete('/api/tasks/' + task['id']).status_code, 404)

    def test_validation_and_atomic_batch(self):
        for bad in ({'title': ''}, {'title': 'bad', 'duration': 0}, {'title': 'bad', 'priority': 'urgent'},
                    {'title': 'bad', 'not_before': '2026-10-23', 'deadline': '2026-10-22'}):
            self.assertEqual(self.client.post('/api/tasks', json=bad).status_code, 422)
        r = self.client.post('/api/tasks/batch', json={'tasks': [{'title': 'valid'}, {'title': ''}]})
        self.assertEqual(r.status_code, 422)
        self.assertEqual(self.client.get('/api/tasks').json(), [])
        self.assertEqual(self.client.post('/api/tasks/batch', json={'tasks': [{'title': 'A'}, {'title': 'B'}]}).status_code, 201)
        self.assertEqual(self.client.put('/api/preferences', json={'start_time': '18:00', 'end_time': '09:00'}).status_code, 422)
        self.assertEqual(self.client.put('/api/preferences', json={'daily_budget': 60, 'sloth_budget': 90}).status_code, 422)
        self.assertEqual(self.client.post('/api/plan', json={'date': '2026-10-22', 'from_time': '25:00'}).status_code, 422)

    def test_preferences_persist_and_cors(self):
        p = self.client.put('/api/preferences', json={'daily_budget': 100}).json()
        self.assertEqual(p['daily_budget'], 100)
        self.assertEqual(self.client.get('/api/preferences').json()['daily_budget'], 100)
        h = self.client.get('/api/health', headers={'Origin': 'http://localhost:5173'})
        self.assertEqual(h.headers['access-control-allow-origin'], 'http://localhost:5173')
        self.assertNotIn('api_key', h.json())

    def test_fallback_does_not_save_and_uses_client_date(self):
        r = self.client.post('/api/extract', json={'text': 'Reply to emails tomorrow, 15 minutes; Write report today, 1 hour, urgent', 'today': '2026-10-22'})
        self.assertEqual(r.status_code, 200, r.text)
        body = r.json()
        self.assertEqual(body['source'], 'rules')
        self.assertEqual(len(body['tasks']), 2)
        self.assertEqual(body['tasks'][0]['deadline'], '2026-10-23')
        self.assertEqual(body['tasks'][0]['duration'], 15)
        self.assertEqual(body['tasks'][0]['title'], 'Reply to emails')
        self.assertEqual(body['tasks'][1]['duration'], 60)
        self.assertEqual(body['tasks'][1]['priority'], 'high')
        self.assertEqual(body['tasks'][1]['title'], 'Write report')
        self.assertEqual(self.client.get('/api/tasks').json(), [])
        self.assertEqual(self.client.post('/api/extract', json={'text': '   ', 'today': '2026-10-22'}).status_code, 422)

    def provider_transport(self, handler):
        original = httpx.AsyncClient
        return patch('app.extraction.httpx.AsyncClient', side_effect=lambda **kwargs: original(transport=httpx.MockTransport(handler), **kwargs))

    def test_hosted_gemma_request_and_validated_response(self):
        self.settings.api_key = 'test-only-secret'
        self.settings.api_base = 'https://provider.example/v1'
        def handler(request):
            self.assertEqual(str(request.url), 'https://provider.example/v1/chat/completions')
            self.assertEqual(request.headers['authorization'], 'Bearer test-only-secret')
            body = json.loads(request.content)
            self.assertEqual(body['model'], self.settings.model)
            self.assertIn('2026-10-22', body['messages'][0]['content'])
            return httpx.Response(200, json={'choices': [{'message': {'content': '```json\n{"tasks":[{"title":"Book dentist","duration":10,"effort":"low"}]}\n```'}}]})
        with self.provider_transport(handler):
            r = self.client.post('/api/extract', json={'text': 'Book dentist', 'today': '2026-10-22'})
        self.assertEqual(r.json()['source'], 'gemma', r.text)
        self.assertEqual(r.json()['tasks'][0]['title'], 'Book dentist')
        self.assertNotIn('test-only-secret', r.text)

    def test_provider_failures_fallback_or_explicit_503(self):
        self.settings.api_key = 'test-secret'
        handlers = [
            lambda req: httpx.Response(401, json={'error': 'sensitive body'}),
            lambda req: httpx.Response(429),
            lambda req: httpx.Response(503),
            lambda req: httpx.Response(200, json={'choices': [{'message': {'content': '{"tasks":[{"title":"Bad","duration":-5}]}'}}]}),
            lambda req: httpx.Response(200, json={}),
            lambda req: httpx.Response(200, text='not json'),
        ]
        def timeout(req):
            raise httpx.ReadTimeout('secret', request=req)
        handlers.append(timeout)
        for handler in handlers:
            with self.subTest(handler=handler), self.provider_transport(handler):
                r = self.client.post('/api/extract', json={'text': 'Email team', 'today': '2026-10-22'})
                self.assertEqual(r.json()['source'], 'rules', r.text)
                self.assertNotIn('sensitive body', r.text)
                self.assertNotIn('test-secret', r.text)
        self.settings.fallback = False
        with self.provider_transport(handlers[0]):
            r = self.client.post('/api/extract', json={'text': 'Email team', 'today': '2026-10-22'})
        self.assertEqual(r.status_code, 503)
        self.assertIn('manually', r.json()['detail'])


def task(id, **kwargs):
    return dict(TaskCreate(title=id, **kwargs).model_dump(mode='json'), id=id, created_at='2026-10-22T00:00:00')


class SchedulerTests(unittest.TestCase):
    def plan(self, tasks, sloth=False, prefs=None, from_time=None):
        return make_plan(tasks, PlanRequest(date=date(2026, 10, 22), sloth_mode=sloth, from_time=from_time), prefs or Preferences())

    def test_deadlines_completion_and_future_eligibility(self):
        p = self.plan([task('future', not_before=date(2026, 10, 23)), task('done', status='done'),
                       task('later', priority='high'), task('due', deadline=date(2026, 10, 22), priority='low'),
                       task('overdue', deadline=date(2026, 10, 21))])
        ids = [b['task_id'] for b in p['blocks'] if b['kind'] == 'task']
        self.assertEqual(ids, ['overdue', 'due', 'later'])
        self.assertTrue(p['warnings'])

    def test_focus_splitting_breaks_and_no_overlaps(self):
        p = self.plan([task('deep', duration=120), task('short', duration=20)])
        blocks = p['blocks']
        self.assertEqual(p['work_minutes'], 140)
        self.assertEqual(sum(b['kind'] == 'break' for b in blocks), 3)
        self.assertEqual(p['break_minutes'], 30)
        self.assertTrue(all(b['minutes'] <= 50 for b in blocks if b['kind'] == 'task'))
        for a, b in zip(blocks, blocks[1:]):
            self.assertEqual(a['end'], b['start'])
        self.assertEqual(blocks[-1]['kind'], 'task')

    def test_sloth_prefers_easy_wins_but_preserves_urgent(self):
        tasks = [task('hard', effort='high', duration=60), task('easy', effort='low', duration=10),
                 task('urgent', effort='high', duration=30, deadline=date(2026, 10, 22))]
        p = self.plan(tasks, sloth=True)
        ids = list(dict.fromkeys(b['task_id'] for b in p['blocks'] if b['kind'] == 'task'))
        self.assertEqual(ids, ['urgent', 'easy'])
        self.assertLessEqual(p['work_minutes'], 90)
        self.assertTrue(all(b['minutes'] <= 25 for b in p['blocks'] if b['kind'] == 'task'))
        self.assertTrue(all(b['minutes'] >= 15 for b in p['blocks'] if b['kind'] == 'break'))
        self.assertEqual(p['deferred'][0]['task_id'], 'hard')

    def test_overflow_visible_and_urgent_warned(self):
        p = self.plan([task('big', duration=120, deadline=date(2026, 10, 22))], sloth=True)
        self.assertEqual(p['work_minutes'], 0)
        self.assertEqual(len(p['deferred']), 1)
        self.assertTrue(p['warnings'])

    def test_reschedule_respects_clock_and_end_of_day(self):
        p = self.plan([task('late', duration=30)], from_time='17:45')
        self.assertFalse(p['blocks'])
        self.assertEqual(len(p['deferred']), 1)
        p = self.plan([task('fits', duration=15)], from_time='17:45')
        self.assertEqual(p['blocks'][0]['start'], '17:45')
        self.assertEqual(p['blocks'][0]['end'], '18:00')
        self.assertFalse(self.plan([task('late')], from_time='23:00')['blocks'])

    def test_empty_and_repeatable(self):
        self.assertEqual(self.plan([])['blocks'], [])
        tasks = [task('one'), task('two')]
        self.assertEqual(self.plan(tasks)['blocks'], self.plan(tasks)['blocks'])


if __name__ == '__main__':
    unittest.main()
