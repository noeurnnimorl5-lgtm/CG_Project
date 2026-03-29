import { useEffect, useState } from 'react'
import { scheduleApi } from '../api'
import { Clock, Save, Plus, Trash2, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import clsx from 'clsx'

export default function Schedule() {
  const [schedules, setSchedules] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState({})
  const [saved,     setSaved]     = useState({})
  const [errors,    setErrors]    = useState({})
  const [newClass,  setNewClass]  = useState('')
  const [adding,    setAdding]    = useState(false)
  const [showAdd,   setShowAdd]   = useState(false)

  const load = () => {
    setLoading(true)
    scheduleApi.list()
      .then(r => setSchedules(r.data.map(s => ({ ...s, _on: s.on_time_by, _late: s.late_by }))))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleChange = (id, field, value) => {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
    // Clear saved/error state when editing
    setSaved(prev => ({ ...prev, [id]: false }))
    setErrors(prev => ({ ...prev, [id]: '' }))
  }

  const handleSave = async (schedule) => {
    setSaving(prev => ({ ...prev, [schedule.id]: true }))
    setErrors(prev => ({ ...prev, [schedule.id]: '' }))
    try {
      await scheduleApi.update(schedule.id, {
        on_time_by: schedule.on_time_by,
        late_by:    schedule.late_by,
      })
      setSaved(prev => ({ ...prev, [schedule.id]: true }))
      setTimeout(() => setSaved(prev => ({ ...prev, [schedule.id]: false })), 2500)
      load()
    } catch (e) {
      setErrors(prev => ({ ...prev, [schedule.id]: e.response?.data?.detail || 'Save failed' }))
    } finally {
      setSaving(prev => ({ ...prev, [schedule.id]: false }))
    }
  }

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete schedule for "${name}"? Students in this class will use the default time.`)) return
    await scheduleApi.delete(id)
    load()
  }

  const handleAddClass = async () => {
    if (!newClass.trim()) return
    setAdding(true)
    try {
      await scheduleApi.add(newClass.trim())
      setNewClass('')
      setShowAdd(false)
      load()
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to add class')
    } finally {
      setAdding(false)
    }
  }

  const isDirty = (s) => s.on_time_by !== s._on || s.late_by !== s._late

  const timeToMinutes = (t) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }

  const windowMinutes = (s) => {
    const diff = timeToMinutes(s.late_by) - timeToMinutes(s.on_time_by)
    return diff > 0 ? diff : 0
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-700 text-text">Schedule Settings</h1>
          <p className="text-sm text-text-dim mt-0.5">Set custom attendance time cutoffs per class</p>
        </div>
        <button onClick={() => setShowAdd(v => !v)} className="btn-primary">
          <Plus size={15} /> Add Class
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 bg-accent/8 border border-accent/20 rounded-2xl px-4 py-3">
        <Info size={16} className="text-accent mt-0.5 flex-shrink-0" />
        <div className="text-sm text-text-dim leading-relaxed">
          <span className="text-accent font-medium">How it works: </span>
          Students who arrive <span className="text-success font-medium">before On-Time</span> are marked <span className="text-success font-medium">On Time</span>.
          Students who arrive between On-Time and Late cutoff are marked <span className="text-warning font-medium">Late</span>.
          Students who don't appear are marked <span className="text-danger font-medium">Absent</span>.
        </div>
      </div>

      {/* Add Class Form */}
      {showAdd && (
        <div className="card border-accent/30 animate-slide-up">
          <p className="text-sm font-display font-600 text-text mb-3">New Class</p>
          <div className="flex gap-3">
            <input
              className="input flex-1"
              placeholder="e.g. Class D, Grade 10A, Math 101..."
              value={newClass}
              onChange={e => setNewClass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddClass()}
            />
            <button onClick={handleAddClass} disabled={adding || !newClass.trim()} className="btn-primary px-5">
              {adding ? 'Adding...' : 'Add'}
            </button>
            <button onClick={() => { setShowAdd(false); setNewClass('') }} className="btn-ghost px-4">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Schedule Cards */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {schedules.map(s => (
            <div
              key={s.id}
              className={clsx(
                'card transition-all duration-200',
                isDirty(s) ? 'border-accent/40' : 'border-border'
              )}
            >
              <div className="flex items-start gap-6">
                {/* Class Label */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                    <Clock size={20} className="text-accent" />
                  </div>
                </div>

                {/* Class Info + Controls */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className="text-base font-display font-600 text-text">{s.class_name}</h2>
                    {isDirty(s) && (
                      <span className="badge bg-accent/15 text-accent text-xs">Unsaved changes</span>
                    )}
                    {saved[s.id] && (
                      <span className="badge badge-success text-xs flex items-center gap-1">
                        <CheckCircle size={10} /> Saved!
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-4 items-end">
                    {/* On Time By */}
                    <div>
                      <label className="label text-success">✅ On-Time Cutoff</label>
                      <input
                        type="time"
                        className="input font-mono text-success"
                        value={s.on_time_by}
                        onChange={e => handleChange(s.id, 'on_time_by', e.target.value)}
                      />
                      <p className="text-xs text-text-dim mt-1">Arrive before this = On Time</p>
                    </div>

                    {/* Late By */}
                    <div>
                      <label className="label text-warning">⏰ Late Cutoff</label>
                      <input
                        type="time"
                        className="input font-mono text-warning"
                        value={s.late_by}
                        onChange={e => handleChange(s.id, 'late_by', e.target.value)}
                      />
                      <p className="text-xs text-text-dim mt-1">Arrive before this = Late</p>
                    </div>

                    {/* Window Info */}
                    <div className="card bg-bg border-border py-3 text-center">
                      <p className="text-xs text-text-dim mb-1">Grace window</p>
                      <p className="text-xl font-display font-700 text-warning">{windowMinutes(s)} min</p>
                      <p className="text-xs text-text-dim mt-0.5">between cutoffs</p>
                    </div>
                  </div>

                  {/* Visual Timeline */}
                  <div className="mt-4 relative">
                    <div className="flex items-center gap-2 text-xs text-text-dim mb-1">
                      <span>Timeline</span>
                    </div>
                    <div className="flex items-center gap-0 h-7 rounded-xl overflow-hidden border border-border">
                      <div className="flex-1 bg-success/20 flex items-center justify-center text-xs text-success font-medium h-full px-2 min-w-0">
                        <span className="truncate">On Time → {s.on_time_by}</span>
                      </div>
                      <div className="w-px h-full bg-border" />
                      <div className="flex-none bg-warning/20 flex items-center justify-center text-xs text-warning font-medium h-full px-3">
                        Late
                      </div>
                      <div className="w-px h-full bg-border" />
                      <div className="flex-none bg-danger/20 flex items-center justify-center text-xs text-danger font-medium h-full px-3">
                        After {s.late_by}
                      </div>
                    </div>
                  </div>

                  {/* Error */}
                  {errors[s.id] && (
                    <div className="flex items-center gap-2 mt-3 text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2">
                      <AlertTriangle size={12} /> {errors[s.id]}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleSave(s)}
                    disabled={saving[s.id] || !isDirty(s)}
                    className={clsx(
                      'btn px-4 py-2 text-sm border transition-all',
                      isDirty(s)
                        ? 'bg-accent hover:bg-accent-dim text-white border-accent'
                        : 'bg-transparent border-border text-text-dim cursor-not-allowed opacity-50'
                    )}
                  >
                    {saving[s.id]
                      ? <><span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
                      : <><Save size={14} /> Save</>
                    }
                  </button>
                  <button
                    onClick={() => handleDelete(s.id, s.class_name)}
                    className="btn-danger px-4 py-2 text-sm justify-center"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {schedules.length === 0 && (
            <div className="card text-center py-12">
              <Clock size={32} className="text-muted mx-auto mb-3" />
              <p className="text-text-dim text-sm">No class schedules yet</p>
              <button onClick={() => setShowAdd(true)} className="btn-primary mt-4 mx-auto">
                <Plus size={14} /> Add First Class
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}