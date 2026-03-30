"""
routes/students.py — Student management endpoints
"""

import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
import json

from database import get_db, Student, set_student_embedding
from detector import extract_embedding

router = APIRouter(prefix="/students", tags=["students"])
UPLOAD_DIR = "uploads/students"
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─── Schemas ──────────────────────────────────────────────────────────────────

class StudentCreate(BaseModel):
    name: str
    student_id: str
    class_name: str
    email: Optional[str] = None
    phone: Optional[str] = None


class StudentUpdate(BaseModel):
    name: Optional[str] = None
    class_name: Optional[str] = None  
    email: Optional[str] = None
    phone: Optional[str] = None


def student_to_dict(s: Student) -> dict:
    return {
        "id": s.id,
        "name": s.name,
        "student_id": s.student_id,
        "class_name": s.class_name,
        "email": s.email,
        "phone": s.phone,
        "enrolled": s.enrolled,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("")
def list_students(class_name: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Student)
    if class_name:
        q = q.filter(Student.class_name == class_name)
    return [student_to_dict(s) for s in q.order_by(Student.name).all()]


@router.post("")
def create_student(data: StudentCreate, db: Session = Depends(get_db)):
    if db.query(Student).filter(Student.student_id == data.student_id).first():
        raise HTTPException(400, "Student ID already exists")
    student = Student(**data.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)
    return student_to_dict(student)


@router.get("/{student_id}")
def get_student(student_id: int, db: Session = Depends(get_db)):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")
    return student_to_dict(s)


@router.put("/{student_id}")
def update_student(student_id: int, data: StudentUpdate, db: Session = Depends(get_db)):
    from database import AttendanceRecord
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")

    old_class = s.class_name

    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    db.commit()

    # ✅ If class changed, update all attendance records too
    if data.class_name and data.class_name != old_class:
        db.query(AttendanceRecord)\
          .filter(AttendanceRecord.student_id == student_id)\
          .update({"class_name": data.class_name})
        db.commit()

    return student_to_dict(s)


@router.delete("/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")
    db.delete(s)
    db.commit()
    return {"ok": True}

@router.post("/{student_id}/enroll")
async def enroll_student(
    student_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")

    # Read image into memory only — never save to disk
    image_bytes = await file.read()

    # Extract embedding first
    embedding = extract_embedding(image_bytes)
    if not embedding:
        raise HTTPException(422, "No face detected. Please use a clear frontal photo.")

    # Delete old photo if exists
    if s.photo_path and os.path.exists(s.photo_path):
        os.remove(s.photo_path)

    # Save ONLY the embedding — no photo stored
    s.photo_path = None
    db.commit()
    set_student_embedding(db, student_id, embedding)

    return {"ok": True, "message": "Face enrolled — image deleted for privacy"}


@router.get("/classes/list")
def list_classes(db: Session = Depends(get_db)):
    from database import ClassSchedule
    classes = db.query(ClassSchedule).all()
    return [{"id": c.id, "class_name": c.class_name, "on_time_by": c.on_time_by, "late_by": c.late_by} for c in classes]




# ── Schedule Management ───────────────────────────────────────────────────────

class ScheduleUpdate(BaseModel):
    on_time_by: str   # e.g. "08:00"
    late_by: str      # e.g. "08:30"

@router.get("/schedules/all")
def get_all_schedules(db: Session = Depends(get_db)):
    from database import ClassSchedule
    schedules = db.query(ClassSchedule).all()
    return [
        {
            "id": s.id,
            "class_name": s.class_name,
            "on_time_by": s.on_time_by,
            "late_by": s.late_by
        }
        for s in schedules
    ]

@router.put("/schedules/{schedule_id}")
def update_schedule(schedule_id: int, data: ScheduleUpdate, db: Session = Depends(get_db)):
    from database import ClassSchedule
    s = db.query(ClassSchedule).filter(ClassSchedule.id == schedule_id).first()
    if not s:
        raise HTTPException(404, "Schedule not found")
    # Validate time format HH:MM
    import re
    pattern = r"^([01]\d|2[0-3]):[0-5]\d$"
    if not re.match(pattern, data.on_time_by) or not re.match(pattern, data.late_by):
        raise HTTPException(400, "Invalid time format. Use HH:MM (e.g. 08:00)")
    if data.on_time_by >= data.late_by:
        raise HTTPException(400, "On-time cutoff must be before late cutoff")
    s.on_time_by = data.on_time_by
    s.late_by    = data.late_by
    db.commit()
    return {"ok": True, "class_name": s.class_name, "on_time_by": s.on_time_by, "late_by": s.late_by}

@router.post("/schedules")
def add_schedule(class_name: str, db: Session = Depends(get_db)):
    from database import ClassSchedule
    existing = db.query(ClassSchedule).filter(ClassSchedule.class_name == class_name).first()
    if existing:
        raise HTTPException(400, "Class already exists")
    s = ClassSchedule(class_name=class_name)
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "class_name": s.class_name, "on_time_by": s.on_time_by, "late_by": s.late_by}

@router.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    from database import ClassSchedule
    s = db.query(ClassSchedule).filter(ClassSchedule.id == schedule_id).first()
    if not s:
        raise HTTPException(404, "Schedule not found")
    db.delete(s)
    db.commit()
    return {"ok": True}