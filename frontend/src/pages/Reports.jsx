import { useEffect, useState } from 'react'
import { attendanceApi, reportsApi, studentsApi } from '../api'
import { Download, Filter, Trash2, Search, Calendar, RefreshCw } from 'lucide-react'
import { format, subDays } from 'date-fns'
import clsx from 'clsx'

export default function Reports() {
  const [records,  setRecords]  = useState([])
  const [classes,  setClasses]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [exporting,setExporting] = useState(false)

  const today = format(new Date(), 'yyyy-MM-dd')
  const [filters, setFilters] = useState({
    date_from: today,
    date_to:   today,
    class_name: '',
    status: '',
  })

  const load = () => {
    setLoading(true)
    const params = {}
    if (filters.date_from)  params.date_from  = filters.date_from
    if (filters.date_to)    params.date_to    = filters.date_to
    if (filters.class_name) params.class_name = filters.class_name
    if (filters.status)     params.status     = filters.status

    Promise.all([attendanceApi.list(params), studentsApi.classes()])
      .then(([r, c]) => { setRecords(r.data); setClasses(c.data) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = {}
      if (filters.date_from)  params.date_from  = filters.date_from
      if (filters.date_to)    params.date_to    = filters.date_to
      if (filters.class_name) params.class_name = filters.class_name
      const res = await reportsApi.export(params)
      const url = URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `attendance_${filters.date_from}_${filters.date_to}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this record?')) return
    await attendanceApi.delete(id)
    load()
  }

  const setPreset = (days) => {
    const from = format(subDays(new Date(), days - 1), 'yyyy-MM-dd')
    setFilters(f => ({ ...f, date_from: from, date_to: today }))
  }

  const statusBadge = (s) => {
    if (s === 'on-time') return <span className="badge-success">On Time</span>
    if (s === 'late')    return <span className="badge-warning">Late</span>
    return <span className="badge-danger">Absent</span>
  }

  const stats = {
    total:   records.length,
    onTime:  records.filter(r => r.status === 'on-time').length,
    late:    records.filter(r => r.status === 'late').length,
    absent:  records.filter(r => r.status === 'absent').length,
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-700 text-text">Reports</h1>
          <p className="text-sm text-text-dim mt-0.5">Filter and export attendance records</p>
        </div>
        <button onClick={handleExport} disabled={exporting} className="btn-primary">
          {exporting ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-accent" />
          <span className="text-sm font-display font-600 text-text">Filters</span>
          <div className="flex gap-2 ml-auto">
            {[['Today', 1], ['7 days', 7], ['30 days', 30]].map(([label, days]) => (
              <button
                key={label}
                onClick={() => setPreset(days)}
                className="text-xs px-3 py-1.5 rounded-lg border border-border text-text-dim hover:text-accent hover:border-accent/40 transition-colors"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="label">From</label>
            <input type="date" className="input" value={filters.date_from}
              onChange={e => setFilters(f => ({ ...f, date_from: e.target.value }))} />
          </div>
          <div>
            <label className="label">To</label>
            <input type="date" className="input" value={filters.date_to}
              onChange={e => setFilters(f => ({ ...f, date_to: e.target.value }))} />
          </div>
          <div>
            <label className="label">Class</label>
            <select className="input" value={filters.class_name}
              onChange={e => setFilters(f => ({ ...f, class_name: e.target.value }))}>
              <option value="">All Classes</option>
              {classes.map(c => <option key={c.class_name} value={c.class_name}>{c.class_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" value={filters.status}
              onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
              <option value="">All Status</option>
              <option value="on-time">On Time</option>
              <option value="late">Late</option>
              <option value="absent">Absent</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button onClick={load} className="btn-primary px-6">
            <Search size={14} /> Search
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Records', value: stats.total,   color: 'text-text' },
          { label: 'On Time',       value: stats.onTime,  color: 'text-success' },
          { label: 'Late',          value: stats.late,    color: 'text-warning' },
          { label: 'Absent',        value: stats.absent,  color: 'text-danger' },
        ].map(s => (
          <div key={s.label} className="card py-4 text-center">
            <p className={clsx('text-2xl font-display font-700', s.color)}>{s.value}</p>
            <p className="text-xs text-text-dim mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Date', 'Student', 'Class', 'Time In', 'Status', 'Confidence', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs text-text-dim uppercase tracking-wider font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-text-dim text-xs">Loading...</td></tr>
            )}
            {!loading && records.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-text-dim text-xs">No records found for selected filters</td></tr>
            )}
            {records.map(r => (
              <tr key={r.id} className="border-b border-border hover:bg-border/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-text-dim">{r.date}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-600">
                      {r.student_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-text">{r.student_name}</p>
                      <p className="text-xs text-text-dim font-mono">{r.student_code}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><span className="badge-blue">{r.class_name}</span></td>
                <td className="px-4 py-3 font-mono text-xs text-text">{r.time_in || '—'}</td>
                <td className="px-4 py-3">{statusBadge(r.status)}</td>
                <td className="px-4 py-3 font-mono text-xs text-text-dim">
                  {r.confidence ? `${(r.confidence * 100).toFixed(0)}%` : '—'}
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(r.id)} className="btn-danger text-xs px-2.5 py-1.5">
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
