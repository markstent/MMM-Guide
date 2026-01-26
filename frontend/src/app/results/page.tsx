'use client'

import { useRouter } from 'next/navigation'
import { CircleHelp, Download, TrendingUp, TrendingDown, AlertCircle, ArrowRight } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  Legend,
} from 'recharts'
import { useAppState } from '@/lib/store'
import { exportToCSV } from '@/lib/utils'

const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export default function ResultsPage() {
  const router = useRouter()
  const { results, mapping, setCurrentStep } = useAppState()

  if (!results) {
    return (
      <div className="flex flex-col h-screen">
        <header className="h-16 flex items-center px-8 border-b border-border shrink-0">
          <h1 className="text-xl font-semibold text-foreground">Results Analysis</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-foreground-muted mx-auto" />
            <p className="text-foreground-muted">No model results available. Please train a model first.</p>
            <button
              onClick={() => router.push('/config')}
              className="px-4 py-2 bg-primary text-white rounded-lg"
            >
              Go to Configuration
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleContinue = () => {
    setCurrentStep(7)
    router.push('/optimization')
  }

  // Transform elasticities for chart
  const elasticityData = results.elasticities
    ? Object.entries(results.elasticities).map(([channel, data], i) => ({
        channel,
        elasticity: data.mean,
        lower: data.ci_lower,
        upper: data.ci_upper,
        color: chartColors[i % chartColors.length],
      }))
    : []

  // Generate response curves data based on elasticities
  const generateResponseCurve = (elasticity: number) => {
    return Array.from({ length: 50 }, (_, i) => ({
      spend: i * 10000,
      response: Math.pow((i + 1) * 10000, elasticity) * 1000,
    }))
  }

  // Transform ROI data
  const roiData = results.roi || []

  // Get diagnostics
  const diagnostics = results.diagnostics

  // Get R-squared and MAPE with proper display
  const rSquared = results.rSquared ?? 0
  const mape = results.mape ?? 0

  // Handle ROI export
  const handleExportROI = () => {
    if (roiData.length === 0) return
    const exportData = roiData.map(row => ({
      Channel: row.channel,
      'Total Spend': row.spend,
      'Contribution': row.contribution,
      'ROI': row.roi,
      'Elasticity': results.elasticities?.[row.channel]?.mean ?? null,
      'Elasticity CI Lower': results.elasticities?.[row.channel]?.ci_lower ?? null,
      'Elasticity CI Upper': results.elasticities?.[row.channel]?.ci_upper ?? null,
    }))
    exportToCSV(exportData, 'mmm_roi_summary')
  }

  // Get decomposition data for chart
  const decompositionData = results.decomposition || []
  const mediaChannels = decompositionData.length > 0
    ? Object.keys(decompositionData[0]).filter(k => !['date', 'actual', 'baseline'].includes(k))
    : []

  return (
    <div className="flex flex-col h-screen">
      <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Results Analysis</h1>
          <span className="text-sm text-foreground-muted">/ Step 6 of 8</span>
        </div>
        <button className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted hover:text-foreground hover:bg-card-hover transition-colors">
          <CircleHelp className="w-4 h-4" />
          <span className="text-sm">Help</span>
        </button>
      </header>

      <div className="flex-1 p-8 overflow-auto">
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <div className="p-5 rounded-xl bg-card border border-border">
              <p className="text-sm text-foreground-muted">R-squared</p>
              <p className="text-3xl font-semibold font-mono text-foreground mt-2">
                {rSquared.toFixed(3)}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                {rSquared >= 0.7 ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-success" />
                    <span className="text-xs font-medium text-success">Good Fit</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-4 h-4 text-warning" />
                    <span className="text-xs font-medium text-warning">Moderate Fit</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-card border border-border">
              <p className="text-sm text-foreground-muted">MAPE</p>
              <p className="text-3xl font-semibold font-mono text-foreground mt-2">
                {(mape * 100).toFixed(1)}%
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                {mape <= 0.1 ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-success" />
                    <span className="text-xs font-medium text-success">Excellent</span>
                  </>
                ) : mape <= 0.2 ? (
                  <>
                    <TrendingDown className="w-4 h-4 text-warning" />
                    <span className="text-xs font-medium text-warning">Acceptable</span>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-4 h-4 text-error" />
                    <span className="text-xs font-medium text-error">High Error</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-card border border-border">
              <p className="text-sm text-foreground-muted">Convergence</p>
              <p className="text-3xl font-semibold font-mono text-foreground mt-2">
                {diagnostics?.converged ? 'Yes' : 'No'}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                {diagnostics?.converged ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-success" />
                    <span className="text-xs font-medium text-success">Chains Converged</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-error" />
                    <span className="text-xs font-medium text-error">Check Diagnostics</span>
                  </>
                )}
              </div>
            </div>
            <div className="p-5 rounded-xl bg-card border border-border">
              <p className="text-sm text-foreground-muted">Divergences</p>
              <p className="text-3xl font-semibold font-mono text-foreground mt-2">
                {diagnostics?.divergences ?? 0}
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                {(diagnostics?.divergences ?? 0) === 0 ? (
                  <span className="text-xs font-medium text-success">No Divergences</span>
                ) : (
                  <span className="text-xs font-medium text-warning">Check Model</span>
                )}
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6">
            {/* Channel Elasticities */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Channel Elasticities</h3>
                <span className="text-xs text-foreground-muted">with 95% credible intervals</span>
              </div>
              <div className="h-[240px]">
                {elasticityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={elasticityData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis type="number" stroke="var(--foreground-muted)" fontSize={12} />
                      <YAxis dataKey="channel" type="category" stroke="var(--foreground-muted)" fontSize={12} width={100} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number, name: string, props: any) => [
                          `${value.toFixed(3)} [${props.payload.lower.toFixed(3)}, ${props.payload.upper.toFixed(3)}]`,
                          'Elasticity'
                        ]}
                      />
                      <Bar dataKey="elasticity" fill="var(--chart-1)" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-foreground-muted">
                    No elasticity data available
                  </div>
                )}
              </div>
            </div>

            {/* Response Curves */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Response Curves</h3>
              </div>
              <div className="h-[240px]">
                {elasticityData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={generateResponseCurve(elasticityData[0]?.elasticity || 0.2)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="spend" stroke="var(--foreground-muted)" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                      <YAxis stroke="var(--foreground-muted)" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                        }}
                        formatter={(v: number) => [`$${(v / 1000).toFixed(0)}k`, 'Response']}
                        labelFormatter={(v) => `Spend: $${(v / 1000).toFixed(0)}k`}
                      />
                      <Line type="monotone" dataKey="response" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-foreground-muted">
                    No response curve data available
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ROI Table */}
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Channel ROI Summary</h3>
              <button
                onClick={handleExportROI}
                className="flex items-center gap-2 px-3 h-8 rounded-md border border-border text-foreground-muted hover:text-foreground transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm">Export</span>
              </button>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-background-secondary">
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Channel</th>
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Total Spend</th>
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Contribution</th>
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">ROI</th>
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Elasticity</th>
                  </tr>
                </thead>
                <tbody>
                  {roiData.length > 0 ? (
                    roiData.map((row, i) => (
                      <tr key={row.channel} className="border-t border-border">
                        <td className="px-4 h-12">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartColors[i % chartColors.length] }} />
                            <span className="text-sm text-foreground">{row.channel}</span>
                          </div>
                        </td>
                        <td className="px-4 h-12">
                          <span className="font-mono text-sm text-foreground">
                            ${(row.spend / 1000000).toFixed(2)}M
                          </span>
                        </td>
                        <td className="px-4 h-12">
                          <span className="font-mono text-sm text-foreground">
                            ${(row.contribution / 1000000).toFixed(2)}M
                          </span>
                        </td>
                        <td className="px-4 h-12">
                          <span className={`font-mono text-sm font-semibold ${row.roi >= 1 ? 'text-success' : 'text-error'}`}>
                            {row.roi.toFixed(2)}x
                          </span>
                        </td>
                        <td className="px-4 h-12">
                          <span className="font-mono text-sm text-foreground">
                            {results.elasticities?.[row.channel]?.mean.toFixed(3) ?? '-'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 h-12 text-center text-foreground-muted">
                        No ROI data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sales Decomposition Chart */}
          {decompositionData.length > 0 && (
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Sales Decomposition</h3>
                <span className="text-xs text-foreground-muted">Baseline + Channel Contributions</span>
              </div>
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={decompositionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="date"
                      stroke="var(--foreground-muted)"
                      fontSize={12}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis
                      stroke="var(--foreground-muted)"
                      fontSize={12}
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                      formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                      labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="baseline"
                      stackId="1"
                      stroke="var(--foreground-muted)"
                      fill="var(--background-secondary)"
                      name="Baseline"
                    />
                    {mediaChannels.map((channel, i) => (
                      <Area
                        key={channel}
                        type="monotone"
                        dataKey={channel}
                        stackId="1"
                        stroke={chartColors[i % chartColors.length]}
                        fill={chartColors[i % chartColors.length]}
                        name={channel}
                        fillOpacity={0.7}
                      />
                    ))}
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="var(--foreground)"
                      strokeWidth={2}
                      dot={false}
                      name="Actual Sales"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Continue Button */}
          <div className="flex justify-end">
            <button
              onClick={handleContinue}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors"
            >
              Continue to Budget Optimization
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
