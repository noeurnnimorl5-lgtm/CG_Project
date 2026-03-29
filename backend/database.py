"""
database.py — SQLite database models and queries using SQLAlchemy
"""

import json
from datetime import date, datetime, timedelta
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Date, DateTime,
    Text, Boolean, ForeignKey
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session

DATABASE_URL = "sqlite:///./attendance.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class Student(Base):
    __tablename__ = "students"

    id          = Column(Integer, primary_key=True, index=True)
    name        = Column(String(100), nullable=False)
    student_id  = Column(String(50), unique=True, nullable=False)
    class_name  = Column(String(50), nullable=False)
    email       = Column(String(100), nullable=True)
    phone       = Column(String(30), nullable=True)
    photo_path  = Column(String(255), nullable=True)
    embedding   = Column(Text, nullable=True)
    enrolled    = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    # FIXED: Using 'records' to match existing database
    records = relationship("AttendanceRecord", back_populates="student", cascade="all, delete-orphan")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"

    id          = Column(Integer, primary_key=True, index=True)
    student_id  = Column(Integer, ForeignKey("students.id"), nullable=False)
    student_name = Column(String(100), nullable=True)
    date        = Column(Date, default=date.today)
    time_in     = Column(String(10), nullable=True)
    status      = Column(String(20), default="absent")
    class_name  = Column(String(50), nullable=True)
    confidence  = Column(Float, nullable=True)
    note        = Column(String(255), nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    # FIXED: Matches the 'records' relationship above
    student = relationship("Student", back_populates="records")


class ClassSchedule(Base):
    __tablename__ = "class_schedules"

    id          = Column(Integer, primary_key=True, index=True)
    class_name  = Column(String(50), unique=True, nullable=False)
    on_time_by  = Column(String(10), default="08:00")
    late_by     = Column(String(10), default="08:30")
    created_at  = Column(DateTime, default=datetime.utcnow)


def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Add new column if it doesn't exist (for existing databases)
        try:
            from sqlalchemy import text
            db.execute(text("ALTER TABLE attendance_records ADD COLUMN student_name VARCHAR(100)"))
            db.commit()
            print("✅ Added student_name column to existing database")
        except Exception:
            # Column already exists, ignore
            print("student_name column already exists or couldn't be added")
        
        if db.query(ClassSchedule).count() == 0:
            default_schedules = [
                ClassSchedule(class_name="Class A", on_time_by="08:00", late_by="08:30"),
                ClassSchedule(class_name="Class B", on_time_by="16:00", late_by="16:20"),
                ClassSchedule(class_name="Class C", on_time_by="08:00", late_by="08:30"),
            ]
            for schedule in default_schedules:
                db.add(schedule)
            db.commit()
            print("✅ Default class schedules added")
    finally:
        db.close()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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
    today_records = db.query(AttendanceRecord).filter(AttendanceRecord.date == today).all()

    present = sum(1 for r in today_records if r.status in ("on-time", "late"))
    on_time = sum(1 for r in today_records if r.status == "on-time")
    late = sum(1 for r in today_records if r.status == "late")
    absent = total_students - present

    weekly = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        recs = db.query(AttendanceRecord).filter(AttendanceRecord.date == d).all()
        weekly.append({
            "date": str(d),
            "present": sum(1 for r in recs if r.status in ("on-time", "late")),
            "late": sum(1 for r in recs if r.status == "late"),
            "absent": total_students - sum(1 for r in recs if r.status in ("on-time", "late"))
        })

    return {
        "total_students": total_students,
        "present_today": present,
        "on_time_today": on_time,
        "late_today": late,
        "absent_today": absent,
        "attendance_rate": round((present / total_students * 100) if total_students else 0, 1),
        "weekly": weekly
    }