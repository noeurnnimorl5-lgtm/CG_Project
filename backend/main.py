"""
main.py — FastAPI Application Entry Point
Smart Attendance System with YOLOv8 + InsightFace
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from database import init_db
from routes.students import router as students_router
from routes.attendance import router as attendance_router
from routes.reports import router as reports_router

# ─── App ─────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Smart Attendance System",
    description="YOLOv8 + InsightFace powered school attendance",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static file serving (student photos)
os.makedirs("uploads/students", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ─── Routes ──────────────────────────────────────────────────────────────────

app.include_router(students_router)
app.include_router(attendance_router)
app.include_router(reports_router)


@app.get("/")
def root():
    return {"message": "Smart Attendance API", "status": "running", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}


# ─── Startup ─────────────────────────────────────────────────────────────────

@app.on_event("startup")
def on_startup():
    init_db()
    print("✅ Database initialized")
    print("📡 API running at http://localhost:8000")
    print("📖 Docs at http://localhost:8000/docs")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
