"""
routes/reports.py — Attendance report generation and CSV export
"""

import io
import csv
from datetime import date, timedelta
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional

from database import get_db, AttendanceRecord, Student, get_stats

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/stats")
def dashboard_stats(db: Session = Depends(get_db)):
    return get_stats(db)


@router.get("/export")
def export_csv(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    class_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Export attendance records as CSV."""
    q = db.query(AttendanceRecord)
    if date_from:
        q = q.filter(AttendanceRecord.date >= date_from)
    if date_to:
        q = q.filter(AttendanceRecord.date <= date_to)
    if class_name:
        q = q.filter(AttendanceRecord.class_name == class_name)

    records = q.order_by(AttendanceRecord.date.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Student Name", "Student ID", "Class", "Time In", "Status", "Confidence", "Note"])
    for r in records:
        writer.writerow([
            str(r.date),
            r.student.name if r.student else "",
            r.student.student_id if r.student else "",
            r.class_name or "",
            r.time_in or "",
            r.status,
            f"{r.confidence:.2f}" if r.confidence else "",
            r.note or "",
        ])

    output.seek(0)
    filename = f"attendance_{date_from or 'all'}_{date_to or 'all'}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/summary")
def class_summary(
    target_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Per-class attendance summary for a given date."""
    d = date.fromisoformat(target_date) if target_date else date.today()
    students = db.query(Student).all()
    records = db.query(AttendanceRecord).filter(AttendanceRecord.date == d).all()
    record_map = {r.student_id: r for r in records}

    classes = {}
    for s in students:
        cls = s.class_name
        if cls not in classes:
            classes[cls] = {"class": cls, "total": 0, "present": 0, "late": 0, "absent": 0}
        classes[cls]["total"] += 1
        r = record_map.get(s.id)
        if r:
            if r.status == "on-time":
                classes[cls]["present"] += 1
            elif r.status == "late":
                classes[cls]["late"] += 1
                classes[cls]["present"] += 1
            else:
                classes[cls]["absent"] += 1
        else:
            classes[cls]["absent"] += 1

    return list(classes.values())
