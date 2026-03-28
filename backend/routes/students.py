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
        "photo_path": s.photo_path,
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
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(s, k, v)
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
    """Register a student's face from uploaded photo or webcam capture."""
    s = db.query(Student).filter(Student.id == student_id).first()
    if not s:
        raise HTTPException(404, "Student not found")

    image_bytes = await file.read()

    # Save photo
    photo_path = f"{UPLOAD_DIR}/{student_id}_{file.filename}"
    with open(photo_path, "wb") as f:
        f.write(image_bytes)
    s.photo_path = photo_path
    db.commit()

    # Extract embedding
    embedding = extract_embedding(image_bytes)
    if not embedding:
        raise HTTPException(422, "No face detected in the image. Please use a clear frontal photo.")

    set_student_embedding(db, student_id, embedding)
    return {"ok": True, "message": "Face enrolled successfully", "student": student_to_dict(s)}


@router.get("/classes/list")
def list_classes(db: Session = Depends(get_db)):
    from database import ClassSchedule
    classes = db.query(ClassSchedule).all()
    return [{"id": c.id, "class_name": c.class_name, "on_time_by": c.on_time_by, "late_by": c.late_by} for c in classes]
