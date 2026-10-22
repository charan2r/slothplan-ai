from datetime import date
from typing import Literal

from pydantic import BaseModel, Field, ConfigDict, field_validator, model_validator

Level = Literal['low', 'medium', 'high']


class TaskDraft(BaseModel):
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=200)
    notes: str = Field(default='', max_length=2000)
    duration: int = Field(default=30, ge=5, le=480)
    priority: Level = 'medium'
    effort: Level = 'medium'
    deadline: date | None = None
    not_before: date | None = None

    @model_validator(mode='after')
    def valid_dates(self):
        if self.deadline and self.not_before and self.not_before > self.deadline:
            raise ValueError('Earliest day must be on or before the deadline.')
        return self


class TaskCreate(TaskDraft):
    status: Literal['todo', 'done'] = 'todo'


class Task(TaskCreate):
    id: str
    created_at: str
    completed_at: str | None = None


class TaskBatch(BaseModel):
    tasks: list[TaskDraft] = Field(min_length=1, max_length=30)


class ExtractRequest(BaseModel):
    text: str = Field(min_length=1, max_length=6000)
    today: date

    @field_validator('text')
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError('Describe at least one task.')
        return value.strip()


class Preferences(BaseModel):
    start_time: str = '09:00'
    end_time: str = '18:00'
    daily_budget: int = Field(default=240, ge=30, le=480)
    sloth_budget: int = Field(default=90, ge=15, le=240)
    focus_minutes: int = Field(default=50, ge=15, le=90)
    break_minutes: int = Field(default=10, ge=5, le=30)

    @field_validator('start_time', 'end_time')
    @classmethod
    def clock(cls, value):
        from datetime import datetime
        parsed = datetime.strptime(value, '%H:%M')
        return parsed.strftime('%H:%M')

    @model_validator(mode='after')
    def order(self):
        if self.end_time <= self.start_time:
            raise ValueError('End time must be after start time; overnight plans are not supported.')
        if self.sloth_budget > self.daily_budget:
            raise ValueError('Sloth budget must not exceed the normal daily budget.')
        return self


class PlanRequest(BaseModel):
    date: date
    sloth_mode: bool = False
    from_time: str | None = None

    @field_validator('from_time')
    @classmethod
    def clock(cls, value):
        return Preferences.clock(value) if value is not None else None
