import { useEffect, useState, useRef } from 'react'
import { studentsApi, reportsApi } from '../api'
import { UserPlus, Search, Trash2, Camera, Upload, CheckCircle, X, Download, Users, LayoutGrid, Edit2 } from 'lucide-react'
import clsx from 'clsx'

const EMPTY_FORM = { name: '', student_id: '', class_name: 'Class A', email: '', phone: '' }

export default function Students() {
  const [tab,         setTab]        = useState('students')
  const [students,    setStudents]   = useState([])
  const [classes,     setClasses]    = useState([])
  const [search,      setSearch]     = useState('')
  const [filter,      setFilter]     = useState('')
  const [loading,     setLoading]    = useState(true)
  const [showForm,    setShowForm]   = useState(false)
  const [editStudent, setEditStudent]= useState(null)
  const [form,        setForm]       = useState(EMPTY_FORM)
  const [saving,      setSaving]     = useState(false)
  const [enrollId,    setEnrollId]   = useState(null)
  const [enrollMsg,   setEnrollMsg]  = useState('')
  const [exporting,   setExporting]  = useState('')
  const fileRef   = useRef()
  const webcamRef = useRef()
  const streamRef = useRef()

  const load = () => {
    setLoading(true)
    Promise.all([studentsApi.list(filter || undefined), studentsApi.classes()])
      .then(([s, c]) => { setStudents(s.data); setClasses(c.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [filter])

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.student_id.toLowerCase().includes(search.toLowerCase())
  )

  const classSummary = classes.map(c => {
    const cs = students.filter(s => s.class_name === c.class_name)
    const enrolled = cs.filter(s => s.enrolled).length
    return { ...c, total: cs.length, enrolled, notEnrolled: cs.length - enrolled }
  })

  // ── Forms ─────────────────────────────────────────────────────────────────
  const openAddForm = () => { setForm(EMPTY_FORM); setEditStudent(null); setShowForm(true) }
  const openEditForm = (s) => {
    setForm({ name: s.name, student_id: s.student_id, class_name: s.class_name, email: s.email || '', phone: s.phone || '' })
    setEditStudent(s); setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditStudent(null); setForm(EMPTY_FORM) }

  const handleSubmit = async () => {
    if (!form.name || !form.student_id || !form.class_name) return
    setSaving(true)
    try {
      if (editStudent) { await studentsApi.update(editStudent.id, form) }
      else             { await studentsApi.create(form) }
      closeForm(); load()
    } catch (e) { alert(e.response?.data?.detail || 'Error saving student') }
    finally { setSaving(false) }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete ${name}?`)) return
    await studentsApi.delete(id); load()
  }

  // ── Exports ───────────────────────────────────────────────────────────────

  // Export all students (header button)
  const handleExportStudents = () => {
    const rows = [['Name','Student ID','Class','Email','Phone','Face Enrolled']]
    filtered.forEach(s => rows.push([s.name, s.student_id, s.class_name, s.email||'', s.phone||'', s.enrolled?'Yes':'No']))
    const csv = rows.map(r => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = 'students_list.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // Export student list per class
  const handleExportClassStudents = (className) => {
    const cs = students.filter(s => s.class_name === className)
    const rows = [['No','Name','Student ID','Email','Phone','Face Enrolled']]
    cs.forEach((s, i) => rows.push([i+1, s.name, s.student_id, s.email||'', s.phone||'', s.enrolled?'Yes':'No']))
    const csv = rows.map(r => r.join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url
    a.download = `students_${className.replace(/\s+/g,'_')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // Export attendance records per class
  const handleExportAttendance = async (className) => {
    setExporting(className)
    try {
      const res = await reportsApi.export({ class_name: className })
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url; a.download = `attendance_${className.replace(/\s+/g,'_')}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch { alert('Export failed') }
    finally { setExporting('') }
  }

  // ── Enroll ────────────────────────────────────────────────────────────────
  const handleFileEnroll = async (file, studentId) => {
    setEnrollMsg('Enrolling...')
    try {
      await studentsApi.enroll(studentId, file)
      setEnrollMsg('✅ Face enrolled!'); load()
    } catch (e) { setEnrollMsg('❌ ' + (e.response?.data?.detail || 'Enrollment failed')) }
    setTimeout(() => { setEnrollId(null); setEnrollMsg('') }, 2000)
  }

  const startWebcamEnroll = async (studentId) => {
    setEnrollId(studentId); setEnrollMsg('Starting camera...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      streamRef.current = stream
      if (webcamRef.current) { webcamRef.current.srcObject = stream; await webcamRef.current.play(); setEnrollMsg('Click "Capture" when ready') }
    } catch { setEnrollMsg('Camera denied') }
  }

  const captureWebcam = () => {
    const video = webcamRef.current; if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    canvas.toBlob(blob => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      handleFileEnroll(new File([blob], 'capture.jpg', { type: 'image/jpeg' }), enrollId)
    }, 'image/jpeg', 0.9)
  }

  const closeEnroll = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    setEnrollId(null); setEnrollMsg('')
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-700 text-text">Students</h1>
          <p className="text-sm text-text-dim mt-0.5">{students.length} students · {classes.length} classes</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportStudents} className="btn-ghost"><Download size={14} /> Export List</button>
          <button onClick={openAddForm} className="btn-primary"><UserPlus size={15} /> Add Student</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1 w-fit">
        <button onClick={() => setTab('students')}
          className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'students' ? 'bg-accent text-white' : 'text-text-dim hover:text-text')}>
          <Users size={14} /> Students
        </button>
        <button onClick={() => setTab('classes')}
          className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
            tab === 'classes' ? 'bg-accent text-white' : 'text-text-dim hover:text-text')}>
          <LayoutGrid size={14} /> Classes
        </button>
      </div>

      {/* ── STUDENTS TAB ── */}
      {tab === 'students' && (
        <>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
              <input className="input pl-9" placeholder="Search by name or ID..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input w-40" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
            </select>
          </div>

          <div className="card p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Student','ID','Class','Contact','Face','Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-text-dim uppercase tracking-wider font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-text-dim text-xs">Loading...</td></tr>}
                {!loading && filtered.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-text-dim text-xs">No students found</td></tr>}
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
                        : <span className="badge-muted">Not enrolled</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEditForm(s)} className="btn-ghost text-xs px-2.5 py-1.5">
                          <Edit2 size={12} /> Edit
                        </button>
                        <button onClick={() => setEnrollId(s.id)} className="btn-ghost text-xs px-2.5 py-1.5">
                          <Camera size={13} /> Enroll
                        </button>
                        <button onClick={() => handleDelete(s.id, s.name)} className="btn-danger text-xs px-2.5 py-1.5">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── CLASSES TAB ── */}
      {tab === 'classes' && (
        <div className="grid grid-cols-1 gap-4">
          {classSummary.length === 0 && (
            <div className="card text-center py-12"><p className="text-text-dim text-sm">No classes found</p></div>
          )}
          {classSummary.map(c => (
            <div key={c.class_name} className="card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent font-display font-700 text-lg">
                    {c.class_name.replace(/[^A-Z0-9]/gi,'').slice(0,2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-base font-display font-600 text-text">{c.class_name}</h2>
                    <p className="text-xs text-text-dim mt-0.5">
                      On-time <span className="text-success font-mono">{c.on_time_by}</span> ·
                      Late <span className="text-warning font-mono">{c.late_by}</span>
                    </p>
                  </div>
                </div>

                {/* ── TWO EXPORT BUTTONS ── */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleExportClassStudents(c.class_name)}
                    className="btn-ghost text-xs px-3 py-2"
                  >
                    <Download size={13} /> Student List
                  </button>
                  <button
                    onClick={() => handleExportAttendance(c.class_name)}
                    disabled={exporting === c.class_name}
                    className="btn-ghost text-xs px-3 py-2"
                  >
                    {exporting === c.class_name
                      ? <><span className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin" /> Exporting...</>
                      : <><Download size={13} /> Attendance</>}
                  </button>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mt-4">
                <div className="bg-bg border border-border rounded-xl px-4 py-3 text-center">
                  <p className="text-2xl font-display font-700 text-text">{c.total}</p>
                  <p className="text-xs text-text-dim mt-0.5">Total Students</p>
                </div>
                <div className="bg-bg border border-success/20 rounded-xl px-4 py-3 text-center">
                  <p className="text-2xl font-display font-700 text-success">{c.enrolled}</p>
                  <p className="text-xs text-text-dim mt-0.5">Face Enrolled</p>
                </div>
                <div className="bg-bg border border-warning/20 rounded-xl px-4 py-3 text-center">
                  <p className="text-2xl font-display font-700 text-warning">{c.notEnrolled}</p>
                  <p className="text-xs text-text-dim mt-0.5">Not Enrolled</p>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-4">
                <div className="flex justify-between text-xs text-text-dim mb-1.5">
                  <span>Face enrollment progress</span>
                  <span className="font-mono">{c.total ? Math.round(c.enrolled/c.total*100) : 0}%</span>
                </div>
                <div className="h-2 rounded-full bg-border overflow-hidden">
                  <div className="h-full rounded-full bg-success transition-all duration-500"
                    style={{ width: `${c.total ? (c.enrolled/c.total)*100 : 0}%` }} />
                </div>
              </div>

              {/* Student chips */}
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-text-dim uppercase tracking-wider font-medium mb-3">Students in this class</p>
                <div className="flex flex-wrap gap-2">
                  {students.filter(s => s.class_name === c.class_name).length === 0 && (
                    <p className="text-xs text-muted">No students yet</p>
                  )}
                  {students.filter(s => s.class_name === c.class_name).map(s => (
                    <div key={s.id} className={clsx(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs',
                      s.enrolled ? 'border-success/20 bg-success/5 text-text' : 'border-border bg-bg text-text-dim'
                    )}>
                      <span className="w-4 h-4 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-600">
                        {s.name.charAt(0)}
                      </span>
                      {s.name}
                      {s.enrolled && <CheckCircle size={10} className="text-success" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ADD / EDIT MODAL ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-md p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-display font-600 text-text">
                {editStudent ? '✏️ Edit Student' : '➕ Add Student'}
              </h2>
              <button onClick={closeForm} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>

            {editStudent && (
              <div className="bg-accent/10 border border-accent/20 rounded-xl px-3 py-2 mb-4 text-xs text-accent">
                Editing: <span className="font-medium">{editStudent.name}</span> · ID: {editStudent.student_id}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="label">Full Name *</label>
                <input className="input" placeholder="e.g. Sokha Chan"
                  value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Student ID *</label>
                  <input
                    className={clsx('input', editStudent && 'opacity-50 cursor-not-allowed')}
                    placeholder="e.g. STU001"
                    value={form.student_id}
                    onChange={e => setForm({...form, student_id: e.target.value})}
                    disabled={!!editStudent}
                  />
                  {editStudent && <p className="text-xs text-text-dim mt-1">ID cannot be changed</p>}
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
                <input className="input" type="email" placeholder="Optional"
                  value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" placeholder="Optional"
                  value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={closeForm} className="btn-ghost flex-1 justify-center">Cancel</button>
              <button onClick={handleSubmit} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Saving...' : editStudent ? '💾 Save Changes' : '➕ Add Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ENROLL MODAL ── */}
      {enrollId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm p-6 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-600 text-text">Enroll Face</h2>
              <button onClick={closeEnroll} className="btn-ghost p-1.5"><X size={16} /></button>
            </div>
            {enrollMsg && <p className="text-xs text-text-dim mb-3 bg-border/40 rounded-lg px-3 py-2">{enrollMsg}</p>}
            <video ref={webcamRef} className="w-full rounded-xl bg-black aspect-video mb-4" muted playsInline />
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => startWebcamEnroll(enrollId)} className="btn-primary justify-center">
                <Camera size={14} /> Use Webcam
              </button>
              <button onClick={() => fileRef.current.click()} className="btn-ghost justify-center">
                <Upload size={14} /> Upload Photo
              </button>
            </div>
            {streamRef.current && (
              <button onClick={captureWebcam} className="btn-primary w-full justify-center mt-3">📸 Capture</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files[0] && handleFileEnroll(e.target.files[0], enrollId)} />
          </div>
        </div>
      )}

    </div>
  )
}