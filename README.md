# 🏫 Smart Attendance System

AI-powered school attendance system using **YOLOv8** for face detection and **InsightFace** for recognition.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📷 Live Face Detection | YOLOv8-face with bounding box overlay |
| 🧠 Face Recognition | InsightFace (512-dim embeddings, cosine similarity) |
| ✅ Auto Attendance | Mark Present / Late / Absent automatically |
| ⏰ Time-based Status | Configurable on-time and late cutoffs per class |
| 📊 Dashboard | Live charts, weekly stats, class summaries |
| 🧑‍🎓 Student Management | Add, edit, delete students |
| 📸 Face Enrollment | Upload photo OR capture live via webcam |
| 📋 Reports | Filter by date/class/status, export CSV |
| 🔄 Auto-Scan Mode | Continuous scanning every 2.5s |

---

## 🛠 Tech Stack

```
Backend:   FastAPI + Python 3.11+
Detection: YOLOv8n-face (Ultralytics)
Recognition: InsightFace buffalo_sc
Database:  SQLite (via SQLAlchemy)
Frontend:  React 18 + Vite + Tailwind CSS
Charts:    Recharts
Icons:     Lucide React
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Webcam

### 1. Clone & Setup
```bash
git clone <your-repo>
cd attendance-system
chmod +x setup.sh
./setup.sh
```

### 2. Start Backend
```bash
cd backend
source venv/bin/activate   # Windows: venv\Scripts\activate
python main.py
```
Backend runs at: http://localhost:8000  
API docs at: http://localhost:8000/docs

### 3. Start Frontend
```bash
cd frontend
npm run dev
```
App runs at: http://localhost:5173

---

## 📖 Usage Guide

### Step 1: Add Students
1. Go to **Students** page
2. Click **Add Student**, fill in name, ID, class
3. Click **Enroll** → upload photo or capture via webcam
4. Student is now ready for recognition

### Step 2: Scan Attendance
1. Go to **Scanner** page
2. Select the class from the dropdown
3. Click **Start Camera**
4. Click **Capture & Mark** OR enable **Auto Mode**
5. System detects face → matches to student → marks attendance

### Step 3: View Reports
1. Go to **Reports** page
2. Filter by date range, class, or status
3. Click **Export CSV** to download

---

## 📁 Project Structure

```
attendance-system/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── database.py          # SQLite models + queries
│   ├── detector.py          # YOLOv8 + InsightFace pipeline
│   ├── requirements.txt
│   └── routes/
│       ├── attendance.py    # /attendance endpoints
│       ├── students.py      # /students endpoints
│       └── reports.py       # /reports endpoints
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── api.js           # Axios API client
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Scanner.jsx
│   │   │   ├── Students.jsx
│   │   │   └── Reports.jsx
│   │   └── components/
│   │       ├── Sidebar.jsx
│   │       └── StatCard.jsx
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── setup.sh
└── README.md
```

---

## ⚙️ Configuration

### Change Time Cutoffs
Edit class schedules via the database (or add a settings page):
```python
# Default: on-time if before 08:00, late if before 08:30
schedule.on_time_by = "08:00"
schedule.late_by    = "08:30"
```

### Recognition Threshold
In `detector.py`, adjust cosine similarity threshold:
```python
# Higher = stricter matching (fewer false positives)
# Lower  = more lenient (fewer missed recognitions)
threshold: float = 0.45  # recommended: 0.40–0.55
```

### CORS Origins
In `main.py`, update allowed origins for production:
```python
allow_origins=["https://your-domain.com"]
```

---

## 🔧 API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/students` | List all students |
| POST | `/students` | Create student |
| POST | `/students/{id}/enroll` | Register face |
| DELETE | `/students/{id}` | Delete student |
| POST | `/attendance/scan` | Detect + recognize + mark |
| POST | `/attendance/detect-only` | YOLO detection only |
| GET | `/attendance` | Get records (filterable) |
| POST | `/attendance/manual` | Manual mark |
| GET | `/reports/stats` | Dashboard statistics |
| GET | `/reports/export` | Download CSV |
| GET | `/reports/summary` | Per-class summary |

Full interactive docs: http://localhost:8000/docs

---

## 🐛 Troubleshooting

**Models downloading slowly on first run?**  
YOLOv8 and InsightFace models auto-download (~100MB total). This only happens once.

**"No face detected" during enrollment?**  
Use a clear, well-lit frontal photo with the face taking up most of the frame.

**Low recognition accuracy?**  
- Ensure enrollment photo is high quality
- Try lowering threshold to `0.40` in `detector.py`
- Enroll multiple photos per student (average the embeddings)

**Camera not working?**  
Ensure browser has camera permission. Chrome/Edge work best.
