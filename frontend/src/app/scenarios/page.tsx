'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CircleHelp, TrendingUp, X, Download, AlertCircle, Target, DollarSign } from 'lucide-react'
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
} from 'recharts'
import { useAppState } from '@/lib/store'
import { createScenario, optimizeBudget, optimizeForSalesTarget, GoalBasedOptimizationResponse } from '@/lib/api'
import { exportToCSV, exportToJSON } from '@/lib/utils'

const chartColors = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)']

// Smart currency formatting based on magnitude
const formatCurrency = (value: number): string => {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`
  } else if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}k`
  } else {
    return `$${value.toFixed(0)}`
  }
}

// Format currency with sign (for changes)
const formatCurrencyChange = (value: number): string => {
  const sign = value > 0 ? '+' : ''
  if (Math.abs(value) >= 1000000) {
    return `${sign}$${(value / 1000000).toFixed(1)}M`
  } else if (Math.abs(value) >= 1000) {
    return `${sign}$${(value / 1000).toFixed(0)}k`
  } else {
    return `${sign}$${value.toFixed(0)}`
  }
}

// Parse currency input string to number
const parseCurrencyInput = (value: string): number => {
  // Remove currency symbols, commas, spaces
  const cleaned = value.replace(/[$,\s]/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

// Format number for input display (with commas)
const formatInputCurrency = (value: number): string => {
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

export default function BudgetPlanningPage() {
  const router = useRouter()
  const { results, scenarios, addScenario, optimization, setOptimization } = useAppState()

  const [scenarioName, setScenarioName] = useState('')
  const [spendAllocation, setSpendAllocation] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [projectedResults, setProjectedResults] = useState<{
    total_spend: number
    expected_sales: number
    roi: number
  } | null>(null)

  // New state for enhanced planning features
  const [budgetInputMode, setBudgetInputMode] = useState(false)
  const [budgetInputValue, setBudgetInputValue] = useState('')
  const [activeQuickScenario, setActiveQuickScenario] = useState<string | null>('historical')

  // Goal-based planning state
  const [planningMode, setPlanningMode] = useState<'budget' | 'sales'>('budget')
  const [salesTarget, setSalesTarget] = useState('')
  const [isCalculatingGoal, setIsCalculatingGoal] = useState(false)
  const [goalResult, setGoalResult] = useState<GoalBasedOptimizationResponse | null>(null)

  // Channel constraints state
  const [constraints, setConstraints] = useState<Record<string, [number, number]>>({})
  const [showConstraints, setShowConstraints] = useState(false)

  // Initialize spend allocation - prefer optimized if available, otherwise use historical
  useEffect(() => {
    if (optimization?.optimalSpend && Object.keys(optimization.optimalSpend).length > 0) {
      // Use optimized allocation if available from previous optimization
      // Filter out total_spend if present
      const filtered: Record<string, number> = {}
      for (const [ch, spend] of Object.entries(optimization.optimalSpend)) {
        if (!ch.toLowerCase().includes('total')) {
          filtered[ch] = spend
        }
      }
      setSpendAllocation(filtered)
    } else if (results?.roi) {
      // Fall back to historical allocation (exclude total_spend)
      const allocation: Record<string, number> = {}
      results.roi
        .filter(r => !r.channel.toLowerCase().includes('total'))
        .forEach(r => {
          allocation[r.channel] = r.spend
        })
      setSpendAllocation(allocation)
    }
  }, [results, optimization])

  // Initialize constraints for all channels
  useEffect(() => {
    if (results?.roi) {
      const defaultConstraints: Record<string, [number, number]> = {}
      results.roi
        .filter(r => !r.channel.toLowerCase().includes('total'))
        .forEach(r => {
          defaultConstraints[r.channel] = [0.05, 0.80]
        })
      setConstraints(defaultConstraints)
    }
  }, [results])

  // Calculate projections when spend changes
  useEffect(() => {
    if (results?.roi && Object.keys(spendAllocation).length > 0) {
      const totalSpend = Object.values(spendAllocation).reduce((sum, v) => sum + v, 0)

      // Simple projection based on elasticities (exclude total_spend)
      let expectedSales = 0
      results.roi
        .filter(r => !r.channel.toLowerCase().includes('total'))
        .forEach(r => {
          const elasticity = results.elasticities?.[r.channel]?.mean || 0.1
          const baselineSpend = r.spend
          // Use nullish coalescing to handle 0 values correctly (0 is a valid spend)
          const newSpend = spendAllocation[r.channel] ?? baselineSpend
          const spendRatio = baselineSpend > 0 ? newSpend / baselineSpend : 1

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
          <h1 className="text-xl font-semibold text-foreground">Budget Planning</h1>
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
    results.roi
      .filter(r => !r.channel.toLowerCase().includes('total'))
      .forEach(r => {
        allocation[r.channel] = r.spend
      })
    setSpendAllocation(allocation)
    setActiveQuickScenario('historical')
    setBudgetInputMode(false)
    setGoalResult(null)
  }

  // Quick scenario: scale all channels by a percentage
  const handleQuickScenario = (percentChange: number, label: string) => {
    const multiplier = 1 + percentChange
    const newAllocation: Record<string, number> = {}
    mediaChannels.forEach(r => {
      newAllocation[r.channel] = r.spend * multiplier
    })
    setSpendAllocation(newAllocation)
    setActiveQuickScenario(label)
    setBudgetInputMode(false)
    setGoalResult(null)
  }

  // Budget input mode: set exact total budget and optimize
  const handleBudgetOptimize = async () => {
    const targetBudget = parseCurrencyInput(budgetInputValue)
    if (targetBudget <= 0) {
      setError('Please enter a valid budget amount')
      return
    }

    setIsOptimizing(true)
    setError(null)

    try {
      const result = await optimizeBudget({
        total_budget: targetBudget,
        constraints,
      })

      if (result.success && result.data) {
        const data = result.data as { optimal_spend: Record<string, number>; current_spend: Record<string, number>; expected_lift: { current_sales: number; expected_sales: number; lift: number; lift_pct: number } }
        setSpendAllocation(data.optimal_spend)
        setActiveQuickScenario(null)
        // Store optimization results for waterfall chart
        setOptimization({
          currentSpend: data.current_spend,
          optimalSpend: data.optimal_spend,
          expectedLift: data.expected_lift,
        })
      } else {
        setError(result.error || 'Optimization failed')
      }
    } catch (err) {
      setError('Failed to optimize budget')
    } finally {
      setIsOptimizing(false)
    }
  }

  // Goal-based planning: find budget needed for target sales
  const handleGoalBasedPlanning = async () => {
    const target = parseCurrencyInput(salesTarget)
    if (target <= 0) {
      setError('Please enter a valid sales target')
      return
    }

    setIsCalculatingGoal(true)
    setError(null)

    try {
      const result = await optimizeForSalesTarget({
        target_sales: target,
        max_budget_multiplier: 3.0,
      })

      if (result.success && result.data) {
        setGoalResult(result.data)
      } else {
        setError(result.error || 'Could not calculate required budget')
      }
    } catch (err) {
      setError('Failed to calculate goal-based plan')
    } finally {
      setIsCalculatingGoal(false)
    }
  }

  // Apply goal result to sliders
  const handleApplyGoalResult = () => {
    if (goalResult?.optimal_allocation) {
      setSpendAllocation(goalResult.optimal_allocation)
      setActiveQuickScenario(null)
      setPlanningMode('budget')
    }
  }

  const handleLoadOptimized = async () => {
    // Calculate total from current slider positions
    const currentTotal = Object.values(spendAllocation).reduce((sum, v) => sum + v, 0)

    if (currentTotal <= 0) {
      setError('Total budget must be greater than zero')
      return
    }

    setIsOptimizing(true)
    setError(null)

    try {
      const result = await optimizeBudget({
        total_budget: currentTotal,
        constraints,
      })

      if (result.success && result.data) {
        const data = result.data as { optimal_spend: Record<string, number>; current_spend: Record<string, number>; expected_lift: { current_sales: number; expected_sales: number; lift: number; lift_pct: number } }
        // The backend now filters out total_spend, so just use the result directly
        setSpendAllocation(data.optimal_spend)
        setActiveQuickScenario(null)
        setGoalResult(null)
        // Store optimization results for waterfall chart
        setOptimization({
          currentSpend: data.current_spend,
          optimalSpend: data.optimal_spend,
          expectedLift: data.expected_lift,
        })
      } else {
        setError(result.error || 'Optimization failed')
      }
    } catch (err) {
      setError('Failed to optimize budget')
    } finally {
      setIsOptimizing(false)
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

  // Get baseline values (exclude total_spend if present)
  const mediaChannels = results.roi.filter(r => !r.channel.toLowerCase().includes('total'))
  const baselineTotalSpend = mediaChannels.reduce((sum, r) => sum + r.spend, 0)
  const baselineTotalSales = mediaChannels.reduce((sum, r) => sum + r.contribution, 0)
  const currentTotalSpend = Object.values(spendAllocation).reduce((sum, v) => sum + v, 0)

  // Calculate percent changes
  const spendChange = baselineTotalSpend > 0
    ? ((currentTotalSpend - baselineTotalSpend) / baselineTotalSpend) * 100
    : 0
  const salesChange = projectedResults && baselineTotalSales > 0
    ? ((projectedResults.expected_sales - baselineTotalSales) / baselineTotalSales) * 100
    : 0

  const channels = results.roi
    .filter(r => !r.channel.toLowerCase().includes('total'))
    .map((r, i) => {
      // Use nullish coalescing to handle 0 values correctly
      const currentSpend = spendAllocation[r.channel] ?? r.spend
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
  const isHistorical = mediaChannels.every(
    r => Math.abs((spendAllocation[r.channel] || 0) - r.spend) < 1
  )

  // Check if current allocation matches the optimized allocation
  const isCurrentOptimized = optimization?.optimalSpend &&
    Object.keys(optimization.optimalSpend).every(
      ch => Math.abs((spendAllocation[ch] || 0) - optimization.optimalSpend[ch]) < 1
    )

  const historicalRoi = baselineTotalSpend > 0 ? baselineTotalSales / baselineTotalSpend : 0

  // Calculate waterfall chart data when optimization results are available
  const waterfallData = optimization?.optimalSpend
    ? Object.entries(optimization.optimalSpend).map(([channel, optimal]) => {
        const historicalChannelSpend = optimization.currentSpend[channel] || 0
        const historicalTotalSpend = Object.values(optimization.currentSpend).reduce((a, b) => a + b, 0)
        const proportionalCurrent = historicalTotalSpend > 0
          ? (historicalChannelSpend / historicalTotalSpend) * currentTotalSpend
          : 0
        return {
          name: channel.replace(/_spend|_cost/gi, ''),
          value: optimal - proportionalCurrent,
          fill: optimal > proportionalCurrent ? 'var(--success)' : 'var(--error)',
        }
      })
    : []

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
          <h1 className="text-xl font-semibold text-foreground">Budget Planning</h1>
          <span className="text-sm text-foreground-muted">/ Step 7 of 7</span>
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
            {/* Planning Mode Toggle */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center gap-4 mb-4">
                <h3 className="font-semibold text-foreground">Planning Mode</h3>
                <div className="flex bg-background-secondary rounded-lg p-0.5">
                  <button
                    onClick={() => setPlanningMode('budget')}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                      planningMode === 'budget'
                        ? 'bg-primary text-white'
                        : 'text-foreground-muted hover:text-foreground'
                    }`}
                  >
                    <DollarSign className="w-3.5 h-3.5 inline mr-1" />
                    Set Budget
                  </button>
                  <button
                    onClick={() => setPlanningMode('sales')}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                      planningMode === 'sales'
                        ? 'bg-primary text-white'
                        : 'text-foreground-muted hover:text-foreground'
                    }`}
                  >
                    <Target className="w-3.5 h-3.5 inline mr-1" />
                    Set Sales Target
                  </button>
                </div>
              </div>

              {planningMode === 'budget' ? (
                <>
                  {/* Quick Scenarios */}
                  <div className="mb-4">
                    <p className="text-xs text-foreground-muted mb-2">Quick Scenarios</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => handleQuickScenario(-0.20, '-20%')}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                          activeQuickScenario === '-20%'
                            ? 'bg-error/20 text-error border border-error'
                            : 'border border-border hover:bg-card-hover'
                        }`}
                      >
                        -20%
                      </button>
                      <button
                        onClick={() => handleQuickScenario(-0.10, '-10%')}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                          activeQuickScenario === '-10%'
                            ? 'bg-error/20 text-error border border-error'
                            : 'border border-border hover:bg-card-hover'
                        }`}
                      >
                        -10%
                      </button>
                      <button
                        onClick={handleReset}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                          activeQuickScenario === 'historical' || isHistorical
                            ? 'bg-primary text-white'
                            : 'border border-border hover:bg-card-hover'
                        }`}
                      >
                        Historical
                      </button>
                      <button
                        onClick={() => handleQuickScenario(0.10, '+10%')}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                          activeQuickScenario === '+10%'
                            ? 'bg-success/20 text-success border border-success'
                            : 'border border-border hover:bg-card-hover'
                        }`}
                      >
                        +10%
                      </button>
                      <button
                        onClick={() => handleQuickScenario(0.20, '+20%')}
                        className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                          activeQuickScenario === '+20%'
                            ? 'bg-success/20 text-success border border-success'
                            : 'border border-border hover:bg-card-hover'
                        }`}
                      >
                        +20%
                      </button>
                    </div>
                  </div>

                  {/* Budget Input Mode */}
                  <div className="mb-4 p-3 bg-background-secondary rounded-lg">
                    <p className="text-xs text-foreground-muted mb-2">Set Exact Budget & Optimize</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">$</span>
                        <input
                          type="text"
                          placeholder={formatInputCurrency(baselineTotalSpend)}
                          value={budgetInputValue}
                          onChange={(e) => setBudgetInputValue(e.target.value)}
                          className="w-full pl-7 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground font-mono"
                        />
                      </div>
                      <button
                        onClick={handleBudgetOptimize}
                        disabled={isOptimizing}
                        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {isOptimizing ? 'Optimizing...' : 'Optimize'}
                      </button>
                    </div>
                  </div>

                  {/* Current optimize button */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={handleLoadOptimized}
                      disabled={isOptimizing || currentTotalSpend <= 0}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                        isCurrentOptimized
                          ? 'bg-primary text-white'
                          : 'border border-border hover:bg-card-hover'
                      } ${isOptimizing || currentTotalSpend <= 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {isOptimizing ? 'Optimizing...' : `Optimize for ${formatCurrency(currentTotalSpend)}`}
                    </button>
                    {!isHistorical && !isCurrentOptimized && activeQuickScenario === null && (
                      <span className="px-3 py-1.5 text-sm text-foreground-muted bg-background-secondary rounded-md">
                        Custom
                      </span>
                    )}
                  </div>
                </>
              ) : (
                /* Goal-Based Planning UI */
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-foreground-muted mb-2">
                      Enter your target sales - we'll calculate the required budget
                    </p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted">$</span>
                        <input
                          type="text"
                          placeholder={formatInputCurrency(baselineTotalSales)}
                          value={salesTarget}
                          onChange={(e) => setSalesTarget(e.target.value)}
                          className="w-full pl-7 pr-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground font-mono"
                        />
                      </div>
                      <button
                        onClick={handleGoalBasedPlanning}
                        disabled={isCalculatingGoal}
                        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {isCalculatingGoal ? 'Calculating...' : 'Calculate'}
                      </button>
                    </div>
                  </div>

                  {/* Goal Result */}
                  {goalResult && (
                    <div className={`p-4 rounded-lg border ${
                      goalResult.achievable
                        ? 'bg-success/5 border-success'
                        : 'bg-warning/5 border-warning'
                    }`}>
                      <p className={`text-sm font-medium mb-2 ${
                        goalResult.achievable ? 'text-success' : 'text-warning'
                      }`}>
                        {goalResult.message}
                      </p>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <p className="text-[10px] text-foreground-muted">Required Budget</p>
                          <p className="text-lg font-semibold font-mono text-foreground">
                            {formatCurrency(goalResult.required_budget)}
                          </p>
                          <p className={`text-[10px] ${goalResult.budget_change_pct > 0 ? 'text-warning' : 'text-success'}`}>
                            {goalResult.budget_change_pct > 0 ? '+' : ''}{goalResult.budget_change_pct.toFixed(1)}% vs historical
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-foreground-muted">Projected Sales</p>
                          <p className="text-lg font-semibold font-mono text-foreground">
                            {formatCurrency(goalResult.projected_sales)}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleApplyGoalResult}
                        className="w-full px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium"
                      >
                        Apply to Sliders
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Channel Constraints Card */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-foreground">Channel Constraints</h3>
                  <p className="text-xs text-foreground-muted mt-1">Set min/max budget allocation per channel</p>
                </div>
                <button
                  onClick={() => setShowConstraints(!showConstraints)}
                  className="text-xs text-primary hover:text-primary-hover px-2 py-1 rounded border border-primary/30"
                >
                  {showConstraints ? 'Hide' : 'Show'} Constraints
                </button>
              </div>

              {showConstraints && (
                <>
                  {/* Table Header */}
                  <div className="grid grid-cols-[1fr,60px,1fr,60px] gap-2 text-xs text-foreground-muted px-1 mb-2">
                    <span>Channel</span>
                    <span className="text-center">Min</span>
                    <span className="text-center">Allowed Range</span>
                    <span className="text-center">Max</span>
                  </div>

                  {/* Constraint Rows */}
                  <div className="space-y-3">
                    {Object.entries(constraints).map(([channel, [min, max]]) => (
                      <div key={channel} className="grid grid-cols-[1fr,60px,1fr,60px] gap-2 items-center">
                        {/* Channel Name */}
                        <span className="text-sm font-medium text-foreground truncate" title={channel}>
                          {channel.replace(/_spend|_cost/gi, '')}
                        </span>

                        {/* Min Input */}
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={Math.round(min * 100)}
                            onChange={(e) => {
                              const newMin = Math.min(Number(e.target.value) / 100, max - 0.05)
                              setConstraints(prev => ({
                                ...prev,
                                [channel]: [Math.max(0, newMin), prev[channel][1]],
                              }))
                            }}
                            className="w-full px-2 py-1.5 text-sm text-center bg-background border border-border rounded"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-foreground-muted">%</span>
                        </div>

                        {/* Visual Range Bar */}
                        <div className="relative h-3 bg-background-secondary rounded-full overflow-hidden">
                          <div
                            className="absolute top-0 bottom-0 bg-primary/30 rounded-full"
                            style={{
                              left: `${min * 100}%`,
                              width: `${(max - min) * 100}%`,
                            }}
                          />
                        </div>

                        {/* Max Input */}
                        <div className="relative">
                          <input
                            type="number"
                            min="20"
                            max="100"
                            value={Math.round(max * 100)}
                            onChange={(e) => {
                              const newMax = Math.max(Number(e.target.value) / 100, min + 0.05)
                              setConstraints(prev => ({
                                ...prev,
                                [channel]: [prev[channel][0], Math.min(1, newMax)],
                              }))
                            }}
                            className="w-full px-2 py-1.5 text-sm text-center bg-background border border-border rounded"
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-foreground-muted">%</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reset Button */}
                  <div className="mt-4 pt-3 border-t border-border flex justify-end">
                    <button
                      onClick={() => {
                        const defaultConstraints: Record<string, [number, number]> = {}
                        results.roi
                          .filter(r => !r.channel.toLowerCase().includes('total'))
                          .forEach(r => {
                            defaultConstraints[r.channel] = [0.05, 0.80]
                          })
                        setConstraints(defaultConstraints)
                      }}
                      className="text-xs text-foreground-muted hover:text-foreground px-2 py-1 rounded border border-border"
                    >
                      Reset to Defaults
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Channel Sliders Card */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <h3 className="font-semibold text-foreground mb-4">Channel Allocation</h3>

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
                        <span className="text-sm font-mono text-foreground">{formatCurrency(ch.spend)}</span>
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
                        setActiveQuickScenario(null) // Clear quick scenario when manually adjusting
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
                    {formatCurrency(currentTotalSpend)}
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
                    {formatCurrency(projectedResults?.expected_sales || 0)}
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
                      <p className="text-lg font-semibold font-mono text-foreground">{formatCurrency(baselineTotalSpend)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-foreground-muted">Sales</p>
                      <p className="text-lg font-semibold font-mono text-foreground">{formatCurrency(baselineTotalSales)}</p>
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
                        {formatCurrency(currentTotalSpend)}
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
                        {formatCurrency(projectedResults?.expected_sales || 0)}
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

            {/* Waterfall Chart - Budget Reallocation */}
            {waterfallData.length > 0 && (
              <div className="p-5 rounded-xl bg-card border border-border">
                <h3 className="font-semibold text-foreground mb-2">Budget Reallocation</h3>
                <p className="text-xs text-foreground-muted mb-4">Change from proportional to optimal allocation</p>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={waterfallData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="name"
                        stroke="var(--foreground-muted)"
                        fontSize={10}
                        tickLine={false}
                        angle={-45}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis
                        stroke="var(--foreground-muted)"
                        fontSize={10}
                        tickFormatter={(v) => formatCurrency(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [
                          formatCurrencyChange(value),
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
                          {formatCurrency(s.total_spend)} → {formatCurrency(s.projected_sales)}
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
