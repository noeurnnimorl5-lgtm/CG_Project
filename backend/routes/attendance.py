"""
routes/attendance.py — Attendance marking and retrieval
"""

import json
from datetime import date, datetime, time
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db, Student, AttendanceRecord, ClassSchedule, is_marked_today

router = APIRouter(prefix="/attendance", tags=["attendance"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class ManualAttendance(BaseModel):
    student_id: int
    status: str  # on-time | late | absent
    date: Optional[str] = None
    note: Optional[str] = None


def record_to_dict(r: AttendanceRecord) -> dict:
    return {
        "id": r.id,
        "student_id": r.student_id,
        "student_name": r.student.name if r.student else "Unknown",
        "student_code": r.student.student_id if r.student else "",
        "class_name": r.class_name or (r.student.class_name if r.student else ""),
        "date": str(r.date),
        "time_in": r.time_in,
        "status": r.status,
        "confidence": r.confidence,
        "note": r.note,
    }


def determine_status(time_str: str, schedule: ClassSchedule) -> str:
    if time_str <= schedule.on_time_by:
        return "on-time"
    elif time_str <= schedule.late_by:
        return "late"
    return "late"


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/scan")
async def scan_and_mark(
    file: UploadFile = File(...),
    class_name: str = Form(...),
    db: Session = Depends(get_db)
):
    """Main endpoint: receive webcam frame, detect+recognize face, mark attendance."""
    from detector import recognize_face

    image_bytes = await file.read()

    # Get all enrolled students with embeddings
    enrolled = db.query(Student).filter(Student.enrolled == True).all()
    registered = [
        {"id": s.id, "name": s.name, "embedding": json.loads(s.embedding)}
        for s in enrolled if s.embedding
    ]

    if not registered:
        return {"recognized": False, "message": "No enrolled students found"}

    result = recognize_face(image_bytes, registered)

    if not result:
        return {"recognized": False, "message": "Face not recognized"}

    student = db.query(Student).filter(Student.id == result["id"]).first()
    if not student:
        return {"recognized": False, "message": "Student not found"}

    # Duplicate check
    if is_marked_today(db, student.id):
        return {
            "recognized": True,
            "already_marked": True,
            "student": {"id": student.id, "name": student.name, "class_name": student.class_name},
            "message": f"{student.name} already marked today"
        }

    # Determine status from schedule
    schedule = db.query(ClassSchedule).filter(ClassSchedule.class_name == class_name).first()
    now = datetime.now()
    time_str = now.strftime("%H:%M")
    status = determine_status(time_str, schedule) if schedule else "on-time"

    record = AttendanceRecord(
        student_id=student.id,
        date=date.today(),
        time_in=time_str,
        status=status,
        class_name=class_name,
        confidence=result["confidence"],
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return {
        "recognized": True,
        "already_marked": False,
        "status": status,
        "time_in": time_str,
        "confidence": result["confidence"],
        "student": {"id": student.id, "name": student.name, "class_name": student.class_name},
        "record": record_to_dict(record),
        "message": f"{student.name} marked {status}"
    }


@router.post("/detect-only")
async def detect_only(file: UploadFile = File(...)):
    """Just run YOLO detection, return face boxes (for live preview)."""
    from detector import detect_faces
    image_bytes = await file.read()
    faces = detect_faces(image_bytes)
    return {"faces": faces, "count": len(faces)}


@router.get("")
def get_records(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    class_name: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    q = db.query(AttendanceRecord)
    if date_from:
        q = q.filter(AttendanceRecord.date >= date_from)
    if date_to:
        q = q.filter(AttendanceRecord.date <= date_to)
    if class_name:
        q = q.filter(AttendanceRecord.class_name == class_name)
    if status:
        q = q.filter(AttendanceRecord.status == status)
    records = q.order_by(AttendanceRecord.date.desc(), AttendanceRecord.time_in.desc()).all()
    return [record_to_dict(r) for r in records]


@router.post("/manual")
def mark_manual(data: ManualAttendance, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == data.student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")

    record_date = date.fromisoformat(data.date) if data.date else date.today()
    existing = db.query(AttendanceRecord).filter(
        AttendanceRecord.student_id == data.student_id,
        AttendanceRecord.date == record_date
    ).first()

    if existing:
        existing.status = data.status
        existing.note = data.note
        db.commit()
        return record_to_dict(existing)

    record = AttendanceRecord(
        student_id=data.student_id,
        date=record_date,
        time_in=datetime.now().strftime("%H:%M"),
        status=data.status,
        class_name=student.class_name,
        note=data.note,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record_to_dict(record)


@router.delete("/{record_id}")
def delete_record(record_id: int, db: Session = Depends(get_db)):
    r = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if not r:
        raise HTTPException(404, "Record not found")
    db.delete(r)
    db.commit()
    return {"ok": True}