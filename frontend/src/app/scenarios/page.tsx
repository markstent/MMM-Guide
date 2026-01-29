'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CircleHelp, TrendingUp, X, Download, AlertCircle } from 'lucide-react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
} from 'recharts'
import { useAppState } from '@/lib/store'
import { createScenario } from '@/lib/api'
import { exportToCSV, exportToJSON } from '@/lib/utils'

const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export default function ScenariosPage() {
  const router = useRouter()
  const { results, scenarios, addScenario, optimization } = useAppState()

  const [scenarioName, setScenarioName] = useState('')
  const [spendAllocation, setSpendAllocation] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [projectedResults, setProjectedResults] = useState<{
    total_spend: number
    expected_sales: number
    roi: number
  } | null>(null)

  // Initialize spend allocation from ROI data
  useEffect(() => {
    if (results?.roi) {
      const allocation: Record<string, number> = {}
      results.roi.forEach(r => {
        allocation[r.channel] = r.spend
      })
      setSpendAllocation(allocation)
    }
  }, [results])

  // Calculate projections when spend changes
  useEffect(() => {
    if (results?.roi && Object.keys(spendAllocation).length > 0) {
      const totalSpend = Object.values(spendAllocation).reduce((sum, v) => sum + v, 0)

      // Simple projection based on elasticities
      let expectedSales = 0
      results.roi.forEach(r => {
        const elasticity = results.elasticities?.[r.channel]?.mean || 0.1
        const currentSpend = r.spend
        const newSpend = spendAllocation[r.channel] || currentSpend
        const spendRatio = newSpend / currentSpend

        // Use elasticity to estimate contribution change
        const contributionRatio = Math.pow(spendRatio, elasticity)
        expectedSales += r.contribution * contributionRatio
      })

      setProjectedResults({
        total_spend: totalSpend,
        expected_sales: expectedSales,
        roi: totalSpend > 0 ? expectedSales / totalSpend : 0,
      })
    }
  }, [spendAllocation, results])

  if (!results) {
    return (
      <div className="flex flex-col h-screen">
        <header className="h-16 flex items-center px-8 border-b border-border shrink-0">
          <h1 className="text-xl font-semibold text-foreground">Scenario Planning</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-foreground-muted mx-auto" />
            <p className="text-foreground-muted">Please train a model first</p>
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

  const handleReset = () => {
    const allocation: Record<string, number> = {}
    results.roi.forEach(r => {
      allocation[r.channel] = r.spend
    })
    setSpendAllocation(allocation)
  }

  const handleLoadOptimized = () => {
    if (optimization?.optimalSpend) {
      setSpendAllocation(optimization.optimalSpend)
    }
  }

  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) {
      setError('Please enter a scenario name')
      return
    }

    setIsLoading(true)
    setError(null)

    const result = await createScenario({
      name: scenarioName,
      spend_allocation: spendAllocation,
    })

    if (result.success && result.data) {
      const data = result.data as any
      addScenario({
        name: scenarioName,
        spend_allocation: spendAllocation,
        total_spend: data.total_spend,
        projected_sales: data.projected_sales,
        roi: data.roi,
      })
      setScenarioName('')
    } else {
      setError(result.error || 'Failed to save scenario')
    }

    setIsLoading(false)
  }

  // Get baseline values
  const baselineTotalSpend = results.roi.reduce((sum, r) => sum + r.spend, 0)
  const baselineTotalSales = results.roi.reduce((sum, r) => sum + r.contribution, 0)
  const currentTotalSpend = Object.values(spendAllocation).reduce((sum, v) => sum + v, 0)

  // Calculate percent changes
  const spendChange = baselineTotalSpend > 0
    ? ((currentTotalSpend - baselineTotalSpend) / baselineTotalSpend) * 100
    : 0
  const salesChange = projectedResults && baselineTotalSales > 0
    ? ((projectedResults.expected_sales - baselineTotalSales) / baselineTotalSales) * 100
    : 0

  const channels = results.roi.map((r, i) => {
    const currentSpend = spendAllocation[r.channel] || r.spend
    const change = r.spend > 0 ? ((currentSpend - r.spend) / r.spend) * 100 : 0
    return {
      name: r.channel,
      baseline: r.spend,
      spend: currentSpend,
      change,
      color: chartColors[i % chartColors.length],
    }
  })

  const maxSpend = Math.max(...channels.map(c => c.baseline)) * 2

  // Check if current allocation matches historical
  const isHistorical = results.roi.every(
    r => Math.abs((spendAllocation[r.channel] || 0) - r.spend) < 1
  )

  // Check if current allocation matches the optimized allocation
  const isCurrentOptimized = optimization?.optimalSpend &&
    Object.keys(optimization.optimalSpend).every(
      ch => Math.abs((spendAllocation[ch] || 0) - optimization.optimalSpend[ch]) < 1
    )

  const historicalRoi = baselineTotalSpend > 0 ? baselineTotalSales / baselineTotalSpend : 0

  // Generate response curve data for selected channel
  const generateResponseCurve = (channelName: string) => {
    const channelData = results.roi.find(r => r.channel === channelName)
    if (!channelData) return []

    const elasticity = results.elasticities?.[channelName]?.mean || 0.1
    const baseSpend = channelData.spend
    const baseContribution = channelData.contribution
    const points = []

    // Generate points from 0 to 2x baseline spend
    for (let i = 0; i <= 20; i++) {
      const spend = (baseSpend * 2 * i) / 20
      const spendRatio = spend / baseSpend
      const response = baseContribution * Math.pow(spendRatio, elasticity)
      points.push({ spend, response })
    }

    return points
  }

  // Handle export report
  const handleExportReport = () => {
    const exportData = [
      {
        Scenario: 'Historical',
        'Total Spend': baselineTotalSpend,
        'Projected Sales': baselineTotalSales,
        ROI: historicalRoi.toFixed(2),
      },
      {
        Scenario: isCurrentOptimized ? 'Current (Optimized)' : 'Current',
        'Total Spend': currentTotalSpend,
        'Projected Sales': projectedResults?.expected_sales || 0,
        ROI: projectedResults?.roi.toFixed(2) || '0',
      },
      ...scenarios.map(s => ({
        Scenario: s.name,
        'Total Spend': s.total_spend,
        'Projected Sales': s.projected_sales,
        ROI: (s.projected_sales / s.total_spend).toFixed(2),
      })),
    ]
    exportToCSV(exportData, 'mmm_scenarios_comparison')
  }

  // Handle export full report as JSON
  const handleExportFullReport = () => {
    const fullReport = {
      generated_at: new Date().toISOString(),
      baseline: {
        total_spend: baselineTotalSpend,
        total_sales: baselineTotalSales,
        channels: results.roi,
      },
      current_scenario: {
        spend_allocation: spendAllocation,
        total_spend: currentTotalSpend,
        expected_sales: projectedResults?.expected_sales,
        roi: projectedResults?.roi,
      },
      saved_scenarios: scenarios,
      elasticities: results.elasticities,
    }
    exportToJSON(fullReport, 'mmm_full_report')
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Scenario Planning</h1>
          <span className="text-sm text-foreground-muted">/ Step 8 of 8</span>
        </div>
        <button className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted hover:bg-card-hover">
          <CircleHelp className="w-4 h-4" />
          <span className="text-sm">Help</span>
        </button>
      </header>

      <div className="flex-1 p-8 overflow-auto">
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-error/10 border border-error text-error text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-6">
          {/* Left Panel - Adjust Budget */}
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-card border border-border">
              <h3 className="font-semibold text-foreground mb-4">Adjust Budget</h3>

              {/* Budget Presets */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={handleReset}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                    isHistorical
                      ? 'bg-primary text-white'
                      : 'border border-border hover:bg-card-hover'
                  }`}
                >
                  Historical
                </button>
                {optimization?.optimalSpend && (
                  <button
                    onClick={handleLoadOptimized}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                      isCurrentOptimized
                        ? 'bg-primary text-white'
                        : 'border border-border hover:bg-card-hover'
                    }`}
                  >
                    Optimized {optimization.expectedLift && `(+${optimization.expectedLift.lift_pct.toFixed(1)}%)`}
                  </button>
                )}
                {!isHistorical && !isCurrentOptimized && (
                  <span className="px-3 py-1.5 text-sm text-foreground-muted bg-background-secondary rounded-md">
                    Custom
                  </span>
                )}
              </div>

              {/* Channel Sliders */}
              <div className="space-y-0 divide-y divide-border">
                {channels.map((ch) => (
                  <div key={ch.name} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ch.color }} />
                        <span className="text-sm font-medium text-foreground">{ch.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-background-secondary rounded text-foreground-muted">
                          ε {results.elasticities?.[ch.name]?.mean.toFixed(2) || '?'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-mono text-foreground">${(ch.spend / 1000).toFixed(0)}K</span>
                        <span className={`text-xs ${ch.change > 0 ? 'text-success' : ch.change < 0 ? 'text-error' : 'text-foreground-muted'}`}>
                          {ch.change > 0 ? '+' : ''}{ch.change.toFixed(0)}%
                        </span>
                        <button
                          onClick={() => setSelectedChannel(selectedChannel === ch.name ? null : ch.name)}
                          className={`p-1 rounded transition-colors ${
                            selectedChannel === ch.name ? 'bg-primary text-white' : 'hover:bg-background-secondary'
                          }`}
                          title="View response curve"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max={maxSpend}
                      value={ch.spend}
                      onChange={(e) => {
                        setSpendAllocation(prev => ({
                          ...prev,
                          [ch.name]: Number(e.target.value),
                        }))
                      }}
                      className="w-full h-1.5 bg-background-secondary rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, ${ch.color} 0%, ${ch.color} ${(ch.spend / maxSpend) * 100}%, var(--background-secondary) ${(ch.spend / maxSpend) * 100}%)`,
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Response Curve Panel */}
              {selectedChannel && (
                <div className="mt-4 p-4 bg-background-secondary rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-foreground">{selectedChannel} Response Curve</h4>
                    <button onClick={() => setSelectedChannel(null)} className="p-1 hover:bg-card rounded">
                      <X className="w-4 h-4 text-foreground-muted" />
                    </button>
                  </div>
                  <div className="h-[150px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={generateResponseCurve(selectedChannel)}>
                        <XAxis
                          dataKey="spend"
                          tickFormatter={v => `$${(v / 1000).toFixed(0)}K`}
                          stroke="var(--foreground-muted)"
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          tickFormatter={v => `$${(v / 1000).toFixed(0)}K`}
                          stroke="var(--foreground-muted)"
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          width={50}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            fontSize: '11px',
                          }}
                          formatter={(value: number) => [`$${(value / 1000).toFixed(1)}K`, 'Response']}
                          labelFormatter={(label: number) => `Spend: $${(label / 1000).toFixed(1)}K`}
                        />
                        <Line
                          type="monotone"
                          dataKey="response"
                          stroke="var(--primary)"
                          strokeWidth={2}
                          dot={false}
                        />
                        <ReferenceLine
                          x={spendAllocation[selectedChannel]}
                          stroke="var(--success)"
                          strokeDasharray="3 3"
                          strokeWidth={2}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-[10px] text-foreground-muted mt-2">
                    Current spend marked with dashed line. Curve flattening indicates diminishing returns.
                  </p>
                </div>
              )}
            </div>

            {/* Projected Impact Summary */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <h3 className="font-semibold text-foreground mb-3">Projected Impact</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-foreground-muted">Spend</p>
                  <p className="text-lg font-semibold font-mono text-foreground">
                    ${(currentTotalSpend / 1e6).toFixed(2)}M
                  </p>
                  {spendChange !== 0 && (
                    <p className={`text-[10px] ${spendChange > 0 ? 'text-warning' : 'text-success'}`}>
                      {spendChange > 0 ? '+' : ''}{spendChange.toFixed(1)}%
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-foreground-muted">Sales</p>
                  <p className="text-lg font-semibold font-mono text-foreground">
                    ${((projectedResults?.expected_sales || 0) / 1e6).toFixed(2)}M
                  </p>
                  {salesChange !== 0 && (
                    <p className={`text-[10px] ${salesChange > 0 ? 'text-success' : 'text-error'}`}>
                      {salesChange > 0 ? '+' : ''}{salesChange.toFixed(1)}% lift
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-foreground-muted">ROI</p>
                  <p className="text-lg font-semibold font-mono text-foreground">
                    {projectedResults?.roi.toFixed(2)}x
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Compare Scenarios */}
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-card border border-border">
              <h3 className="font-semibold text-foreground mb-4">Compare Scenarios</h3>

              {/* Side-by-Side Comparison Cards */}
              <div className="grid grid-cols-2 gap-4">
                {/* Historical Card */}
                <div className="p-4 rounded-lg bg-background-secondary">
                  <p className="text-xs font-medium text-foreground-muted">HISTORICAL</p>
                  <p className="text-[10px] text-foreground-muted">(actual training data)</p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-[10px] text-foreground-muted">Spend</p>
                      <p className="text-lg font-semibold font-mono text-foreground">${(baselineTotalSpend / 1e6).toFixed(2)}M</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-foreground-muted">Sales</p>
                      <p className="text-lg font-semibold font-mono text-foreground">${(baselineTotalSales / 1e6).toFixed(2)}M</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-foreground-muted">ROI</p>
                      <p className="text-lg font-semibold font-mono text-foreground">{historicalRoi.toFixed(2)}x</p>
                    </div>
                  </div>
                </div>

                {/* Current Card */}
                <div className={`p-4 rounded-lg border-2 ${
                  salesChange > 0 ? 'border-success bg-success/5' :
                  salesChange < 0 ? 'border-error bg-error/5' : 'border-border bg-card'
                }`}>
                  <p className="text-xs font-medium text-foreground-muted">
                    {isCurrentOptimized ? 'OPTIMIZED' : isHistorical ? 'CURRENT' : 'CUSTOM'}
                  </p>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-[10px] text-foreground-muted">Spend</p>
                      <p className="text-lg font-semibold font-mono text-foreground">
                        ${(currentTotalSpend / 1e6).toFixed(2)}M
                        {spendChange !== 0 && (
                          <span className={`text-xs ml-1 ${spendChange > 0 ? 'text-warning' : 'text-success'}`}>
                            ({spendChange > 0 ? '+' : ''}{spendChange.toFixed(0)}%)
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-foreground-muted">Sales</p>
                      <p className="text-lg font-semibold font-mono text-foreground">
                        ${((projectedResults?.expected_sales || 0) / 1e6).toFixed(2)}M
                        {salesChange !== 0 && (
                          <span className={`text-xs ml-1 ${salesChange > 0 ? 'text-success' : 'text-error'}`}>
                            ({salesChange > 0 ? '+' : ''}{salesChange.toFixed(0)}%)
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-foreground-muted">ROI</p>
                      <p className={`text-lg font-semibold font-mono ${
                        (projectedResults?.roi || 0) > historicalRoi ? 'text-success' : 'text-foreground'
                      }`}>
                        {projectedResults?.roi.toFixed(2)}x
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Efficiency Summary */}
              <div className={`mt-4 p-3 rounded-lg text-center ${
                salesChange > spendChange ? 'bg-success/10' :
                salesChange < spendChange ? 'bg-error/10' : 'bg-background-secondary'
              }`}>
                {salesChange > spendChange ? (
                  <p className="text-sm font-medium text-success">Efficient: Sales lift exceeds spend increase</p>
                ) : salesChange < spendChange ? (
                  <p className="text-sm font-medium text-error">Inefficient: Spend increase exceeds sales lift</p>
                ) : (
                  <p className="text-sm text-foreground-muted">No changes from historical</p>
                )}
              </div>
            </div>

            {/* Save Current Scenario */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <h3 className="font-semibold text-foreground mb-3">Save Scenario</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Name this scenario..."
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground"
                />
                <button
                  onClick={handleSaveScenario}
                  disabled={!scenarioName.trim() || isLoading}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {/* Saved Scenarios List */}
            {scenarios.length > 0 && (
              <div className="p-5 rounded-xl bg-card border border-border">
                <p className="text-xs font-medium text-foreground-muted mb-3">SAVED SCENARIOS</p>
                <div className="space-y-2">
                  {scenarios.map((s, i) => (
                    <div
                      key={`${s.name}-${i}`}
                      className="flex items-center justify-between p-3 hover:bg-background-secondary rounded-lg transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        <p className="text-[10px] text-foreground-muted">
                          ${(s.total_spend / 1e6).toFixed(2)}M → ${(s.projected_sales / 1e6).toFixed(2)}M
                        </p>
                      </div>
                      <button
                        onClick={() => setSpendAllocation(s.spend_allocation)}
                        className="px-2 py-1 text-xs border border-border rounded hover:bg-card-hover transition-colors"
                      >
                        Load
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Export Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleExportReport}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-foreground text-sm hover:bg-card-hover transition-colors"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={handleExportFullReport}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-foreground text-sm hover:bg-card-hover transition-colors"
              >
                <Download className="w-4 h-4" />
                Export JSON
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
