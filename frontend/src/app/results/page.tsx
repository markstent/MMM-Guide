'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleHelp, Download, TrendingUp, TrendingDown, AlertCircle, ArrowRight, ChevronDown, ChevronRight, Activity, BarChart3, PieChart, Target, FlaskConical, FileText } from 'lucide-react'
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
  ComposedChart,
  Scatter,
  Cell,
  ReferenceLine,
} from 'recharts'
import { useAppState, type ResponseCurvePoint, type ShapleyAttribution, type ResidualAnalysis, type HoldoutMetrics } from '@/lib/store'
import { exportToCSV } from '@/lib/utils'
import { exportResultsToPDF } from '@/lib/pdf-export'

const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16']

type TabType = 'overview' | 'diagnostics' | 'attribution' | 'validation'

export default function ResultsPage() {
  const router = useRouter()
  const { results, mapping, setCurrentStep, modelConfig } = useAppState()
  const [isExporting, setIsExporting] = useState(false)
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    residuals: true,
    posterior: true,
    responseCurves: true,
    shapley: true,
    holdout: true,
  })

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

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
    router.push('/scenarios')
  }

  const handleExportPDF = async () => {
    if (!results) return
    setIsExporting(true)
    try {
      await exportResultsToPDF({
        results,
        modelConfig: {
          modelType: modelConfig.modelType,
          seasonalityPeriod: modelConfig.seasonalityPeriod,
          mcmcDraws: modelConfig.mcmcDraws,
          mcmcChains: modelConfig.mcmcChains,
        }
      })
    } catch (error) {
      console.error('Failed to export PDF:', error)
    } finally {
      setIsExporting(false)
    }
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

  // Transform ROI data
  const roiData = results.roi || []

  // Get diagnostics
  const diagnostics = results.diagnostics

  // Get R-squared and MAPE with proper display
  const rSquared = results.rSquared ?? 0
  const mape = results.mape ?? 0

  // Get enhanced results data
  const residualAnalysis = results.residualAnalysis
  const posteriorPredictive = results.posteriorPredictive
  const responseCurves = results.responseCurves
  const shapleyAttribution = results.shapleyAttribution
  const holdoutMetrics = results.holdoutMetrics
  const transformations = results.transformations

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

  // Handle Shapley export
  const handleExportShapley = () => {
    if (!shapleyAttribution || shapleyAttribution.length === 0) return
    const exportData = shapleyAttribution.map(row => ({
      Channel: row.channel,
      'Shapley Value': row.shapleyValue,
      'Share (%)': (row.share * 100).toFixed(2),
      'Direct Contribution': row.directContribution,
    }))
    exportToCSV(exportData, 'mmm_shapley_attribution')
  }

  // Get decomposition data for chart
  const decompositionData = results.decomposition || []
  const mediaChannels = decompositionData.length > 0
    ? Object.keys(decompositionData[0]).filter(k => !['date', 'actual', 'baseline', 'predicted'].includes(k))
    : []

  // Calculate baseline from decomposition data (total baseline sales)
  const baselineValue = decompositionData.length > 0
    ? decompositionData.reduce((sum, d) => sum + (d.baseline || 0), 0)
    : 0

  // Prepare posterior predictive data for chart (with dates from decomposition)
  const posteriorData = posteriorPredictive ? posteriorPredictive.actual.map((actual, i) => ({
    date: decompositionData[i]?.date || `Week ${i + 1}`,
    actual,
    predicted: posteriorPredictive.predicted[i],
    ciLower: posteriorPredictive.predictedCiLower[i],
    ciUpper: posteriorPredictive.predictedCiUpper[i],
  })) : []

  // Prepare residual histogram data
  const residualHistogramData = residualAnalysis?.histogram ?
    residualAnalysis.histogram.counts.map((count, i) => ({
      bin: residualAnalysis.histogram.bin_edges[i],
      count,
    })) : []

  // Prepare residual scatter data
  const residualScatterData = residualAnalysis?.residuals ?
    residualAnalysis.residuals.map((residual, i) => ({
      index: i,
      residual,
    })) : []

  // Prepare autocorrelation data
  const autocorrelationData = residualAnalysis?.autocorrelation ?
    residualAnalysis.autocorrelation.map((value, lag) => ({
      lag,
      autocorrelation: value,
    })) : []

  // Prepare Shapley chart data
  const shapleyChartData = shapleyAttribution?.map((item, i) => ({
    ...item,
    fill: COLORS[i % COLORS.length],
  })) || []

  // Get available channels for response curves
  const responseChannels = responseCurves ? Object.keys(responseCurves) : []
  const activeResponseChannel = selectedChannel || responseChannels[0] || null
  const activeResponseData = activeResponseChannel && responseCurves ? responseCurves[activeResponseChannel] : []

  // Calculate marginal ROI data from response curves
  const marginalRoiData = activeResponseData?.map(point => ({
    spend: point.spend,
    marginalRoi: point.marginalRoi,
    isCurrent: point.isCurrent,
  })) || []

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'diagnostics', label: 'Diagnostics', icon: <Activity className="w-4 h-4" /> },
    { id: 'attribution', label: 'Attribution', icon: <PieChart className="w-4 h-4" /> },
    { id: 'validation', label: 'Validation', icon: <Target className="w-4 h-4" /> },
  ]

  return (
    <div className="flex flex-col h-screen">
      <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Results Analysis</h1>
          <span className="text-sm text-foreground-muted">/ Step 6 of 7</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-3.5 h-9 rounded-lg bg-primary text-white hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span className="text-sm">{isExporting ? 'Exporting...' : 'Export PDF'}</span>
          </button>
          <button className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted hover:text-foreground hover:bg-card-hover transition-colors">
            <CircleHelp className="w-4 h-4" />
            <span className="text-sm">Help</span>
          </button>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="border-b border-border px-8">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-foreground-muted hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-8 overflow-auto">
        <div className="space-y-6">
          {/* KPI Cards - Always visible */}
          <div className="grid grid-cols-5 gap-4">
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
            <div className="p-5 rounded-xl bg-card border border-border">
              <p className="text-sm text-foreground-muted">Baseline Sales</p>
              <p className="text-3xl font-semibold font-mono text-foreground mt-2">
                ${(baselineValue / 1000000).toFixed(2)}M
              </p>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-xs text-foreground-muted">Sales without media spend</span>
              </div>
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <>
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

                {/* Response Curves - Interactive */}
                <div className="p-5 rounded-xl bg-card border border-border">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-foreground">Response Curves</h3>
                    {responseChannels.length > 0 && (
                      <select
                        value={activeResponseChannel || ''}
                        onChange={(e) => setSelectedChannel(e.target.value)}
                        className="px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                      >
                        {responseChannels.map(channel => (
                          <option key={channel} value={channel}>{channel}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="h-[240px]">
                    {activeResponseData && activeResponseData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={activeResponseData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis
                            dataKey="spend"
                            stroke="var(--foreground-muted)"
                            fontSize={12}
                            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
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
                            formatter={(v: number, name: string) => [
                              name === 'response' ? `$${(v / 1000).toFixed(1)}k` : v.toFixed(2),
                              name === 'response' ? 'Response' : 'Marginal ROI'
                            ]}
                            labelFormatter={(v) => `Spend: $${(v / 1000).toFixed(0)}k`}
                          />
                          <Line
                            type="monotone"
                            dataKey="response"
                            stroke="var(--chart-1)"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Scatter
                            dataKey="response"
                            fill="var(--chart-2)"
                            shape={(props: any) => {
                              if (!props.payload.isCurrent) return <circle cx={0} cy={0} r={0} fill="transparent" />
                              return (
                                <circle
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={6}
                                  fill="var(--chart-2)"
                                  stroke="white"
                                  strokeWidth={2}
                                />
                              )
                            }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-foreground-muted">
                        No response curve data available
                      </div>
                    )}
                  </div>
                  {activeResponseData && activeResponseData.length > 0 && (
                    <p className="text-xs text-foreground-muted mt-2 text-center">
                      Green dot indicates current spend level
                    </p>
                  )}
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
                        {transformations && (
                          <>
                            <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Adstock</th>
                            <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Saturation</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {roiData.length > 0 ? (
                        <>
                          {roiData.map((row, i) => (
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
                              {transformations && (
                                <>
                                  <td className="px-4 h-12">
                                    <span className="font-mono text-sm text-foreground">
                                      {transformations.adstock[row.channel]?.toFixed(2) ?? '-'}
                                    </span>
                                  </td>
                                  <td className="px-4 h-12">
                                    <span className="font-mono text-sm text-foreground">
                                      {transformations.saturation[row.channel] && transformations.saturation[row.channel].K > 0
                                        ? `K=${(transformations.saturation[row.channel].K / 1000).toFixed(0)}k, S=${transformations.saturation[row.channel].S.toFixed(1)}`
                                        : '-'}
                                    </span>
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                          {/* Baseline row */}
                          <tr className="border-t-2 border-border bg-background-secondary/50">
                            <td className="px-4 h-12">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--chart-baseline)' }} />
                                <span className="text-sm font-medium text-foreground">Baseline</span>
                              </div>
                            </td>
                            <td className="px-4 h-12">
                              <span className="font-mono text-sm text-foreground-muted">-</span>
                            </td>
                            <td className="px-4 h-12">
                              <span className="font-mono text-sm text-foreground">
                                ${(baselineValue / 1000000).toFixed(2)}M
                              </span>
                            </td>
                            <td className="px-4 h-12">
                              <span className="font-mono text-sm text-foreground-muted">-</span>
                            </td>
                            <td className="px-4 h-12">
                              <span className="font-mono text-sm text-foreground-muted">-</span>
                            </td>
                            {transformations && (
                              <>
                                <td className="px-4 h-12"><span className="text-foreground-muted">-</span></td>
                                <td className="px-4 h-12"><span className="text-foreground-muted">-</span></td>
                              </>
                            )}
                          </tr>
                        </>
                      ) : (
                        <tr>
                          <td colSpan={transformations ? 7 : 5} className="px-4 h-12 text-center text-foreground-muted">
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
                          stroke="var(--chart-baseline)"
                          fill="var(--chart-baseline)"
                          fillOpacity={0.7}
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
            </>
          )}

          {/* Diagnostics Tab */}
          {activeTab === 'diagnostics' && (
            <>
              {/* Posterior Predictive Check */}
              <div className="p-5 rounded-xl bg-card border border-border">
                <button
                  onClick={() => toggleSection('posterior')}
                  className="w-full flex items-center justify-between"
                >
                  <h3 className="font-semibold text-foreground">Posterior Predictive Check</h3>
                  {expandedSections.posterior ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                {expandedSections.posterior && (
                  <div className="mt-4">
                    {posteriorData.length > 0 ? (
                      <>
                        <div className="h-[320px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={posteriorData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                              <XAxis
                                dataKey="date"
                                stroke="var(--foreground-muted)"
                                fontSize={11}
                                tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              />
                              <YAxis stroke="var(--foreground-muted)" fontSize={11} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'var(--card)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px',
                                }}
                                formatter={(v: number, name: string) => [`$${(v / 1000).toFixed(1)}k`, name]}
                                labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                              />
                              <Legend verticalAlign="top" height={36} />
                              <Area
                                type="monotone"
                                dataKey="ciUpper"
                                stroke="none"
                                fill="var(--foreground-muted)"
                                fillOpacity={0.15}
                                name="95% CI Upper"
                              />
                              <Area
                                type="monotone"
                                dataKey="ciLower"
                                stroke="none"
                                fill="var(--background)"
                                fillOpacity={1}
                                name="95% CI Lower"
                              />
                              <Line type="monotone" dataKey="predicted" stroke="var(--chart-2)" strokeWidth={2} dot={false} name="Predicted" />
                              <Line type="monotone" dataKey="actual" stroke="var(--chart-1)" strokeWidth={2} dot={false} name="Actual" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-sm text-foreground-muted mt-2">
                          The shaded area represents the 95% credible interval. Actual values should mostly fall within this band.
                        </p>
                      </>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-foreground-muted">
                        No posterior predictive data available
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Residual Analysis */}
              <div className="p-5 rounded-xl bg-card border border-border">
                <button
                  onClick={() => toggleSection('residuals')}
                  className="w-full flex items-center justify-between"
                >
                  <h3 className="font-semibold text-foreground">Residual Analysis</h3>
                  {expandedSections.residuals ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                {expandedSections.residuals && residualAnalysis && (
                  <div className="mt-4 space-y-6">
                    {/* Summary Stats */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="p-3 rounded-lg bg-background-secondary">
                        <p className="text-xs text-foreground-muted">Mean</p>
                        <p className="text-lg font-mono font-semibold">{residualAnalysis.mean.toFixed(4)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background-secondary">
                        <p className="text-xs text-foreground-muted">Std Dev</p>
                        <p className="text-lg font-mono font-semibold">{residualAnalysis.std.toFixed(4)}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background-secondary">
                        <p className="text-xs text-foreground-muted">Durbin-Watson</p>
                        <p className="text-lg font-mono font-semibold">
                          {residualAnalysis.durbinWatson?.toFixed(3) ?? 'N/A'}
                        </p>
                        {residualAnalysis.durbinWatson && (
                          <p className={`text-xs ${residualAnalysis.durbinWatson > 1.5 && residualAnalysis.durbinWatson < 2.5 ? 'text-success' : 'text-warning'}`}>
                            {residualAnalysis.durbinWatson > 1.5 && residualAnalysis.durbinWatson < 2.5 ? 'No autocorrelation' : 'Possible autocorrelation'}
                          </p>
                        )}
                      </div>
                      <div className="p-3 rounded-lg bg-background-secondary">
                        <p className="text-xs text-foreground-muted">Normality Test</p>
                        {residualAnalysis.normalityTest ? (
                          <>
                            <p className={`text-lg font-semibold ${residualAnalysis.normalityTest.is_normal ? 'text-success' : 'text-warning'}`}>
                              {residualAnalysis.normalityTest.is_normal ? 'Normal' : 'Non-Normal'}
                            </p>
                            <p className="text-xs text-foreground-muted">p={residualAnalysis.normalityTest.p_value.toFixed(4)}</p>
                          </>
                        ) : (
                          <p className="text-lg font-mono">N/A</p>
                        )}
                      </div>
                    </div>

                    {/* Residual Plot and Histogram */}
                    <div className="grid grid-cols-2 gap-6">
                      {/* Residual Scatter Plot */}
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Residuals vs Observation</h4>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={residualScatterData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                              <XAxis dataKey="index" stroke="var(--foreground-muted)" fontSize={12} />
                              <YAxis stroke="var(--foreground-muted)" fontSize={12} />
                              <ReferenceLine y={0} stroke="var(--foreground-muted)" strokeDasharray="3 3" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'var(--card)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px',
                                }}
                              />
                              <Scatter dataKey="residual" fill="var(--chart-1)" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-foreground-muted mt-1">
                          This plot shows how prediction errors vary across observations. We want residuals randomly scattered around zero -
                          patterns (like curves or funnels) suggest the model is missing something systematic. Random scatter indicates the model
                          captures the underlying relationships well.
                        </p>
                      </div>

                      {/* Residual Histogram */}
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Residual Distribution</h4>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={residualHistogramData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                              <XAxis dataKey="bin" stroke="var(--foreground-muted)" fontSize={12} tickFormatter={(v) => v.toFixed(2)} />
                              <YAxis stroke="var(--foreground-muted)" fontSize={12} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'var(--card)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px',
                                }}
                              />
                              <Bar dataKey="count" fill="var(--chart-2)" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-foreground-muted mt-1">
                          We want residuals to follow a bell-shaped (normal) distribution centered at zero. This indicates errors are random
                          and unbiased. A skewed distribution or heavy tails may suggest outliers or model misspecification that could affect
                          the reliability of uncertainty estimates.
                        </p>
                      </div>
                    </div>

                    {/* Autocorrelation */}
                    {autocorrelationData.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-foreground mb-2">Autocorrelation Function (ACF)</h4>
                        <div className="h-[200px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={autocorrelationData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                              <XAxis dataKey="lag" stroke="var(--foreground-muted)" fontSize={12} label={{ value: 'Lag', position: 'bottom' }} />
                              <YAxis stroke="var(--foreground-muted)" fontSize={12} domain={[-1, 1]} />
                              <ReferenceLine y={0} stroke="var(--foreground-muted)" />
                              <ReferenceLine y={0.2} stroke="var(--chart-3)" strokeDasharray="3 3" />
                              <ReferenceLine y={-0.2} stroke="var(--chart-3)" strokeDasharray="3 3" />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'var(--card)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '8px',
                                }}
                              />
                              <Bar dataKey="autocorrelation" fill="var(--chart-1)">
                                {autocorrelationData.map((entry, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={Math.abs(entry.autocorrelation) > 0.2 ? 'var(--error)' : 'var(--chart-1)'}
                                  />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <p className="text-xs text-foreground-muted mt-1">
                          Autocorrelation measures whether residuals at one time point are correlated with residuals at previous time points.
                          In time series data, this helps detect patterns the model missed - like seasonality or trends. Values outside the
                          dashed lines (±0.2) indicate significant autocorrelation, suggesting the model may need additional time-based features
                          or that standard errors may be underestimated.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {expandedSections.residuals && !residualAnalysis && (
                  <div className="mt-4 h-[200px] flex items-center justify-center text-foreground-muted">
                    No residual analysis data available
                  </div>
                )}
              </div>

              {/* MCMC Diagnostics */}
              <div className="p-5 rounded-xl bg-card border border-border">
                <h3 className="font-semibold text-foreground mb-4">MCMC Diagnostics</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-3 rounded-lg bg-background-secondary">
                    <p className="text-xs text-foreground-muted">R-hat Max</p>
                    <p className={`text-lg font-mono font-semibold ${diagnostics?.rhat_max && diagnostics.rhat_max < 1.05 ? 'text-success' : 'text-warning'}`}>
                      {diagnostics?.rhat_max?.toFixed(3) ?? 'N/A'}
                    </p>
                    <p className="text-xs text-foreground-muted">Target: &lt; 1.05</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background-secondary">
                    <p className="text-xs text-foreground-muted">ESS Min</p>
                    <p className={`text-lg font-mono font-semibold ${diagnostics?.ess_min && diagnostics.ess_min > 400 ? 'text-success' : 'text-warning'}`}>
                      {diagnostics?.ess_min?.toFixed(0) ?? 'N/A'}
                    </p>
                    <p className="text-xs text-foreground-muted">Target: &gt; 400</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background-secondary">
                    <p className="text-xs text-foreground-muted">Divergences</p>
                    <p className={`text-lg font-mono font-semibold ${diagnostics?.divergences === 0 ? 'text-success' : 'text-error'}`}>
                      {diagnostics?.divergences ?? 'N/A'}
                    </p>
                    <p className="text-xs text-foreground-muted">Target: 0</p>
                  </div>
                  <div className="p-3 rounded-lg bg-background-secondary">
                    <p className="text-xs text-foreground-muted">Converged</p>
                    <p className={`text-lg font-semibold ${diagnostics?.converged ? 'text-success' : 'text-error'}`}>
                      {diagnostics?.converged ? 'Yes' : 'No'}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Attribution Tab */}
          {activeTab === 'attribution' && (
            <>
              {/* Shapley Attribution */}
              <div className="p-5 rounded-xl bg-card border border-border">
                <button
                  onClick={() => toggleSection('shapley')}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">Shapley Attribution</h3>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">Game Theory</span>
                  </div>
                  {expandedSections.shapley ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                {expandedSections.shapley && (
                  <div className="mt-4 space-y-4">
                    {shapleyAttribution && shapleyAttribution.length > 0 ? (
                      <>
                        <div className="grid grid-cols-2 gap-6">
                          {/* Shapley Bar Chart */}
                          <div>
                            <h4 className="text-sm font-medium text-foreground mb-2">Shapley Values by Channel</h4>
                            <div className="h-[240px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={shapleyChartData} layout="vertical">
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                  <XAxis type="number" stroke="var(--foreground-muted)" fontSize={12} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                                  <YAxis dataKey="channel" type="category" stroke="var(--foreground-muted)" fontSize={12} width={100} />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: 'var(--card)',
                                      border: '1px solid var(--border)',
                                      borderRadius: '8px',
                                    }}
                                    formatter={(v: number) => [`$${(v / 1000).toFixed(1)}k`, 'Shapley Value']}
                                  />
                                  <Bar dataKey="shapleyValue" radius={4}>
                                    {shapleyChartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            <p className="text-xs text-foreground-muted mt-2">
                              Shapley values use game theory to fairly attribute sales contribution to each channel,
                              accounting for interaction effects between channels.
                            </p>
                          </div>

                          {/* Share Pie Chart - simplified */}
                          <div>
                            <h4 className="text-sm font-medium text-foreground mb-2">Attribution Share</h4>
                            <div className="h-[240px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={shapleyChartData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                  <XAxis dataKey="channel" stroke="var(--foreground-muted)" fontSize={12} />
                                  <YAxis stroke="var(--foreground-muted)" fontSize={12} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                                  <Tooltip
                                    contentStyle={{
                                      backgroundColor: 'var(--card)',
                                      border: '1px solid var(--border)',
                                      borderRadius: '8px',
                                    }}
                                    formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, 'Share']}
                                  />
                                  <Bar dataKey="share" radius={4}>
                                    {shapleyChartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            <p className="text-xs text-foreground-muted mt-2">
                              Each channel's percentage of total attributed sales. Shows the relative importance
                              of each marketing channel in driving overall sales.
                            </p>
                          </div>
                        </div>

                        {/* Shapley Table */}
                        <div className="flex items-center justify-between mt-4">
                          <h4 className="text-sm font-medium text-foreground">Detailed Attribution</h4>
                          <button
                            onClick={handleExportShapley}
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
                                <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Shapley Value</th>
                                <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Share</th>
                                <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Direct Contribution</th>
                                <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Interaction Effect</th>
                              </tr>
                            </thead>
                            <tbody>
                              {shapleyAttribution.map((row, i) => (
                                <tr key={row.channel} className="border-t border-border">
                                  <td className="px-4 h-12">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                      <span className="text-sm text-foreground">{row.channel}</span>
                                    </div>
                                  </td>
                                  <td className="px-4 h-12">
                                    <span className="font-mono text-sm text-foreground">
                                      ${(row.shapleyValue / 1000).toFixed(1)}k
                                    </span>
                                  </td>
                                  <td className="px-4 h-12">
                                    <span className="font-mono text-sm text-foreground">
                                      {(row.share * 100).toFixed(1)}%
                                    </span>
                                  </td>
                                  <td className="px-4 h-12">
                                    <span className="font-mono text-sm text-foreground">
                                      ${(row.directContribution / 1000).toFixed(1)}k
                                    </span>
                                  </td>
                                  <td className="px-4 h-12">
                                    <span className={`font-mono text-sm ${row.shapleyValue > row.directContribution ? 'text-success' : 'text-foreground-muted'}`}>
                                      ${((row.shapleyValue - row.directContribution) / 1000).toFixed(1)}k
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-xs text-foreground-muted">
                          Shapley values fairly distribute contribution accounting for channel interactions.
                          Positive interaction effects indicate synergies between channels.
                        </p>
                      </>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-foreground-muted">
                        No Shapley attribution data available. Run model training to compute attributions.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Marginal ROI Curves */}
              <div className="p-5 rounded-xl bg-card border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">Marginal ROI Curves</h3>
                  {responseChannels.length > 0 && (
                    <select
                      value={activeResponseChannel || ''}
                      onChange={(e) => setSelectedChannel(e.target.value)}
                      className="px-2 py-1 text-sm border border-border rounded bg-background text-foreground"
                    >
                      {responseChannels.map(channel => (
                        <option key={channel} value={channel}>{channel}</option>
                      ))}
                    </select>
                  )}
                </div>
                {marginalRoiData.length > 0 ? (
                  <>
                    <div className="h-[280px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={marginalRoiData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis
                            dataKey="spend"
                            stroke="var(--foreground-muted)"
                            fontSize={12}
                            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                          />
                          <YAxis
                            stroke="var(--foreground-muted)"
                            fontSize={12}
                            tickFormatter={(v) => `${v.toFixed(2)}x`}
                            domain={['auto', 'auto']}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'var(--card)',
                              border: '1px solid var(--border)',
                              borderRadius: '8px',
                            }}
                            formatter={(v: number) => [`${v.toFixed(2)}x`, 'Marginal ROI']}
                            labelFormatter={(v) => `Spend: $${(v / 1000).toFixed(0)}k`}
                          />
                          <Legend verticalAlign="top" height={36} />
                          <Line
                            type="monotone"
                            dataKey="marginalRoi"
                            stroke="var(--chart-2)"
                            strokeWidth={2}
                            dot={false}
                            name="Marginal ROI"
                          />
                          <Scatter
                            dataKey="marginalRoi"
                            fill="var(--chart-1)"
                            name="Current Spend"
                            shape={(props: any) => {
                              if (!props.payload.isCurrent) return <circle cx={0} cy={0} r={0} fill="transparent" />
                              return (
                                <circle
                                  cx={props.cx}
                                  cy={props.cy}
                                  r={6}
                                  fill="var(--chart-1)"
                                  stroke="white"
                                  strokeWidth={2}
                                />
                              )
                            }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-xs text-foreground-muted mt-2">
                      Marginal ROI shows the incremental return per additional dollar spent. Higher values indicate better marginal efficiency.
                      The curve decreases as spend increases due to diminishing returns. The blue dot marks current spend level.
                    </p>
                  </>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-foreground-muted">
                    No marginal ROI data available
                  </div>
                )}
              </div>
            </>
          )}

          {/* Validation Tab */}
          {activeTab === 'validation' && (
            <>
              {/* Holdout Validation */}
              <div className="p-5 rounded-xl bg-card border border-border">
                <button
                  onClick={() => toggleSection('holdout')}
                  className="w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">Holdout Validation</h3>
                    {holdoutMetrics && (
                      <span className="text-xs px-2 py-0.5 bg-success/10 text-success rounded-full">
                        {holdoutMetrics.nPeriods} periods
                      </span>
                    )}
                  </div>
                  {expandedSections.holdout ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
                {expandedSections.holdout && (
                  <div className="mt-4">
                    {holdoutMetrics ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                          <div className="p-4 rounded-lg bg-background-secondary">
                            <p className="text-xs text-foreground-muted">MAPE</p>
                            <p className={`text-2xl font-mono font-semibold ${holdoutMetrics.mape <= 0.1 ? 'text-success' : holdoutMetrics.mape <= 0.2 ? 'text-warning' : 'text-error'}`}>
                              {(holdoutMetrics.mape * 100).toFixed(1)}%
                            </p>
                            <p className="text-xs text-foreground-muted mt-1">
                              {holdoutMetrics.mape <= 0.1 ? 'Excellent' : holdoutMetrics.mape <= 0.2 ? 'Good' : 'Needs improvement'}
                            </p>
                          </div>
                          <div className="p-4 rounded-lg bg-background-secondary">
                            <p className="text-xs text-foreground-muted">RMSE</p>
                            <p className="text-2xl font-mono font-semibold text-foreground">
                              ${(holdoutMetrics.rmse / 1000).toFixed(1)}k
                            </p>
                            <p className="text-xs text-foreground-muted mt-1">Root mean squared error</p>
                          </div>
                          <div className="p-4 rounded-lg bg-background-secondary">
                            <p className="text-xs text-foreground-muted">MAE</p>
                            <p className="text-2xl font-mono font-semibold text-foreground">
                              ${(holdoutMetrics.mae / 1000).toFixed(1)}k
                            </p>
                            <p className="text-xs text-foreground-muted mt-1">Mean absolute error</p>
                          </div>
                          <div className="p-4 rounded-lg bg-background-secondary">
                            <p className="text-xs text-foreground-muted">R-squared</p>
                            <p className={`text-2xl font-mono font-semibold ${holdoutMetrics.rSquared >= 0.7 ? 'text-success' : 'text-warning'}`}>
                              {holdoutMetrics.rSquared.toFixed(3)}
                            </p>
                            <p className="text-xs text-foreground-muted mt-1">On holdout set</p>
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-background-secondary">
                          <h4 className="text-sm font-medium text-foreground mb-2">Interpretation</h4>
                          <ul className="text-sm text-foreground-muted space-y-1">
                            <li>
                              {holdoutMetrics.mape <= 0.1
                                ? '✓ The model generalizes well to unseen data with excellent predictive accuracy.'
                                : holdoutMetrics.mape <= 0.2
                                ? '◐ The model shows reasonable generalization but may benefit from more data or feature engineering.'
                                : '✗ The model may be overfitting. Consider reducing complexity or increasing training data.'}
                            </li>
                            <li>
                              {holdoutMetrics.rSquared >= 0.7
                                ? '✓ The model explains a significant portion of variance in the holdout period.'
                                : '◐ R-squared on holdout is lower than ideal. The model may not capture all patterns.'}
                            </li>
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <FlaskConical className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
                        <p className="text-foreground-muted">No holdout validation data available.</p>
                        <p className="text-sm text-foreground-muted mt-1">
                          Configure holdout weeks in Model Configuration to enable out-of-sample validation.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Model Fit Comparison */}
              <div className="p-5 rounded-xl bg-card border border-border">
                <h3 className="font-semibold text-foreground mb-4">Model Fit Summary</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-3">In-Sample Metrics</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 rounded bg-background-secondary">
                        <span className="text-sm text-foreground-muted">R-squared</span>
                        <span className="font-mono text-sm font-semibold">{rSquared.toFixed(3)}</span>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded bg-background-secondary">
                        <span className="text-sm text-foreground-muted">MAPE</span>
                        <span className="font-mono text-sm font-semibold">{(mape * 100).toFixed(1)}%</span>
                      </div>
                      {residualAnalysis && (
                        <div className="flex justify-between items-center p-2 rounded bg-background-secondary">
                          <span className="text-sm text-foreground-muted">Residual Std</span>
                          <span className="font-mono text-sm font-semibold">{residualAnalysis.std.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-3">Out-of-Sample Metrics</h4>
                    {holdoutMetrics ? (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center p-2 rounded bg-background-secondary">
                          <span className="text-sm text-foreground-muted">R-squared</span>
                          <span className="font-mono text-sm font-semibold">{holdoutMetrics.rSquared.toFixed(3)}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded bg-background-secondary">
                          <span className="text-sm text-foreground-muted">MAPE</span>
                          <span className="font-mono text-sm font-semibold">{(holdoutMetrics.mape * 100).toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded bg-background-secondary">
                          <span className="text-sm text-foreground-muted">MAE</span>
                          <span className="font-mono text-sm font-semibold">${(holdoutMetrics.mae / 1000).toFixed(1)}k</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 text-center text-foreground-muted">
                        No holdout validation configured
                      </div>
                    )}
                  </div>
                </div>
                {holdoutMetrics && (
                  <div className="mt-4 p-3 rounded-lg bg-background-secondary">
                    <p className="text-sm">
                      <span className="font-medium">Overfitting Check: </span>
                      {Math.abs(rSquared - holdoutMetrics.rSquared) < 0.1 ? (
                        <span className="text-success">Low risk - in-sample and out-of-sample metrics are similar.</span>
                      ) : (
                        <span className="text-warning">Moderate risk - there is a gap between in-sample and out-of-sample performance.</span>
                      )}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Continue Button */}
          <div className="flex justify-end">
            <button
              onClick={handleContinue}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors"
            >
              Continue to Budget Planning
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
