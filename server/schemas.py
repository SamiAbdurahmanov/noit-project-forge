from pydantic import BaseModel, validator
from typing import List, Optional
from datetime import datetime


# ─── Context creation ───────────────────────────────────────────────────────

class ContextCreate(BaseModel):
    user_input: str


class ContextClassification(BaseModel):
    Hobby: Optional[str] = None
    Level: Optional[str] = None
    Goals: Optional[List[str]] = None
    ERROR: Optional[bool] = None


class ContextConfirm(BaseModel):
    original_prompt: str
    hobby: str
    level: Optional[str] = None
    goals: Optional[List[str]] = None

    @validator("hobby")
    def hobby_must_not_be_empty(cls, v):
        if not v or not v.strip():
            raise ValueError("Хобито не може да бъде празно")
        return v.strip()

    @validator("level")
    def level_optional_strip(cls, v):
        if v:
            return v.strip()
        return v

    @validator("goals")
    def goals_optional_clean(cls, v):
        if v:
            return [g.strip() for g in v if g and g.strip()]
        return v


# ─── Plan ────────────────────────────────────────────────────────────────────

class PlanStep(BaseModel):
    title: str
    detail: str
    expandable: bool = True
    day_by_day_preview: Optional[str] = None


class PlanPhase(BaseModel):
    id: int
    phase: str
    title: str
    duration: str
    icon: str
    status: str          # "completed" | "current" | "upcoming"
    steps: List[PlanStep]


class PlanTip(BaseModel):
    icon: str
    text: str


class LearningPlan(BaseModel):
    title: str
    description: str
    phases: List[PlanPhase]
    tips: List[PlanTip]


# ─── Responses ───────────────────────────────────────────────────────────────

class ContextResponse(BaseModel):
    id: int
    user_id: int
    original_prompt: str
    hobby: str
    level: Optional[str]
    goals: Optional[List[str]]
    plan: Optional[LearningPlan]
    created_at: datetime
    updated_at: datetime
    progress: int = 0

    class Config:
        from_attributes = True


class ContextListItem(BaseModel):
    id: int
    original_prompt: str
    hobby: str
    level: Optional[str]
    goals: Optional[List[str]]
    created_at: datetime
    updated_at: datetime
    progress: int = 0

    class Config:
        from_attributes = True


# ─── Media analysis — images only ────────────────────────────────────────────

class MediaAnalysisRequest(BaseModel):
    """
    Both fields are base64-encoded JPEG/PNG photos.
    The backend normalises them via image_normalizer before passing to GPT-4o.
    """
    user_image_b64: str       # student's photo
    reference_image_b64: str  # reference / comparison photo


class AnalysisFeedbackItem(BaseModel):
    category: str     # e.g. "Позиция на ръцете"
    score: int        # 0-100
    feedback: str
    suggestion: str


class MediaAnalysisResponse(BaseModel):
    overall_score: int
    summary: str
    feedback_items: List[AnalysisFeedbackItem]
    next_focus: str
    progress_increment: int   # how many progress points were added (0-10)


# ─── Step expansion ───────────────────────────────────────────────────────────

class StepDetailsRequest(BaseModel):
    phase_title: str
    step_title: str
    step_detail: str


class StepDetailsResponse(BaseModel):
    detailed_schedule: str


# ─── Analytics ────────────────────────────────────────────────────────────────

class ProgressSnapshotItem(BaseModel):
    date: datetime
    progress: int
    source: str


class ExpectedTrajectoryPoint(BaseModel):
    day: int
    expected_progress: float


class ContextAnalytics(BaseModel):
    context_id: int
    hobby: str
    current_progress: int
    snapshots: List[ProgressSnapshotItem]
    expected_trajectory: List[ExpectedTrajectoryPoint]
    performance_summary: dict


class ContextOverviewItem(BaseModel):
    id: int
    hobby: str
    progress: int
    velocity: float
    trend: str


class AnalyticsOverview(BaseModel):
    contexts: List[ContextOverviewItem]
    overall: dict