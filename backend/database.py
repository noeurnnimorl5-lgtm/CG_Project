"""
database.py — SQLite database models and queries using SQLAlchemy
"""

import json
from datetime import date, datetime
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Date, DateTime,
    Text, Boolean, ForeignKey, func
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session

DATABASE_URL = "sqlite:///./attendance.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ─── Models ──────────────────────────────────────────────────────────────────

class Student(Base):
    __tablename__ = "students"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(100), nullable=False)
    student_id  = Column(String(50), unique=True, nullable=False)
    class_name  = Column(String(50), nullable=False)
    email       = Column(String(100), nullable=True)
    phone       = Column(String(30), nullable=True)
    photo_path  = Column(String(255), nullable=True)
    # Face embedding stored as JSON array
    embedding   = Column(Text, nullable=True)
    enrolled    = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    records = relationship("AttendanceRecord", back_populates="student")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id          = Column(Integer, primary_key=True, index=True)
    student_id  = Column(Integer, ForeignKey("students.id"), nullable=False)
    date        = Column(Date, default=date.today)
    time_in     = Column(String(10), nullable=True)
    status      = Column(String(20), default="absent")   # on-time | late | absent
    class_name  = Column(String(50), nullable=True)
    confidence  = Column(Float, nullable=True)
    note        = Column(String(255), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    student = relationship("Student", back_populates="records")


class ClassSchedule(Base):
    __tablename__ = "class_schedules"

    id          = Column(Integer, primary_key=True, index=True)
    class_name  = Column(String(50), nullable=False)
    on_time_by  = Column(String(10), default="08:00")   # HH:MM
    late_by     = Column(String(10), default="08:30")
    created_at  = Column(DateTime, default=datetime.utcnow)


# ─── Init ─────────────────────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)
    # Seed default schedule if empty
    db = SessionLocal()
    if db.query(ClassSchedule).count() == 0:
        for cls in ["Class A", "Class B", "Class C"]:
            db.add(ClassSchedule(class_name=cls))
        db.commit()
    db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_student_embedding(student: Student):
    if student.embedding:
        return json.loads(student.embedding)
    return None


def set_student_embedding(db: Session, student_id: int, embedding: list):
    student = db.query(Student).filter(Student.id == student_id).first()
    if student:
        student.embedding = json.dumps(embedding)
        student.enrolled = True
        db.commit()


def is_marked_today(db: Session, student_id: int) -> bool:
    today = date.today()
    return db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == student_id,
        AttendanceRecord.date == today
    ).first() is not None


def get_stats(db: Session):
    today = date.today()
    total_students = db.query(Student).count()
    today_records  = db.query(AttendanceRecord).filter(AttendanceRecord.date == today).all()

    present   = sum(1 for r in today_records if r.status in ("on-time", "late"))
    on_time   = sum(1 for r in today_records if r.status == "on-time")
    late      = sum(1 for r in today_records if r.status == "late")
    absent    = total_students - present

    # Weekly data (last 7 days)
    from datetime import timedelta
    weekly = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        recs = db.query(AttendanceRecord).filter(AttendanceRecord.date == d).all()
        weekly.append({
            "date": str(d),
            "present": sum(1 for r in recs if r.status in ("on-time", "late")),
            "late":    sum(1 for r in recs if r.status == "late"),
            "absent":  total_students - sum(1 for r in recs if r.status in ("on-time", "late"))
        })

    return {
        "total_students": total_students,
        "present_today":  present,
        "on_time_today":  on_time,
        "late_today":     late,
        "absent_today":   absent,
        "attendance_rate": round((present / total_students * 100) if total_students else 0, 1),
        "weekly":         weekly
    }
