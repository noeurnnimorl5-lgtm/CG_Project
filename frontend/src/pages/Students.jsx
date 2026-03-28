import { useEffect, useState, useRef } from 'react'
import { studentsApi } from '../api'
import { UserPlus, Search, Trash2, Camera, Upload, CheckCircle, X, Edit2, ChevronDown } from 'lucide-react'
import clsx from 'clsx'

const EMPTY_FORM = { name: '', student_id: '', class_name: 'Class A', email: '', phone: '' }

export default function Students() {
  const [students, setStudents]     = useState([])
  const [classes,  setClasses]      = useState([])
  const [search,   setSearch]       = useState('')
  const [filter,   setFilter]       = useState('')
  const [loading,  setLoading]      = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [form,     setForm]         = useState(EMPTY_FORM)
  const [saving,   setSaving]       = useState(false)
  const [enrollId, setEnrollId]     = useState(null)
  const [enrollMsg,setEnrollMsg]    = useState('')
  const fileRef   = useRef()
  const webcamRef = useRef()
  const streamRef = useRef()

  const load = () => {
    setLoading(true)
    Promise.all([studentsApi.list(filter || undefined), studentsApi.classes()])
      .then(([s, c]) => {
        setStudents(s.data)
        setClasses(c.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id.toLowerCase().includes(search.toLowerCase())
  )

  const handleSubmit = async () => {
    if (!form.name || !form.student_id || !form.class_name) return
    setSaving(true)
    try {
      await studentsApi.create(form)
      setShowForm(false)
      setForm(EMPTY_FORM)
      load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Error saving student')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return
    await studentsApi.delete(id)
    load()
  }

  // Enroll via file upload
  const handleFileEnroll = async (file, studentId) => {
    setEnrollMsg('Enrolling...')
    try {
      await studentsApi.enroll(studentId, file)
      setEnrollMsg('✅ Face enrolled!')
      load()
    } catch (e) {
      setEnrollMsg('❌ ' + (e.response?.data?.detail || 'Enrollment failed'))
    }
    setTimeout(() => { setEnrollId(null); setEnrollMsg('') }, 2000)
  }

  // Enroll via webcam capture
  const startWebcamEnroll = async (studentId) => {
    setEnrollId(studentId)
    setEnrollMsg('Starting camera...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      if (webcamRef.current) {
        webcamRef.current.srcObject = stream
        await webcamRef.current.play()
        setEnrollMsg('Click "Capture" when ready')
      }
    } catch { setEnrollMsg('Camera denied') }
  }

  const captureWebcam = () => {
    const video = webcamRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      handleFileEnroll(new File([blob], 'capture.jpg', { type: 'image/jpeg' }), enrollId)
    }, 'image/jpeg', 0.9)
  }

  const closeEnroll = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    setEnrollId(null)
    setEnrollMsg('')
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-700 text-text">Students</h1>
          <p className="text-sm text-text-dim mt-0.5">{students.length} students registered</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <UserPlus size={15} /> Add Student
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            className="input pl-9"
            placeholder="Search by name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-40" value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Student', 'ID', 'Class', 'Contact', 'Face', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-text-dim uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-dim text-xs">Loading...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-text-dim text-xs">No students found</td></tr>
            )}
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-border hover:bg-border/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-600">
                      {s.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-text">{s.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-text-dim text-xs">{s.student_id}</td>
                <td className="px-4 py-3"><span className="badge-blue">{s.class_name}</span></td>
                <td className="px-4 py-3 text-xs text-text-dim">{s.email || '—'}</td>
                <td className="px-4 py-3">
                  {s.enrolled
                    ? <span className="badge-success"><CheckCircle size={10} className="mr-1" />Enrolled</span>
                    : <span className="badge-muted">Not enrolled</span>
                  }
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEnrollId(s.id)}
                      className="btn-ghost text-xs px-2.5 py-1.5"
                      title="Enroll face"
                    >
                      <Camera size={13} /> Enroll
                    </button>
                    <button
                      onClick={() => handleDelete(s.id, s.name)}
                      className="btn-danger text-xs px-2.5 py-1.5"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Student Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-display font-600 text-text">Add Student</h2>
              <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }} className="btn-ghost p-1.5">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" placeholder="e.g. Sokha Chan" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Student ID *</label>
                  <input className="input" placeholder="e.g. STU001" value={form.student_id} onChange={e => setForm({...form, student_id: e.target.value})} />
                </div>
                <div>
                  <label className="label">Class *</label>
                  <select className="input" value={form.class_name} onChange={e => setForm({...form, class_name: e.target.value})}>
                    {classes.length
                      ? classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)
                      : ['Class A','Class B','Class C'].map(c => <option key={c} value={c}>{c}</option>)
                    }
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="Optional" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" placeholder="Optional" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Saving...' : 'Add Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Face Modal */}
      {enrollId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-600 text-text">Enroll Face</h2>
              <button onClick={closeEnroll} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            {enrollMsg && (
              <p className="text-xs text-text-dim mb-3 bg-border/40 rounded-lg px-3 py-2">{enrollMsg}</p>
            )}
            {/* Webcam preview */}
            <video ref={webcamRef} className="w-full rounded-xl bg-black aspect-video mb-4" muted playsInline />
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => startWebcamEnroll(enrollId)}
                className="btn-primary justify-center"
              >
                <Camera size={14} /> Use Webcam
              </button>
              <button
                onClick={() => fileRef.current.click()}
                className="btn-ghost justify-center"
              >
                <Upload size={14} /> Upload Photo
              </button>
            </div>
            {streamRef.current && (
              <button onClick={captureWebcam} className="btn-primary w-full justify-center mt-3">
                📸 Capture
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => e.target.files[0] && handleFileEnroll(e.target.files[0], enrollId)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
