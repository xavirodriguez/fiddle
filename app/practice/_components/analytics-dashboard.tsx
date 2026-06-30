"use client"

import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import { BarChart3, TrendingUp, Clock, Target, Download } from 'lucide-react'

import { aggregateSessions, type PracticeSession } from '@/lib/domain/analytics'
import { dataExportAdapter } from '@/lib/persistence/export-adapter'

interface AnalyticsDashboardProps {
  readonly sessions: PracticeSession[]
}

export function AnalyticsDashboard({ sessions }: AnalyticsDashboardProps) {
  const report = useMemo(() => aggregateSessions(sessions), [sessions])

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border rounded-lg bg-card">
        <BarChart3 className="w-12 h-12 mb-4 text-muted-foreground opacity-50" />
        <h3 className="text-lg font-medium">No hay datos suficientes</h3>
        <p className="text-sm text-muted-foreground">
          Completa algunas sesiones de práctica para ver tus analíticas.
        </p>
      </div>
    )
  }

  const lineData = report.sessionHistory.map((dp, i) => ({
    session: i + 1,
    accuracy: Math.round(dp.accuracy),
    date: new Date(dp.timestamp).toLocaleDateString(),
  }))

  const noteData = Object.entries(report.noteAccuracy)
    .map(([note, stats]) => ({
      note,
      count: stats.attemptCount,
      accuracy: Math.round(stats.averageAccuracy),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return (
    <div className="grid gap-6 p-6 overflow-y-auto max-h-[80vh]">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Target className="w-4 h-4 text-primary" />}
          label="Precisión Media"
          value={`${Math.round(report.averageAccuracy)}%`}
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-green-500" />}
          label="Total Sesiones"
          value={report.totalSessions}
        />
        <StatCard
          icon={<Clock className="w-4 h-4 text-blue-500" />}
          label="Tiempo Total"
          value={`${Math.round(report.totalDurationSeconds / 60)} min`}
        />
        <div className="flex flex-col justify-center gap-2 p-4 border rounded-lg bg-card">
          <button
            onClick={() => dataExportAdapter.exportToJson(sessions as any)}
            className="flex items-center gap-2 text-xs hover:underline text-muted-foreground"
          >
            <Download className="w-3 h-3" /> Exportar JSON
          </button>
          <button
            onClick={() => dataExportAdapter.exportToCsv(sessions as any)}
            className="flex items-center gap-2 text-xs hover:underline text-muted-foreground"
          >
            <Download className="w-3 h-3" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Accuracy Trend */}
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="mb-6 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Tendencia de Precisión
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="session" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
                itemStyle={{ color: 'hsl(var(--primary))' }}
              />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 4, fill: 'hsl(var(--primary))' }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Note Difficulties */}
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="mb-6 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Notas con mayor dificultad
        </h3>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={noteData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="note" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                 contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))' }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                {noteData.map((_, index) => (
                  <Cell key={`cell-${index}`} opacity={1 - index * 0.15} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  )
}
