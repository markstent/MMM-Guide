'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CircleHelp, RotateCcw, Save, Download, AlertCircle, Trash2 } from 'lucide-react'
import { useAppState } from '@/lib/store'
import { createScenario, getScenarios } from '@/lib/api'

const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

export default function ScenariosPage() {
  const router = useRouter()
  const { results, scenarios, addScenario } = useAppState()

  const [scenarioName, setScenarioName] = useState('')
  const [spendAllocation, setSpendAllocation] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
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

  return (
    <div className="flex flex-col h-screen">
      <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Scenario Planning</h1>
          <span className="text-sm text-foreground-muted">/ Step 8 of 8</span>
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
            {/* Spend Adjustments */}
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Adjust Channel Spend</h3>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-foreground-muted text-xs hover:bg-card-hover"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </button>
              </div>
              <div className="space-y-4">
                {channels.map((ch) => (
                  <div key={ch.name} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ch.color }} />
                        <span className="text-sm font-medium text-foreground">{ch.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground font-medium font-mono">
                          ${(ch.spend / 1000).toFixed(0)}K
                        </span>
                        <span
                          className={`text-xs font-medium ${
                            ch.change > 0
                              ? 'text-success'
                              : ch.change < 0
                              ? 'text-error'
                              : 'text-foreground-muted'
                          }`}
                        >
                          {ch.change > 0 ? '+' : ''}{ch.change.toFixed(0)}%
                        </span>
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
            </div>

            {/* Projected Results */}
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <h3 className="font-semibold text-foreground">Projected Results</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-background-secondary">
                  <p className="text-xs text-foreground-muted">Total Spend</p>
                  <p className="text-xl font-semibold font-mono text-foreground mt-1">
                    ${(currentTotalSpend / 1000000).toFixed(2)}M
                  </p>
                  <p
                    className={`text-[11px] mt-1 ${
                      spendChange > 0 ? 'text-warning' : spendChange < 0 ? 'text-success' : 'text-foreground-muted'
                    }`}
                  >
                    {spendChange > 0 ? '+' : ''}{spendChange.toFixed(1)}% vs baseline
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-background-secondary">
                  <p className="text-xs text-foreground-muted">Expected Sales</p>
                  <p className="text-xl font-semibold font-mono text-foreground mt-1">
                    ${((projectedResults?.expected_sales || 0) / 1000000).toFixed(2)}M
                  </p>
                  <p
                    className={`text-[11px] mt-1 ${
                      salesChange > 0 ? 'text-success' : salesChange < 0 ? 'text-error' : 'text-foreground-muted'
                    }`}
                  >
                    {salesChange > 0 ? '+' : ''}{salesChange.toFixed(1)}% lift
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-background-secondary">
                  <p className="text-xs text-foreground-muted">Expected ROI</p>
                  <p className="text-xl font-semibold font-mono text-foreground mt-1">
                    {projectedResults?.roi.toFixed(2)}x
                  </p>
                  <p className="text-[11px] mt-1 text-foreground-muted">
                    return on ad spend
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Save Scenario */}
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <h3 className="font-semibold text-foreground">Save Scenario</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Scenario name"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm"
                />
                <button
                  onClick={handleSaveScenario}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isLoading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>

            {/* Saved Scenarios */}
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <h3 className="font-semibold text-foreground">Saved Scenarios</h3>
              <div className="space-y-2">
                {/* Baseline */}
                <div className="flex items-center justify-between p-3 bg-background-secondary rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">Current Baseline</p>
                    <p className="text-[11px] text-foreground-muted">
                      ${(baselineTotalSpend / 1000000).toFixed(2)}M spend
                    </p>
                  </div>
                  <span className="font-mono text-sm text-foreground font-medium">
                    ${(baselineTotalSales / 1000000).toFixed(2)}M
                  </span>
                </div>

                {/* Saved scenarios */}
                {scenarios.map((scenario, i) => (
                  <div
                    key={`${scenario.name}-${i}`}
                    className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary cursor-pointer"
                    onClick={() => {
                      setSpendAllocation(scenario.spend_allocation)
                    }}
                  >
                    <div>
                      <p className="text-sm font-medium text-foreground">{scenario.name}</p>
                      <p className="text-[11px] text-foreground-muted">
                        ${(scenario.total_spend / 1000000).toFixed(2)}M spend
                      </p>
                    </div>
                    <span
                      className={`font-mono text-sm font-medium ${
                        scenario.projected_sales > baselineTotalSales ? 'text-success' : 'text-foreground'
                      }`}
                    >
                      ${(scenario.projected_sales / 1000000).toFixed(2)}M
                    </span>
                  </div>
                ))}

                {scenarios.length === 0 && (
                  <p className="text-sm text-foreground-muted text-center py-4">
                    No saved scenarios yet
                  </p>
                )}
              </div>
            </div>

            {/* Export */}
            <button className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-lg text-foreground hover:bg-card-hover transition-colors">
              <Download className="w-4 h-4" />
              <span className="font-medium">Export Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
