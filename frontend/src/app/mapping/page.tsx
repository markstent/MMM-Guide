'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CircleHelp, Calendar, Target, Megaphone, SlidersHorizontal, Plus, X, CircleCheck, ArrowRight, AlertCircle, Sparkles, Loader2, CheckCircle2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { useAppState } from '@/lib/store'
import { setColumnMapping, getColumnSuggestions, type ColumnSuggestions } from '@/lib/api'

export default function ColumnMappingPage() {
  const router = useRouter()
  const { data, mapping, setMapping, setCurrentStep } = useAppState()

  const [dateCol, setDateCol] = useState<string>('')
  const [targetCol, setTargetCol] = useState<string>('')
  const [mediaCols, setMediaCols] = useState<string[]>([])
  const [controlCols, setControlCols] = useState<string[]>([])
  const [showMediaDropdown, setShowMediaDropdown] = useState(false)
  const [showControlDropdown, setShowControlDropdown] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-suggestion state
  const [suggestions, setSuggestions] = useState<ColumnSuggestions | null>(null)
  const [isAutoDetecting, setIsAutoDetecting] = useState(true)
  const [autoDetectComplete, setAutoDetectComplete] = useState(false)

  // Auto-detect columns when page loads
  useEffect(() => {
    if (data && !autoDetectComplete) {
      autoDetectColumns()
    }
  }, [data])

  const autoDetectColumns = async () => {
    setIsAutoDetecting(true)
    try {
      const result = await getColumnSuggestions()
      if (result.success && result.data) {
        setSuggestions(result.data)

        // Auto-apply suggestions
        if (result.data.date_col) setDateCol(result.data.date_col)
        if (result.data.target_col) setTargetCol(result.data.target_col)
        if (result.data.media_cols.length > 0) setMediaCols(result.data.media_cols)
        if (result.data.control_cols.length > 0) setControlCols(result.data.control_cols)
      } else {
        // Fallback to basic detection from column types
        if (data?.columnTypes.date.length) setDateCol(data.columnTypes.date[0])
        if (data?.columnTypes.potential_target.length) setTargetCol(data.columnTypes.potential_target[0])
        if (data?.columnTypes.potential_media.length) setMediaCols(data.columnTypes.potential_media)
      }
    } catch (err) {
      // Fallback to basic detection
      if (data?.columnTypes.date.length) setDateCol(data.columnTypes.date[0])
      if (data?.columnTypes.potential_target.length) setTargetCol(data.columnTypes.potential_target[0])
      if (data?.columnTypes.potential_media.length) setMediaCols(data.columnTypes.potential_media)
    } finally {
      setIsAutoDetecting(false)
      setAutoDetectComplete(true)
    }
  }

  const availableNumericCols = data?.columnTypes.numeric.filter(
    col => col !== targetCol && !mediaCols.includes(col) && !controlCols.includes(col)
  ) || []

  // Create time series data for KPI preview chart
  const timeSeriesData = (dateCol && targetCol && data?.preview)
    ? data.preview.map(row => ({
        date: row[dateCol],
        value: row[targetCol]
      }))
    : []

  const handleAddMediaCol = (col: string) => {
    setMediaCols([...mediaCols, col])
    setShowMediaDropdown(false)
  }

  const handleRemoveMediaCol = (col: string) => {
    setMediaCols(mediaCols.filter(c => c !== col))
  }

  const handleAddControlCol = (col: string) => {
    setControlCols([...controlCols, col])
    setShowControlDropdown(false)
  }

  const handleRemoveControlCol = (col: string) => {
    setControlCols(controlCols.filter(c => c !== col))
  }

  const isValid = dateCol && targetCol && mediaCols.length > 0

  const handleContinue = async () => {
    if (!isValid) return

    setIsLoading(true)
    setError(null)

    const mappingData = {
      date_col: dateCol,
      target_col: targetCol,
      media_cols: mediaCols,
      control_cols: controlCols,
    }

    const result = await setColumnMapping(mappingData)

    if (result.success) {
      setMapping({
        dateCol,
        targetCol,
        mediaCols,
        controlCols,
      })
      setCurrentStep(4)
      router.push('/config')
    } else {
      setError(result.error || 'Failed to save. Please try again.')
    }

    setIsLoading(false)
  }

  if (!data) {
    return (
      <div className="flex flex-col h-screen">
        <header className="h-16 flex items-center px-8 border-b border-border shrink-0">
          <h1 className="text-xl font-semibold text-foreground">Column Mapping</h1>
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

  return (
    <div className="flex flex-col h-screen">
      <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Column Mapping</h1>
          <span className="text-sm text-foreground-muted">/ Step 3 of 7</span>
        </div>
        <button className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted">
          <CircleHelp className="w-4 h-4" />
          <span className="text-sm">Help</span>
        </button>
      </header>

      <div className="flex-1 p-8 overflow-auto">
        <div className="space-y-6">
          {/* Auto-detection Status */}
          {isAutoDetecting ? (
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <div>
                  <p className="font-medium text-foreground">Analyzing your data...</p>
                  <p className="text-sm text-foreground-muted">We're automatically detecting which columns to use</p>
                </div>
              </div>
            </div>
          ) : autoDetectComplete && suggestions && (
            <div className="p-4 rounded-xl bg-success/5 border border-success/30">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-success" />
                <div>
                  <p className="font-medium text-foreground">We've pre-selected your columns</p>
                  <p className="text-sm text-foreground-muted">
                    Review the selections below and adjust if needed.
                    {suggestions.overall_confidence >= 0.7
                      ? " We're confident these are correct."
                      : " You may need to make some changes."}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold text-foreground">Tell us about your data</h2>
            <p className="text-sm text-foreground-muted mt-1">
              We need to know which columns contain dates, what you're measuring, and your marketing spend.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-error/10 border border-error text-error text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-5">
              {/* Date Column */}
              <div className="p-5 rounded-xl bg-card border border-border space-y-3">
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-foreground">When did it happen?</span>
                  <span className="text-xs text-error font-medium">Required</span>
                </div>
                <p className="text-sm text-foreground-muted">Select the column with your dates (weeks, days, or months)</p>
                <select
                  value={dateCol}
                  onChange={(e) => setDateCol(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-foreground"
                >
                  <option value="">Choose a date column</option>
                  {data.columnTypes.date.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                  {/* Also show all columns in case date wasn't auto-detected */}
                  {data.columnNames.filter(c => !data.columnTypes.date.includes(c)).map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Target Column */}
              <div className="p-5 rounded-xl bg-card border border-border space-y-3">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-success" />
                  <span className="font-semibold text-foreground">What are you trying to measure?</span>
                  <span className="text-xs text-error font-medium">Required</span>
                </div>
                <p className="text-sm text-foreground-muted">This is your goal - usually sales, revenue, conversions, or sign-ups</p>
                <select
                  value={targetCol}
                  onChange={(e) => setTargetCol(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-foreground"
                >
                  <option value="">Choose what you're measuring</option>
                  {data.columnTypes.numeric.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
                {!targetCol && suggestions?.alternatives?.target && suggestions.alternatives.target.length > 0 && (
                  <p className="text-xs text-foreground-muted">
                    Suggestions: {suggestions.alternatives.target.slice(0, 3).join(', ')}
                  </p>
                )}
              </div>

              {/* KPI Preview Chart */}
              {dateCol && targetCol && timeSeriesData.length > 0 && (
                <div className="p-5 rounded-xl bg-card border border-border space-y-3">
                  <div className="flex items-center gap-3">
                    <Target className="w-5 h-5 text-success" />
                    <span className="font-semibold text-foreground">Preview: {targetCol} over time</span>
                  </div>
                  <p className="text-sm text-foreground-muted">Does this look like your KPI data?</p>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }}
                          tickLine={false}
                          axisLine={{ stroke: 'var(--border)' }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--foreground-muted)' }}
                          tickLine={false}
                          axisLine={{ stroke: 'var(--border)' }}
                          tickFormatter={(value) => value.toLocaleString()}
                          width={60}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'var(--card)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            fontSize: '12px'
                          }}
                          labelStyle={{ color: 'var(--foreground)' }}
                          formatter={(value: number) => [value.toLocaleString(), targetCol]}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="var(--success)"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: 'var(--success)' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Media Channels */}
              <div className="p-5 rounded-xl bg-card border border-border space-y-3">
                <div className="flex items-center gap-3">
                  <Megaphone className="w-5 h-5 text-chart-1" />
                  <span className="font-semibold text-foreground">Where are you spending money?</span>
                  <span className="text-xs text-error font-medium">Required</span>
                </div>
                <p className="text-sm text-foreground-muted">Select all your marketing channels - Facebook, Google, TV, etc.</p>
                <div className="flex flex-wrap gap-2">
                  {mediaCols.map((col) => (
                    <span key={col} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-white text-xs font-medium rounded-md">
                      {col}
                      <button onClick={() => handleRemoveMediaCol(col)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  <div className="relative">
                    <button
                      onClick={() => setShowMediaDropdown(!showMediaDropdown)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-foreground-muted text-xs rounded-md hover:bg-card-hover"
                    >
                      <Plus className="w-3 h-3" />
                      Add channel
                    </button>
                    {showMediaDropdown && availableNumericCols.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 w-64 max-h-48 overflow-auto bg-card border border-border rounded-lg shadow-lg z-10">
                        {availableNumericCols.map(col => (
                          <button
                            key={col}
                            onClick={() => handleAddMediaCol(col)}
                            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-card-hover"
                          >
                            {col}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {mediaCols.length === 0 && (
                  <p className="text-xs text-warning">Add at least one marketing channel to continue</p>
                )}
              </div>

              {/* Control Variables */}
              <div className="p-5 rounded-xl bg-card border border-border space-y-3">
                <div className="flex items-center gap-3">
                  <SlidersHorizontal className="w-5 h-5 text-foreground-muted" />
                  <span className="font-semibold text-foreground">What else affects your sales?</span>
                  <span className="text-xs text-foreground-subtle font-medium">Optional</span>
                </div>
                <p className="text-sm text-foreground-muted">
                  Things like price changes, promotions, or seasonality. Skip this if you're not sure.
                </p>
                <div className="flex flex-wrap gap-2">
                  {controlCols.map((col) => (
                    <span key={col} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-background-secondary text-foreground text-xs font-medium rounded-md">
                      {col}
                      <button onClick={() => handleRemoveControlCol(col)}>
                        <X className="w-3 h-3 text-foreground-muted" />
                      </button>
                    </span>
                  ))}
                  <div className="relative">
                    <button
                      onClick={() => setShowControlDropdown(!showControlDropdown)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-foreground-muted text-xs rounded-md hover:bg-card-hover"
                    >
                      <Plus className="w-3 h-3" />
                      Add factor
                    </button>
                    {showControlDropdown && availableNumericCols.length > 0 && (
                      <div className="absolute top-full left-0 mt-1 w-64 max-h-48 overflow-auto bg-card border border-border rounded-lg shadow-lg z-10">
                        {availableNumericCols.map(col => (
                          <button
                            key={col}
                            onClick={() => handleAddControlCol(col)}
                            className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-card-hover"
                          >
                            {col}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-card border border-border space-y-4">
                <h3 className="font-semibold text-foreground">Your Selection</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {dateCol ? (
                      <CircleCheck className="w-4 h-4 text-success" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-border" />
                    )}
                    <span className="text-sm text-foreground">
                      {dateCol ? `Date: ${dateCol}` : <span className="text-foreground-muted">Choose a date column</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {targetCol ? (
                      <CircleCheck className="w-4 h-4 text-success" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-border" />
                    )}
                    <span className="text-sm text-foreground">
                      {targetCol ? `Measuring: ${targetCol}` : <span className="text-foreground-muted">Choose what to measure</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {mediaCols.length > 0 ? (
                      <CircleCheck className="w-4 h-4 text-success" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-border" />
                    )}
                    <span className="text-sm text-foreground">
                      {mediaCols.length > 0
                        ? `${mediaCols.length} marketing channel${mediaCols.length !== 1 ? 's' : ''}`
                        : <span className="text-foreground-muted">Add marketing channels</span>}
                    </span>
                  </div>
                  {controlCols.length > 0 && (
                    <div className="flex items-center gap-3">
                      <CircleCheck className="w-4 h-4 text-foreground-subtle" />
                      <span className="text-sm text-foreground">
                        {controlCols.length} other factor{controlCols.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>

                {isValid && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-sm text-success flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Ready to continue!
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={handleContinue}
                disabled={!isValid || isLoading}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Continue'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
