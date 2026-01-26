'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CircleHelp, Download, Zap, AlertCircle, ArrowRight } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts'
import { useAppState } from '@/lib/store'
import { optimizeBudget } from '@/lib/api'
import { exportToCSV } from '@/lib/utils'

const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export default function OptimizationPage() {
  const router = useRouter()
  const { results, optimization, setOptimization, setCurrentStep, mapping } = useAppState()

  const [totalBudget, setTotalBudget] = useState(0)
  const [constraints, setConstraints] = useState<Record<string, [number, number]>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize budget from ROI data
  useEffect(() => {
    if (results?.roi) {
      const total = results.roi.reduce((sum, r) => sum + r.spend, 0)
      setTotalBudget(total)

      // Set default constraints (10% - 50% per channel)
      const defaultConstraints: Record<string, [number, number]> = {}
      results.roi.forEach(r => {
        defaultConstraints[r.channel] = [0.1, 0.5]
      })
      setConstraints(defaultConstraints)
    }
  }, [results])

  if (!results) {
    return (
      <div className="flex flex-col h-screen">
        <header className="h-16 flex items-center px-8 border-b border-border shrink-0">
          <h1 className="text-xl font-semibold text-foreground">Budget Optimization</h1>
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

  const handleOptimize = async () => {
    setIsLoading(true)
    setError(null)

    const result = await optimizeBudget({
      total_budget: totalBudget,
      constraints,
    })

    if (result.success && result.data) {
      const data = result.data as any
      setOptimization({
        currentSpend: data.current_spend,
        optimalSpend: data.optimal_spend,
        expectedLift: data.expected_lift,
      })
    } else {
      setError(result.error || 'Optimization failed')
    }

    setIsLoading(false)
  }

  const handleBudgetAdjust = (pct: number) => {
    setTotalBudget(prev => Math.round(prev * (1 + pct)))
  }

  const handleContinue = () => {
    setCurrentStep(8)
    router.push('/scenarios')
  }

  // Current allocation data
  const currentAllocation = results.roi.map((r, i) => ({
    name: r.channel,
    value: r.spend,
    pct: Math.round((r.spend / totalBudget) * 100),
    color: chartColors[i % chartColors.length],
  }))

  // Calculate changes if we have optimization results
  const changes = optimization?.optimalSpend
    ? Object.entries(optimization.optimalSpend).map(([channel, optimal]) => {
        const current = optimization.currentSpend[channel] || 0
        const change = current > 0 ? ((optimal - current) / current) * 100 : 0
        return { channel, current, optimal, change }
      })
    : []

  // Waterfall chart data
  const waterfallData = changes.map((ch, i) => ({
    name: ch.channel,
    value: ch.optimal - ch.current,
    fill: ch.change > 0 ? 'var(--success)' : 'var(--error)',
  }))

  // Handle export optimized plan
  const handleExportOptimization = () => {
    if (!optimization) return
    const exportData = changes.map(ch => ({
      Channel: ch.channel,
      'Current Spend': ch.current,
      'Optimal Spend': ch.optimal,
      'Change (%)': ch.change.toFixed(2),
      'Change ($)': ch.optimal - ch.current,
    }))

    // Add summary row
    exportData.push({
      Channel: 'TOTAL',
      'Current Spend': Object.values(optimization.currentSpend).reduce((a, b) => a + b, 0),
      'Optimal Spend': Object.values(optimization.optimalSpend).reduce((a, b) => a + b, 0),
      'Change (%)': optimization.expectedLift?.lift_pct.toFixed(2) || '0',
      'Change ($)': 0,
    })

    exportToCSV(exportData, 'mmm_optimized_budget')
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Budget Optimization</h1>
          <span className="text-sm text-foreground-muted">/ Step 7 of 8</span>
        </div>
        <button className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted">
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

        <div className="grid grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="col-span-2 space-y-6">
            {/* Current Budget */}
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <h3 className="font-semibold text-foreground">Current Budget Allocation</h3>
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-foreground-muted">Total Budget</p>
                  <p className="text-2xl font-semibold font-mono text-foreground">
                    ${(totalBudget / 1000000).toFixed(2)}M
                  </p>
                </div>
                <div className="flex-1 h-[150px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={currentAllocation}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={60}
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {currentAllocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`$${(value / 1000000).toFixed(2)}M`, 'Spend']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="space-y-2">
                {currentAllocation.map((ch) => (
                  <div key={ch.name} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ch.color }} />
                    <span className="text-foreground font-medium">{ch.name}:</span>
                    <span className="text-foreground-muted">
                      ${(ch.value / 1000000).toFixed(2)}M ({ch.pct}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Constraints */}
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Channel Constraints</h3>
                <button
                  onClick={() => {
                    const defaultConstraints: Record<string, [number, number]> = {}
                    results.roi.forEach(r => {
                      defaultConstraints[r.channel] = [0.1, 0.5]
                    })
                    setConstraints(defaultConstraints)
                  }}
                  className="text-xs text-foreground-muted hover:text-foreground"
                >
                  Reset
                </button>
              </div>
              <div className="space-y-4">
                {Object.entries(constraints).map(([channel, [min, max]], i) => (
                  <div key={channel} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{channel}</span>
                      <span className="text-xs text-foreground-muted">
                        {Math.round(min * 100)}% - {Math.round(max * 100)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs text-foreground-muted">Min %</label>
                        <input
                          type="range"
                          min="0"
                          max="50"
                          value={min * 100}
                          onChange={(e) => {
                            const newMin = Number(e.target.value) / 100
                            setConstraints(prev => ({
                              ...prev,
                              [channel]: [newMin, prev[channel][1]],
                            }))
                          }}
                          className="w-full h-1.5 bg-background-secondary rounded-full appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-foreground-muted">Max %</label>
                        <input
                          type="range"
                          min="20"
                          max="100"
                          value={max * 100}
                          onChange={(e) => {
                            const newMax = Number(e.target.value) / 100
                            setConstraints(prev => ({
                              ...prev,
                              [channel]: [prev[channel][0], newMax],
                            }))
                          }}
                          className="w-full h-1.5 bg-background-secondary rounded-full appearance-none cursor-pointer accent-primary"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Waterfall Chart - Budget Changes */}
            {waterfallData.length > 0 && (
              <div className="p-5 rounded-xl bg-card border border-border space-y-4">
                <h3 className="font-semibold text-foreground">Budget Reallocation</h3>
                <p className="text-xs text-foreground-muted">Change from current to optimal allocation</p>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={waterfallData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="name"
                        stroke="var(--foreground-muted)"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--foreground-muted)"
                        fontSize={11}
                        tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [
                          `${value > 0 ? '+' : ''}$${(value / 1000).toFixed(0)}k`,
                          'Change',
                        ]}
                      />
                      <ReferenceLine y={0} stroke="var(--foreground-muted)" />
                      <Bar
                        dataKey="value"
                        radius={[4, 4, 0, 0]}
                      >
                        {waterfallData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Run Optimization */}
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <h3 className="font-semibold text-foreground">Run Optimization</h3>
              <div>
                <p className="text-sm text-foreground mb-2">Total Budget</p>
                <input
                  type="text"
                  value={`$${totalBudget.toLocaleString()}`}
                  onChange={(e) => {
                    const value = e.target.value.replace(/[^0-9]/g, '')
                    setTotalBudget(Number(value) || 0)
                  }}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleBudgetAdjust(-0.1)}
                  className="px-4 py-2 border border-border rounded-md text-foreground-muted text-sm hover:bg-card-hover"
                >
                  -10%
                </button>
                <button
                  onClick={() => handleBudgetAdjust(0.1)}
                  className="px-4 py-2 border border-border rounded-md text-foreground-muted text-sm hover:bg-card-hover"
                >
                  +10%
                </button>
              </div>
              <button
                onClick={handleOptimize}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                {isLoading ? 'Optimizing...' : 'Optimize Budget'}
              </button>
            </div>

            {/* Results */}
            {optimization && (
              <div className="p-5 rounded-xl bg-card border border-border space-y-4">
                <h3 className="font-semibold text-foreground">Optimization Results</h3>
                {optimization.expectedLift && (
                  <div className="p-4 rounded-lg bg-success/10">
                    <p className="text-xl font-semibold text-success">
                      +{optimization.expectedLift.lift_pct.toFixed(1)}% Expected Lift
                    </p>
                    <p className="text-xs text-foreground-muted mt-1">
                      Projected sales: ${(optimization.expectedLift.expected_sales / 1000000).toFixed(2)}M
                    </p>
                  </div>
                )}
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">Recommended Changes</p>
                  {changes.map((ch) => (
                    <div key={ch.channel} className="flex justify-between text-sm">
                      <span className="text-foreground font-medium">{ch.channel}</span>
                      <span
                        className={
                          ch.change > 0
                            ? 'text-success font-semibold'
                            : ch.change < 0
                            ? 'text-error font-semibold'
                            : 'text-foreground-muted'
                        }
                      >
                        {ch.change > 0 ? '+' : ''}{ch.change.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleExportOptimization}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-foreground-muted hover:text-foreground hover:bg-card-hover transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Export Optimized Plan
                </button>
              </div>
            )}

            {/* Continue Button */}
            {optimization && (
              <button
                onClick={handleContinue}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors"
              >
                Continue to Scenario Planning
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
