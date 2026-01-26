'use client'

import { CircleHelp } from 'lucide-react'

const statsData = [
  { label: 'Total Rows', value: '156' },
  { label: 'Columns', value: '12' },
  { label: 'Date Range', value: 'Jan 2022 - Dec 2024' },
  { label: 'Missing Values', value: '0.2%', status: 'success' },
]

const columnData = [
  { name: 'date', type: 'datetime', nonNull: '156', mean: '-', std: '-', min: '2022-01-01', max: '2024-12-31' },
  { name: 'sales', type: 'float64', nonNull: '156', mean: '$2,847,231', std: '$423,891', min: '$1,892,112', max: '$4,123,456' },
  { name: 'tv_spend', type: 'float64', nonNull: '156', mean: '$156,234', std: '$45,892', min: '$89,234', max: '$287,123' },
  { name: 'digital_spend', type: 'float64', nonNull: '156', mean: '$98,472', std: '$32,156', min: '$45,123', max: '$178,923' },
]

export default function DataExplorationPage() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Data Exploration</h1>
          <span className="text-sm text-foreground-muted">/ Step 2 of 8</span>
        </div>
        <button className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted hover:text-foreground hover:bg-card-hover transition-colors">
          <CircleHelp className="w-4 h-4" />
          <span className="text-sm">Help</span>
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 p-8 overflow-auto">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4">
            {statsData.map((stat) => (
              <div key={stat.label} className="p-5 rounded-xl bg-card border border-border">
                <p className="text-sm text-foreground-muted">{stat.label}</p>
                <p className={`text-2xl font-semibold font-mono mt-1 ${stat.status === 'success' ? 'text-success' : 'text-foreground'}`}>
                  {stat.value}
                </p>
                {stat.status === 'success' && (
                  <span className="text-xs text-success font-medium">Good</span>
                )}
              </div>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-card border border-border">
              <h3 className="font-semibold text-foreground mb-4">Channel Correlation Matrix</h3>
              <div className="h-[280px] bg-background-secondary rounded-lg flex items-center justify-center">
                <span className="text-foreground-muted">Correlation heatmap visualization</span>
              </div>
            </div>
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Sales Over Time</h3>
                <select className="px-3 py-1.5 text-sm bg-background-secondary border border-border rounded-md text-foreground">
                  <option>Weekly</option>
                  <option>Monthly</option>
                </select>
              </div>
              <div className="h-[280px] bg-background-secondary rounded-lg flex items-center justify-center">
                <span className="text-foreground-muted">Time series visualization</span>
              </div>
            </div>
          </div>

          {/* Column Summary Table */}
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Column Summary</h3>
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-background-secondary">
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Column</th>
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Type</th>
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Non-Null</th>
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Mean</th>
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Std Dev</th>
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Min</th>
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {columnData.map((col) => (
                    <tr key={col.name} className="border-t border-border">
                      <td className="px-4 h-11 text-sm text-foreground">{col.name}</td>
                      <td className="px-4 h-11 text-sm text-primary">{col.type}</td>
                      <td className="px-4 h-11 text-sm text-foreground">{col.nonNull}</td>
                      <td className="px-4 h-11 text-sm text-foreground">{col.mean}</td>
                      <td className="px-4 h-11 text-sm text-foreground">{col.std}</td>
                      <td className="px-4 h-11 text-sm text-foreground">{col.min}</td>
                      <td className="px-4 h-11 text-sm text-foreground">{col.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
