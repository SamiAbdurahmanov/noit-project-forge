from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import engine, Base, get_db
from models import User, Context,ProgressSnapshot, StepDetail
from contextlib import asynccontextmanager
from auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    get_current_user_from_db,
)
from classifier_openai import (
    classify_user_input,
    update_user_progress,
    generate_learning_plan,
    analyze_media_performance,
    generate_step_details,
)
from schemas import (
    ContextCreate,
    ContextConfirm,
    ContextResponse,
    ContextListItem,
    ContextClassification,
    MediaAnalysisRequest,
    MediaAnalysisResponse,
    LearningPlan,
    StepDetailsRequest,
    StepDetailsResponse,
    ContextAnalytics,
    AnalyticsOverview,
    ProgressSnapshotItem,
    ExpectedTrajectoryPoint,
    ContextOverviewItem,
)
from media_normalize import make_comparison_image
from dto import UserRegister, UserLogin
from fastapi.concurrency import run_in_threadpool
from models import ProgressSnapshot
from datetime import datetime, timedelta
import json
import hashlib
import os

# ─── App lifespan ─────────────────────────────────────────────────────────────
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

# In production, FRONTEND_URL should be your Vercel URL
# Example: https://your-app.vercel.app
#https://noit-project-forge-production.up.railway.app/
app = FastAPI()

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "Connected!"}




# ─── Auth ─────────────────────────────────────────────────────────────────────

@app.post("/auth/register")
async def register_user(user: UserRegister, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user.email))
    if result.scalar_one_or_none():
        raise HTTPException(400, "Email already registered")

    new_user = User(
        email=user.email,
        hashed_password=hash_password(user.password),
    )
    db.add(new_user)
    await db.commit()

    token = create_access_token({"email": new_user.email})
    response = JSONResponse({"message": "User registered successfully"})
    is_production = ENVIRONMENT == "production"
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=60 * 60 * 24 * 7
    )
    return response


@app.post("/auth/login")
async def login_user(user: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user.email))
    db_user = result.scalar_one_or_none()

    if not db_user or not verify_password(user.password, db_user.hashed_password):
        raise HTTPException(401, "Invalid credentials")

    token = create_access_token({"email": db_user.email})
    response = JSONResponse({"login": "success"})
    is_production = ENVIRONMENT == "production"
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=60 * 60 * 24 * 7
    )
    return response


@app.post("/auth/logout")
def logout_alt():
    
    is_production = os.getenv("ENVIRONMENT") == "production"
    
    response = JSONResponse({"message": "Logout successful"})
    response.delete_cookie(
        key="access_token",
        secure=True,  
        samesite="none",
        httponly=True,
        path = "/",
        
    )

    
    return response
@app.get("/protected")
def protected_route(user=Depends(get_current_user)):
    return {"message": f"Welcome {user['email']}!"}


# ─── Context helpers ──────────────────────────────────────────────────────────

def _serialize_context(ctx: Context) -> dict:
    """Serialize a Context ORM object to a plain dict, parsing JSON fields."""
    plan_data = None
    if ctx.plan:
        try:
            plan_data = json.loads(ctx.plan)
        except Exception:
            plan_data = None

    return {
        "id": ctx.id,
        "user_id": ctx.user_id,
        "original_prompt": ctx.original_prompt,
        "hobby": ctx.hobby,
        "level": ctx.level,
        "goals": json.loads(ctx.goals) if ctx.goals else None,
        "plan": plan_data,
        "created_at": ctx.created_at,
        "updated_at": ctx.updated_at,
        "progress": ctx.progress,
    }


# ─── Context endpoints ────────────────────────────────────────────────────────

@app.post("/context/create")
async def create_context_classification(
    data: ContextCreate,
    user=Depends(get_current_user),
):
    """
    Step 1 — Classify the user's raw input and return it for approval.
    No DB write yet.
    """
    user_input = data.user_input.strip()

    classification = await run_in_threadpool(classify_user_input, user_input)

    if isinstance(classification, str):
        try:
            classification = json.loads(classification)
        except json.JSONDecodeError:
            classification = {"ERROR": True}

    if not isinstance(classification, dict) or classification.get("ERROR") or not classification.get("Hobby"):
        raise HTTPException(
            status_code=400,
            detail="Не успяхме да разпознаем контекста. Моля, опишете го по-ясно с повече подробности.",
        )

    return {"original_prompt": user_input, "classification": classification}


@app.post("/context/confirm", response_model=ContextResponse)
async def confirm_and_save_context(
    data: ContextConfirm,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Step 2 — User approves classification. Save context and generate learning plan.
    """
    current_user = await get_current_user_from_db(user, db)

    plan_dict = await run_in_threadpool(
        generate_learning_plan,
        data.hobby,
        data.level,
        data.goals,
    )

    plan_json = None
    if plan_dict and not plan_dict.get("ERROR"):
        plan_json = json.dumps(plan_dict, ensure_ascii=False)
        plan_hash = hashlib.sha256(plan_json.encode()).hexdigest()
        

    goals_json = json.dumps(data.goals, ensure_ascii=False) if data.goals else None

    new_context = Context(
        user_id=current_user.id,
        original_prompt=data.original_prompt,
        hobby=data.hobby,
        level=data.level,
        goals=goals_json,
        plan=plan_json,
        plan_version=plan_hash,
    )

    db.add(new_context)
    await db.commit()
    await db.refresh(new_context)

    return _serialize_context(new_context)


@app.get("/context/my-contexts")
async def get_user_contexts(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return all contexts for the current user (list view — no plan payload)."""
    current_user = await get_current_user_from_db(user, db)
    result = await db.execute(select(Context).where(Context.user_id == current_user.id))
    contexts = result.scalars().all()

    return [
        {
            "id": ctx.id,
            "original_prompt": ctx.original_prompt,
            "hobby": ctx.hobby,
            "level": ctx.level,
            "goals": json.loads(ctx.goals) if ctx.goals else None,
            "created_at": ctx.created_at,
            "updated_at": ctx.updated_at,
            "progress": ctx.progress,
        }
        for ctx in contexts
    ]


@app.delete("/context/{context_id}")
async def delete_context(
    context_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete a context owned by the current user."""
    current_user = await get_current_user_from_db(user, db)
    result = await db.execute(select(Context).where(Context.id == context_id))
    ctx = result.scalar_one_or_none()
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")
    if ctx.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your context")
    await db.delete(ctx)
    await db.commit()
    return {"deleted": True, "id": context_id}


@app.get("/context/{context_id}", response_model=ContextResponse)
async def get_context_by_id(
    context_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a single context with its full plan."""
    result = await db.execute(select(Context).where(Context.id == context_id))
    ctx = result.scalar_one_or_none()
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")

    return _serialize_context(ctx)


@app.post("/context/{context_id}/regenerate-plan", response_model=ContextResponse)
async def regenerate_plan(
    context_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Force-regenerate the learning plan for a context (e.g. after progress update).
    """
    current_user = await get_current_user_from_db(user, db)
    result = await db.execute(select(Context).where(Context.id == context_id))
    ctx = result.scalar_one_or_none()
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")
    if ctx.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your context")

    goals = json.loads(ctx.goals) if ctx.goals else None
    plan_dict = await run_in_threadpool(generate_learning_plan, ctx.hobby, ctx.level, goals)

    if plan_dict and not plan_dict.get("ERROR"):
        ctx.plan = json.dumps(plan_dict, ensure_ascii=False)
        plan_hash = hashlib.sha256(ctx.plan.encode()).hexdigest()
        ctx.plan_version = plan_hash
        await db.commit()
        await db.refresh(ctx)

    return _serialize_context(ctx)


@app.put("/context/{context_id}/update")
async def update_context_progress(
    context_id: int,
    data: ContextConfirm,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Update context progress based on user's text report.
    Regenerates the learning plan when level, goals, or progress change
    meaningfully (every 25% milestone or when level/goals shift).
    """
    result = await db.execute(select(Context).where(Context.id == context_id))
    ctx = result.scalar_one_or_none()
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")

    # Snapshot before update for comparison
    old_level    = ctx.level
    old_goals    = ctx.goals
    old_progress = ctx.progress

    # ── Step 1: update classification via AI ─────────────────────────────────
    classification = await run_in_threadpool(
        update_user_progress,
        data.original_prompt,
        {
            "Hobby":    ctx.hobby,
            "Level":    ctx.level,
            "Goals":    json.loads(ctx.goals) if ctx.goals else None,
            "Progress": ctx.progress,
        },
    )

    ctx.hobby           = classification.get("Hobby", ctx.hobby)
    ctx.level           = classification.get("Level", ctx.level)
    ctx.original_prompt = data.original_prompt
    ctx.progress        = classification.get("Progress", ctx.progress)

    if classification.get("Goals"):
        ctx.goals = json.dumps(classification["Goals"], ensure_ascii=False)

    # ── Insert progress snapshot if changed ──────────────────────────────────
    if ctx.progress != old_progress:
        snapshot = ProgressSnapshot(
            context_id=ctx.id,
            progress=ctx.progress,
            source="manual_update"
        )
        db.add(snapshot)

    # ── Step 2: decide whether the plan needs regenerating ───────────────────
    # Regenerate when:
    #   a) level changed            (e.g. начинаещ → средно)
    #   b) goals changed            (AI added / removed goals)
    #   c) progress crossed a 25%   milestone (0→25, 25→50, 50→75, 75→100)
    def _milestone(p: int) -> int:
        return p // 25  # 0-24→0, 25-49→1, 50-74→2, 75-99→3, 100→4

    level_changed     = old_level != ctx.level
    goals_changed     = old_goals != ctx.goals
    milestone_crossed = _milestone(old_progress) != _milestone(ctx.progress)
    should_regenerate = level_changed or goals_changed or milestone_crossed

    if should_regenerate:
        new_goals_list = json.loads(ctx.goals) if ctx.goals else None
        plan_dict = await run_in_threadpool(
            generate_learning_plan,
            ctx.hobby,
            ctx.level,
            new_goals_list,
        )
        if plan_dict and not plan_dict.get("ERROR"):
            ctx.plan = json.dumps(plan_dict, ensure_ascii=False)
            plan_hash = hashlib.sha256(ctx.plan.encode()).hexdigest()
            ctx.plan_version = plan_hash

    # ── Step 3: persist ───────────────────────────────────────────────────────
    await db.commit()
    await db.refresh(ctx)

    plan_data = None
    if ctx.plan:
        try:
            plan_data = json.loads(ctx.plan)
        except Exception:
            plan_data = None

    return {
        "id":           ctx.id,
        "hobby":        ctx.hobby,
        "level":        ctx.level,
        "goals":        json.loads(ctx.goals) if ctx.goals else None,
        "progress":     ctx.progress,
        "plan":         plan_data,
        "plan_updated": should_regenerate,
        "updated_at":   ctx.updated_at,
    }


@app.post("/context/{context_id}/analyze", response_model=MediaAnalysisResponse)
async def analyze_performance(
    context_id: int,
    data: MediaAnalysisRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Normalise both photos with image_normalizer (CLAHE + denoise + unsharp mask),
    stitch them into a single side-by-side composite, then send to GPT-4o vision
    for structured performance coaching feedback.

    On success the context's progress is incremented by the AI-suggested amount.
    """
    result = await db.execute(select(Context).where(Context.id == context_id))
    ctx = result.scalar_one_or_none()
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")

    # Build normalised composite image (CPU-bound → threadpool)
    try:
        composite_b64, _ = await run_in_threadpool(
            make_comparison_image,
            data.user_image_b64,
            data.reference_image_b64,
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Неуспешна обработка на изображенията: {exc}",
        )

    # Send composite to GPT-4o
    analysis = await run_in_threadpool(
        analyze_media_performance,
        ctx.hobby,
        ctx.level,
        composite_b64,
    )

    if not analysis or analysis.get("ERROR"):
        raise HTTPException(
            status_code=500,
            detail="Анализът не успя. Моля, опитайте отново с по-ясни снимки.",
        )

    # Apply progress increment suggested by the AI
    increment = max(0, min(10, int(analysis.get("progress_increment", 0))))
    if increment > 0:
        ctx.progress = min(100, ctx.progress + increment)
        # Insert progress snapshot
        snapshot = ProgressSnapshot(
            context_id=ctx.id,
            progress=ctx.progress,
            source="media_analysis"
        )
        db.add(snapshot)
        await db.commit()

    return MediaAnalysisResponse(
        overall_score=analysis.get("overall_score", 0),
        summary=analysis.get("summary", ""),
        feedback_items=analysis.get("feedback_items", []),
        next_focus=analysis.get("next_focus", ""),
        progress_increment=increment,
    )


# ─── Analytics Helpers ────────────────────────────────────────────────────────

def _compute_velocity(snapshots: list) -> float:
    """Calculate average progress gain per day from snapshots."""
    if len(snapshots) < 2:
        return 0.0
    sorted_snaps = sorted(snapshots, key=lambda s: s.snapshot_date)
    first, last = sorted_snaps[0], sorted_snaps[-1]
    days = (last.snapshot_date - first.snapshot_date).days
    if days == 0:
        return 0.0
    return (last.progress - first.progress) / days


def _compute_trend(snapshots: list) -> str:
    """Determine if progress is accelerating, steady, or slowing."""
    if len(snapshots) < 3:
        return "недостатъчно данни"
    sorted_snaps = sorted(snapshots, key=lambda s: s.snapshot_date)
    mid = len(sorted_snaps) // 2
    first_half_vel = _compute_velocity(sorted_snaps[:mid+1])
    second_half_vel = _compute_velocity(sorted_snaps[mid:])
    if second_half_vel > first_half_vel * 1.2:
        return "ускорява"
    elif second_half_vel < first_half_vel * 0.8:
        return "забавя"
    return "стабилен"


def _expected_trajectory(level: str | None, start_date: datetime) -> list:
    """Generate expected linear progress trajectory."""
    days_map = {"начинаещ": 90, "средно": 60, "напреднал": 45}
    days_per_100 = days_map.get(level, 90) if level else 90
    trajectory = []
    for day in range(0, days_per_100 + 1, 7):
        expected = min(100, (day / days_per_100) * 100)
        trajectory.append({"day": day, "expected_progress": round(expected, 1)})
    return trajectory


# ─── Step Details Endpoint ────────────────────────────────────────────────────

@app.post("/context/{context_id}/step-details", response_model=StepDetailsResponse)
async def get_step_details(
    context_id: int,
    data: StepDetailsRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user = await get_current_user_from_db(user, db)

    # 🔎 1. Get context
    result = await db.execute(
        select(Context).where(Context.id == context_id)
    )
    ctx = result.scalar_one_or_none()

    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")

    if ctx.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your context")

    # 🔎 2. Check for existing detail FOR THIS PLAN VERSION ONLY
    result = await db.execute(
        select(StepDetail).where(
            StepDetail.context_id == context_id,
            StepDetail.phase_title == data.phase_title,
            StepDetail.step_title == data.step_title,
            StepDetail.plan_version == ctx.plan_version,   # ✅ critical fix
        )
    )
    existing = result.scalar_one_or_none()

    # ✅ 3. If exists → return cached
    if existing:
        return StepDetailsResponse(
            detailed_schedule=existing.detailed_schedule
        )

    # 🔄 4. Generate new schedule
    details = await run_in_threadpool(
        generate_step_details,
        ctx.hobby,
        ctx.level,
        data.phase_title,
        data.step_title,
        data.step_detail,
    )

    if not details or details.get("ERROR"):
        raise HTTPException(status_code=500, detail="Failed to generate details")

    detailed_schedule = details.get("detailed_schedule", "")

    # 💾 5. Insert NEW row (never update old versions)
    new_detail = StepDetail(
        context_id=context_id,
        phase_title=data.phase_title,
        step_title=data.step_title,
        detailed_schedule=detailed_schedule,
        plan_version=ctx.plan_version,  
    )

    db.add(new_detail)
    await db.commit()

    return StepDetailsResponse(
        detailed_schedule=detailed_schedule
    )

# ─── Analytics Endpoints ──────────────────────────────────────────────────────

@app.get("/analytics/context/{context_id}", response_model=ContextAnalytics)
async def get_context_analytics(
    context_id: int,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get progress tracking analytics for a single context."""
    current_user = await get_current_user_from_db(user, db)
    result = await db.execute(select(Context).where(Context.id == context_id))
    ctx = result.scalar_one_or_none()
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not found")
    if ctx.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your context")

    # Fetch snapshots
    snap_result = await db.execute(
        select(ProgressSnapshot)
        .where(ProgressSnapshot.context_id == context_id)
        .order_by(ProgressSnapshot.snapshot_date)
    )
    snapshots = snap_result.scalars().all()

    snapshot_items = [
        ProgressSnapshotItem(
            date=s.snapshot_date,
            progress=s.progress,
            source=s.source,
        )
        for s in snapshots
    ]

    trajectory = _expected_trajectory(ctx.level, ctx.created_at)
    velocity = _compute_velocity(snapshots) if snapshots else 0.0
    days_active = (datetime.now() - ctx.created_at).days
    expected_now = min(100, (days_active / 90) * 100)  # baseline
    ahead = ctx.progress >= expected_now

    return ContextAnalytics(
        context_id=ctx.id,
        hobby=ctx.hobby,
        current_progress=ctx.progress,
        snapshots=snapshot_items,
        expected_trajectory=[
            ExpectedTrajectoryPoint(day=p["day"], expected_progress=p["expected_progress"])
            for p in trajectory
        ],
        performance_summary={
            "ahead_of_schedule": ahead,
            "days_active": days_active,
            "average_daily_gain": round(velocity, 2),
        },
    )


@app.get("/analytics/overview", response_model=AnalyticsOverview)
async def get_analytics_overview(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregate analytics across all contexts for the user."""
    current_user = await get_current_user_from_db(user, db)
    result = await db.execute(select(Context).where(Context.user_id == current_user.id))
    contexts = result.scalars().all()

    overview_items = []
    for ctx in contexts:
        snap_result = await db.execute(
            select(ProgressSnapshot)
            .where(ProgressSnapshot.context_id == ctx.id)
            .order_by(ProgressSnapshot.snapshot_date)
        )
        snapshots = snap_result.scalars().all()
        velocity = _compute_velocity(snapshots) if snapshots else 0.0
        trend = _compute_trend(snapshots) if len(snapshots) >= 3 else "недостатъчно данни"
        overview_items.append(
            ContextOverviewItem(
                id=ctx.id,
                hobby=ctx.hobby,
                progress=ctx.progress,
                velocity=round(velocity, 2),
                trend=trend,
            )
        )

    total = len(overview_items)
    avg_progress = sum(c.progress for c in overview_items) / total if total else 0
    most_improved = max(overview_items, key=lambda c: c.velocity).hobby if overview_items else None
    needs_attention = min(
        (c for c in overview_items if c.trend == "забавя"),
        key=lambda c: c.velocity,
        default=None,
    )

    return AnalyticsOverview(
        contexts=overview_items,
        overall={
            "total_hobbies": total,
            "average_progress": round(avg_progress, 1),
            "most_improved": most_improved,
            "needs_attention": needs_attention.hobby if needs_attention else None,
        },
    )