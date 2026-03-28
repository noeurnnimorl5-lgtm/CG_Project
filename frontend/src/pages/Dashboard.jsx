import { useEffect, useState } from 'react'
import { reportsApi, attendanceApi } from '../api'
import StatCard from '../components/StatCard'
import { Users, UserCheck, Clock, UserX, TrendingUp, Calendar } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend
} from 'recharts'
import { format } from 'date-fns'

const COLORS = ['#10b981', '#f59e0b', '#ef4444']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-xl px-4 py-3 text-xs shadow-xl">
      <p className="font-medium text-text mb-2">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="flex gap-2">
          <span>{p.name}:</span><span className="font-mono font-medium">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      reportsApi.stats(),
      attendanceApi.list({ date_from: format(new Date(), 'yyyy-MM-dd'), date_to: format(new Date(), 'yyyy-MM-dd') }),
      reportsApi.summary(format(new Date(), 'yyyy-MM-dd'))
    ]).then(([s, r, sum]) => {
      setStats(s.data)
      setRecords(r.data.slice(0, 8))
      setSummary(sum.data)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const pieData = stats ? [
    { name: 'On Time', value: stats.on_time_today },
    { name: 'Late',    value: stats.late_today },
    { name: 'Absent',  value: stats.absent_today },
  ] : []

  const weeklyData = stats?.weekly?.map(d => ({
    ...d,
    date: format(new Date(d.date), 'EEE')
  })) || []

  const statusBadge = (s) => {
    if (s === 'on-time') return <span className="badge-success badge">On Time</span>
    if (s === 'late')    return <span className="badge-warning badge">Late</span>
    return <span className="badge-danger badge">Absent</span>
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-700 text-text">Dashboard</h1>
          <p className="text-sm text-text-dim mt-0.5">{format(new Date(), 'EEEE, MMMM d yyyy')}</p>
        </div>
        <div className="flex items-center gap-2 bg-success/10 border border-success/20 rounded-xl px-3 py-2">
          <span className="w-2 h-2 rounded-full bg-success animate-pulse-slow" />
          <span className="text-xs text-success font-medium">System Active</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Students" value={stats?.total_students ?? 0} icon={Users} color="blue" />
        <StatCard label="Present Today"  value={stats?.present_today ?? 0}  icon={UserCheck} color="green" />
        <StatCard label="Late Today"     value={stats?.late_today ?? 0}     icon={Clock} color="yellow" />
        <StatCard label="Absent Today"   value={stats?.absent_today ?? 0}   icon={UserX} color="red" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Weekly Area Chart */}
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-display font-600 text-text">Weekly Overview</h2>
              <p className="text-xs text-text-dim mt-0.5">Last 7 days attendance</p>
            </div>
            <span className="badge-blue">{stats?.attendance_rate ?? 0}% rate</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="gPresent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gLate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2736" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="present" name="Present" stroke="#10b981" fill="url(#gPresent)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="late"    name="Late"    stroke="#f59e0b" fill="url(#gLate)"    strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="card">
          <h2 className="text-sm font-display font-600 text-text mb-1">Today's Split</h2>
          <p className="text-xs text-text-dim mb-4">Attendance breakdown</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                  <span className="text-text-dim">{d.name}</span>
                </div>
                <span className="font-mono text-text">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Class Summary */}
        <div className="card">
          <h2 className="text-sm font-display font-600 text-text mb-4">Class Summary</h2>
          <div className="space-y-3">
            {summary.length === 0 && <p className="text-xs text-text-dim">No data today</p>}
            {summary.map(s => (
              <div key={s.class} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent text-xs font-mono font-600">
                  {s.class.replace(/[^A-Z0-9]/gi, '').slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-text font-medium">{s.class}</span>
                    <span className="text-text-dim font-mono">{s.present}/{s.total}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-border overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${s.total ? (s.present / s.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Records */}
        <div className="card">
          <h2 className="text-sm font-display font-600 text-text mb-4">Recent Activity</h2>
          <div className="space-y-2">
            {records.length === 0 && <p className="text-xs text-text-dim">No records today</p>}
            {records.map(r => (
              <div key={r.id} className="flex items-center gap-3 py-1.5 border-b border-border last:border-0">
                <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent text-xs font-600">
                  {r.student_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-text truncate">{r.student_name}</p>
                  <p className="text-xs text-text-dim">{r.class_name}</p>
                </div>
                <div className="text-right">
                  {statusBadge(r.status)}
                  <p className="text-xs text-text-dim font-mono mt-0.5">{r.time_in}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
