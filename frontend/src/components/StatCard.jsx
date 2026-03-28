import clsx from 'clsx'

export default function StatCard({ label, value, sub, icon: Icon, color = 'blue', trend }) {
  const colors = {
    blue:    'text-accent bg-accent/10 border-accent/20',
    green:   'text-success bg-success/10 border-success/20',
    yellow:  'text-warning bg-warning/10 border-warning/20',
    red:     'text-danger bg-danger/10 border-danger/20',
  }
  const textColors = {
    blue: 'text-accent', green: 'text-success', yellow: 'text-warning', red: 'text-danger'
  }
  return (
    <div className="card flex items-start gap-4 animate-slide-up">
      {Icon && (
        <div className={clsx('w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0', colors[color])}>
          <Icon size={18} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-text-dim uppercase tracking-wider font-medium">{label}</p>
        <p className={clsx('text-2xl font-display font-700 mt-0.5', textColors[color])}>{value}</p>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>
      {trend !== undefined && (
        <span className={clsx('text-xs font-mono mt-1', trend >= 0 ? 'text-success' : 'text-danger')}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
  )
}
