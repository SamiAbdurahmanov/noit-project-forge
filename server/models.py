from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base
from sqlalchemy import CheckConstraint


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)

    contexts = relationship("Context", back_populates="user", cascade="all, delete-orphan")


class Context(Base):
    __tablename__ = "contexts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    original_prompt = Column(Text, nullable=False)

    hobby = Column(String, nullable=False)
    level = Column(String, nullable=True)
    goals = Column(Text, nullable=True)       # JSON string: List[str]
    plan = Column(Text, nullable=True)        # JSON string: structured learning plan

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    progress = Column(Integer, default=0, nullable=False)

    user = relationship("User", back_populates="contexts")
    progress_snapshots = relationship("ProgressSnapshot", back_populates="context", cascade="all, delete-orphan")
    plan_version = Column(String, nullable=True)
    __table_args__ = (
        CheckConstraint("progress >= 0 AND progress <= 100", name="progress_range"),
    )


class ProgressSnapshot(Base):
    __tablename__ = "progress_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    context_id = Column(Integer, ForeignKey("contexts.id"), nullable=False)
    progress = Column(Integer, nullable=False)
    snapshot_date = Column(DateTime, default=datetime.now, nullable=False)
    source = Column(String, nullable=False)  # 'manual_update' | 'media_analysis' | 'milestone'

    context = relationship("Context", back_populates="progress_snapshots")


class StepDetail(Base):
    __tablename__ = "step_details"

    id = Column(Integer, primary_key=True, index=True)
    context_id = Column(Integer, ForeignKey("contexts.id", ondelete="CASCADE"))
    phase_title = Column(String, nullable=False)
    step_title = Column(String, nullable=False)

    detailed_schedule = Column(Text, nullable=False)

    plan_version = Column(String, nullable=False)  # version when generated
    created_at = Column(DateTime, default=datetime.utcnow)