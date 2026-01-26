'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleHelp, AlertCircle, ArrowRight } from 'lucide-react'
import { useAppState } from '@/lib/store'
import { getExplorationData } from '@/lib/api'

interface ColumnStats {
  dtype: string
  non_null: number
  null_count: number
  mean?: number
  std?: number
  min?: number | string
  max?: number | string
}

interface ExplorationData {
  summary: {
    rows: number
    columns: number
    date_range: { start: string; end: string }
    missing_pct: number
  }
  column_stats: Record<string, ColumnStats>
  correlations: Record<string, Record<string, number>>
  time_series: { date: string; value: number }[]
}

export default function DataExplorationPage() {
  const router = useRouter()
  const { data, setCurrentStep } = useAppState()
  const [explorationData, setExplorationData] = useState<ExplorationData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (data) {
      loadExplorationData()
    }
  }, [data])

  const loadExplorationData = async () => {
    setIsLoading(true)
    setError(null)

    const result = await getExplorationData()

    if (result.success && result.data) {
      setExplorationData(result.data as ExplorationData)
    } else {
      setError(result.error || 'Failed to load exploration data')
    }

    setIsLoading(false)
  }

  const handleContinue = () => {
    setCurrentStep(3)
    router.push('/mapping')
  }

  if (!data) {
    return (
      <div className="flex flex-col h-screen">
        <header className="h-16 flex items-center px-8 border-b border-border shrink-0">
          <h1 className="text-xl font-semibold text-foreground">Data Exploration</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-foreground-muted mx-auto" />
            <p className="text-foreground-muted">Please upload data first</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-primary text-white rounded-lg"
            >
              Go to Upload
            </button>
          </div>
        </div>
      </div>
    )
  }

  const formatValue = (value: number | string | undefined) => {
    if (value === undefined || value === null) return '-'
    if (typeof value === 'number') {
      if (Math.abs(value) >= 1000000) {
        return `$${(value / 1000000).toFixed(2)}M`
      }
      if (Math.abs(value) >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`
      }
      return value.toFixed(2)
    }
    return String(value)
  }

  const statsData = explorationData ? [
    { label: 'Total Rows', value: explorationData.summary.rows.toLocaleString() },
    { label: 'Columns', value: explorationData.summary.columns.toString() },
    {
      label: 'Date Range',
      value: explorationData.summary.date_range
        ? `${explorationData.summary.date_range.start} - ${explorationData.summary.date_range.end}`
        : '-'
    },
    {
      label: 'Missing Values',
      value: `${explorationData.summary.missing_pct.toFixed(1)}%`,
      status: explorationData.summary.missing_pct < 5 ? 'success' : 'warning'
    },
  ] : []

  const columnData = explorationData
    ? Object.entries(explorationData.column_stats).slice(0, 10).map(([name, stats]) => ({
        name,
        type: stats.dtype,
        nonNull: stats.non_null.toString(),
        mean: formatValue(stats.mean),
        std: formatValue(stats.std),
        min: formatValue(stats.min),
        max: formatValue(stats.max),
      }))
    : []

  // Get correlation data for heatmap display
  const correlationChannels = explorationData?.correlations
    ? Object.keys(explorationData.correlations)
    : []

  return (
    <div className="flex flex-col h-screen">
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

      <div className="flex-1 p-8 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-foreground-muted">Analyzing data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-error/10 border border-error text-error text-sm">
            {error}
          </div>
        ) : explorationData ? (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              {statsData.map((stat) => (
                <div key={stat.label} className="p-5 rounded-xl bg-card border border-border">
                  <p className="text-sm text-foreground-muted">{stat.label}</p>
                  <p className={`text-2xl font-semibold font-mono mt-1 ${stat.status === 'success' ? 'text-success' : stat.status === 'warning' ? 'text-warning' : 'text-foreground'}`}>
                    {stat.value}
                  </p>
                  {stat.status === 'success' && (
                    <span className="text-xs text-success font-medium">Good</span>
                  )}
                  {stat.status === 'warning' && (
                    <span className="text-xs text-warning font-medium">Check data quality</span>
                  )}
                </div>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-2 gap-6">
              <div className="p-5 rounded-xl bg-card border border-border">
                <h3 className="font-semibold text-foreground mb-4">Channel Correlation Matrix</h3>
                <div className="h-[280px] overflow-auto">
                  {correlationChannels.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="p-1"></th>
                          {correlationChannels.map(ch => (
                            <th key={ch} className="p-1 text-foreground-muted font-medium truncate max-w-[80px]" title={ch}>
                              {ch.slice(0, 8)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {correlationChannels.map(row => (
                          <tr key={row}>
                            <td className="p-1 text-foreground-muted font-medium truncate max-w-[80px]" title={row}>
                              {row.slice(0, 8)}
                            </td>
                            {correlationChannels.map(col => {
                              const value = explorationData.correlations[row]?.[col] ?? 0
                              const intensity = Math.abs(value)
                              const color = value > 0
                                ? `rgba(34, 197, 94, ${intensity})`
                                : `rgba(239, 68, 68, ${intensity})`
                              return (
                                <td
                                  key={col}
                                  className="p-1 text-center"
                                  style={{ backgroundColor: color }}
                                  title={`${row} vs ${col}: ${value.toFixed(2)}`}
                                >
                                  {value.toFixed(2)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-full flex items-center justify-center text-foreground-muted">
                      No correlation data available
                    </div>
                  )}
                </div>
              </div>
              <div className="p-5 rounded-xl bg-card border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Sales Over Time</h3>
                </div>
                <div className="h-[280px]">
                  {explorationData.time_series && explorationData.time_series.length > 0 ? (
                    <div className="h-full flex flex-col">
                      <div className="flex-1 flex items-end gap-[2px]">
                        {explorationData.time_series.slice(-50).map((point, i) => {
                          const maxValue = Math.max(...explorationData.time_series.map(p => p.value))
                          const height = (point.value / maxValue) * 100
                          return (
                            <div
                              key={i}
                              className="flex-1 bg-chart-1 rounded-t"
                              style={{ height: `${height}%` }}
                              title={`${point.date}: ${formatValue(point.value)}`}
                            />
                          )
                        })}
                      </div>
                      <div className="mt-2 text-xs text-foreground-muted text-center">
                        Showing last 50 periods
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-foreground-muted">
                      No time series data available
                    </div>
                  )}
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

            {/* Continue Button */}
            <div className="flex justify-end">
              <button
                onClick={handleContinue}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors"
              >
                Continue to Column Mapping
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
