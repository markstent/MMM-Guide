'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CircleHelp, AlertCircle, ArrowRight, CheckCircle2,
  RefreshCw, Info
} from 'lucide-react'
import { useAppState } from '@/lib/store'
import {
  getExtendedExplorationData,
  ExplorationDataResponse
} from '@/lib/api'

export default function DataExplorationPage() {
  const router = useRouter()
  const { data, setCurrentStep } = useAppState()
  const [explorationData, setExplorationData] = useState<ExplorationDataResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'correlations'>('overview')

  useEffect(() => {
    if (data) {
      loadExplorationData()
    }
  }, [data])

  const loadExplorationData = async () => {
    setIsLoading(true)
    setError(null)

    const result = await getExtendedExplorationData()

    if (result.success && result.data) {
      setExplorationData(result.data)
    } else {
      setError(result.error || 'Failed to load data. Please try again.')
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
          <h1 className="text-xl font-semibold text-foreground">Data Overview</h1>
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

  const formatValue = (value: number | string | undefined | null) => {
    if (value === undefined || value === null) return '-'
    if (typeof value === 'number') {
      if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`
      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}K`
      return value.toFixed(2)
    }
    return String(value)
  }

  // Correlations > 70%
  const highCorrelations = explorationData?.correlation_report?.high_correlations?.filter(
    hc => Math.abs(hc.correlation) >= 0.7
  ) || []

  return (
    <div className="flex flex-col h-screen">
      <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Data Overview</h1>
          <span className="text-sm text-foreground-muted">/ Step 2 of 7</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadExplorationData}
            className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted hover:text-foreground hover:bg-card-hover transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="text-sm">Refresh</span>
          </button>
          <button className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted hover:text-foreground hover:bg-card-hover transition-colors">
            <CircleHelp className="w-4 h-4" />
            <span className="text-sm">Help</span>
          </button>
        </div>
      </header>

      <div className="flex-1 p-8 overflow-auto">
        {isLoading && !explorationData ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-foreground-muted">Analyzing your data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 rounded-lg bg-error/10 border border-error text-error text-sm">
            {error}
          </div>
        ) : explorationData ? (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="p-5 rounded-xl bg-card border border-border">
                <p className="text-sm text-foreground-muted">Rows of Data</p>
                <p className="text-2xl font-semibold font-mono mt-1 text-foreground">
                  {explorationData.summary.rows.toLocaleString()}
                </p>
              </div>
              <div className="p-5 rounded-xl bg-card border border-border">
                <p className="text-sm text-foreground-muted">Columns</p>
                <p className="text-2xl font-semibold font-mono mt-1 text-foreground">
                  {explorationData.summary.columns}
                </p>
              </div>
              <div className="p-5 rounded-xl bg-card border border-border">
                <p className="text-sm text-foreground-muted">Date Range</p>
                <p className="text-lg font-semibold mt-1 text-foreground">
                  {explorationData.summary.date_range
                    ? `${explorationData.summary.date_range.start.slice(0, 10)} to ${explorationData.summary.date_range.end.slice(0, 10)}`
                    : 'Not detected'}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-background-secondary rounded-lg w-fit">
              {(['overview', 'correlations'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
                    activeTab === tab
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-foreground-muted hover:text-foreground'
                  }`}
                >
                  {tab === 'correlations' ? `Correlations${highCorrelations.length > 0 ? ` (${highCorrelations.length})` : ''}` : 'Overview'}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Date Detection */}
                {explorationData.date_detection?.detected_format && (
                  <div className="p-4 rounded-xl bg-success/5 border border-success/30">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-success" />
                      <div>
                        <span className="font-medium text-foreground">Date format detected: </span>
                        <span className="text-foreground-muted">{explorationData.date_detection.display_format}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* High correlations notice */}
                {highCorrelations.length > 0 && (
                  <div className="p-4 rounded-xl bg-warning/5 border border-warning/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <Info className="w-5 h-5 text-warning mt-0.5" />
                        <div>
                          <p className="font-medium text-foreground">{highCorrelations.length} column pair{highCorrelations.length > 1 ? 's' : ''} with high correlation (&gt;70%)</p>
                          <p className="text-sm text-foreground-muted mt-1">
                            Check the Correlations tab to see which columns are similar to each other.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setActiveTab('correlations')}
                        className="px-3 py-1.5 text-sm bg-background-secondary rounded-md hover:bg-card-hover transition-colors"
                      >
                        View Correlations
                      </button>
                    </div>
                  </div>
                )}

                {/* Column Summary Table */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-foreground">Your Columns</h3>
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <div className="max-h-[400px] overflow-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-background-secondary">
                          <tr>
                            <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Column Name</th>
                            <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Type</th>
                            <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Complete</th>
                            <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Average</th>
                            <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Min</th>
                            <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Max</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(explorationData.column_stats).map(([name, stats]) => (
                            <tr key={name} className="border-t border-border">
                              <td className="px-4 h-11 text-sm text-foreground font-medium">{name}</td>
                              <td className="px-4 h-11 text-sm text-foreground-muted">
                                {stats.dtype === 'float64' || stats.dtype === 'int64' ? 'Number' :
                                 stats.dtype === 'object' ? 'Text' :
                                 stats.dtype.includes('date') ? 'Date' : stats.dtype}
                              </td>
                              <td className="px-4 h-11 text-sm">
                                <span className={
                                  stats.null_pct === 0 ? 'text-success' :
                                  stats.null_pct < 5 ? 'text-foreground' : 'text-warning'
                                }>
                                  {(100 - stats.null_pct).toFixed(0)}%
                                </span>
                              </td>
                              <td className="px-4 h-11 text-sm text-foreground font-mono">{formatValue(stats.mean)}</td>
                              <td className="px-4 h-11 text-sm text-foreground font-mono">{formatValue(stats.min)}</td>
                              <td className="px-4 h-11 text-sm text-foreground font-mono">{formatValue(stats.max)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'correlations' && (
              <div className="space-y-6">
                {/* Info Banner */}
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">What are correlations?</p>
                      <p className="text-sm text-foreground-muted">
                        When two columns move together (both go up or down at the same time), they are correlated.
                        High correlation (&gt;70%) can make it harder to measure each one's individual impact.
                      </p>
                    </div>
                  </div>
                </div>

                {highCorrelations.length > 0 ? (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-foreground">
                      Columns with &gt;70% Correlation ({highCorrelations.length} pair{highCorrelations.length > 1 ? 's' : ''})
                    </h3>
                    <div className="rounded-xl border border-border bg-card overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-background-secondary">
                          <tr>
                            <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Column 1</th>
                            <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Column 2</th>
                            <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Correlation</th>
                            <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Strength</th>
                          </tr>
                        </thead>
                        <tbody>
                          {highCorrelations
                            .sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))
                            .map((hc, i) => {
                              const pct = Math.abs(hc.correlation) * 100
                              const strength = pct >= 90 ? 'Very High' : pct >= 80 ? 'High' : 'Moderate'
                              const strengthColor = pct >= 90 ? 'text-error' : pct >= 80 ? 'text-warning' : 'text-foreground-muted'
                              return (
                                <tr key={i} className="border-t border-border">
                                  <td className="px-4 h-11 text-sm text-foreground font-medium">{hc.column1}</td>
                                  <td className="px-4 h-11 text-sm text-foreground font-medium">{hc.column2}</td>
                                  <td className="px-4 h-11 text-sm font-mono text-foreground">{pct.toFixed(0)}%</td>
                                  <td className={`px-4 h-11 text-sm font-medium ${strengthColor}`}>{strength}</td>
                                </tr>
                              )
                            })}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-sm text-foreground-muted">
                      Tip: If you see very high correlations between marketing channels, consider combining them or removing one.
                    </p>
                  </div>
                ) : (
                  <div className="p-8 rounded-xl bg-success/5 border border-success/30 text-center">
                    <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" />
                    <p className="font-medium text-foreground">No high correlations found</p>
                    <p className="text-sm text-foreground-muted mt-1">None of your columns have correlation above 70%. This is good!</p>
                  </div>
                )}
              </div>
            )}

            {/* Continue Button */}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleContinue}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
