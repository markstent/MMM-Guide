'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CircleHelp, Calendar, Target, Megaphone, SlidersHorizontal, Plus, X, CircleCheck, ArrowRight, AlertCircle } from 'lucide-react'
import { useAppState } from '@/lib/store'
import { setColumnMapping } from '@/lib/api'

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

  // Initialize from existing mapping or auto-detect
  useEffect(() => {
    if (data) {
      // Try to auto-detect columns
      if (data.columnTypes.date.length > 0) {
        setDateCol(data.columnTypes.date[0])
      }
      if (data.columnTypes.potential_target.length > 0) {
        setTargetCol(data.columnTypes.potential_target[0])
      } else if (data.columnTypes.numeric.length > 0) {
        // Look for common target names
        const targetNames = ['sales', 'revenue', 'conversions', 'purchases', 'first_purchases']
        const found = data.columnTypes.numeric.find(col =>
          targetNames.some(name => col.toLowerCase().includes(name))
        )
        if (found) setTargetCol(found)
      }
      if (data.columnTypes.potential_media.length > 0) {
        setMediaCols(data.columnTypes.potential_media)
      }
    }
  }, [data])

  const availableNumericCols = data?.columnTypes.numeric.filter(
    col => col !== targetCol && !mediaCols.includes(col) && !controlCols.includes(col)
  ) || []

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
      setError(result.error || 'Failed to set mapping')
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
          <span className="text-sm text-foreground-muted">/ Step 3 of 8</span>
        </div>
        <button className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted">
          <CircleHelp className="w-4 h-4" />
          <span className="text-sm">Help</span>
        </button>
      </header>

      <div className="flex-1 p-8 overflow-auto">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Map Your Columns</h2>
            <p className="text-sm text-foreground-muted mt-1">
              Select which columns from your data represent dates, sales targets, and marketing channels.
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
                  <span className="font-semibold text-foreground">Date Column</span>
                  <span className="text-xs text-error font-medium">Required</span>
                </div>
                <p className="text-sm text-foreground-muted">Select the column containing your date/time data.</p>
                <select
                  value={dateCol}
                  onChange={(e) => setDateCol(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-foreground"
                >
                  <option value="">Select a column</option>
                  {data.columnTypes.date.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Target Column */}
              <div className="p-5 rounded-xl bg-card border border-border space-y-3">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-success" />
                  <span className="font-semibold text-foreground">Target / KPI Column</span>
                  <span className="text-xs text-error font-medium">Required</span>
                </div>
                <p className="text-sm text-foreground-muted">Select your dependent variable (e.g., sales, conversions, revenue).</p>
                <select
                  value={targetCol}
                  onChange={(e) => setTargetCol(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-foreground"
                >
                  <option value="">Select a column</option>
                  {data.columnTypes.numeric.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>

              {/* Media Channels */}
              <div className="p-5 rounded-xl bg-card border border-border space-y-3">
                <div className="flex items-center gap-3">
                  <Megaphone className="w-5 h-5 text-chart-1" />
                  <span className="font-semibold text-foreground">Media Spend Columns</span>
                  <span className="text-xs text-error font-medium">Required</span>
                </div>
                <p className="text-sm text-foreground-muted">Select all columns representing marketing channel spend.</p>
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
                      Add column
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
              </div>

              {/* Control Variables */}
              <div className="p-5 rounded-xl bg-card border border-border space-y-3">
                <div className="flex items-center gap-3">
                  <SlidersHorizontal className="w-5 h-5 text-foreground-muted" />
                  <span className="font-semibold text-foreground">Control Variables</span>
                  <span className="text-xs text-foreground-subtle font-medium">Optional</span>
                </div>
                <p className="text-sm text-foreground-muted">Add variables like promotions, seasonality, or external factors.</p>
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
                      Add column
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

            {/* Right Column - Preview */}
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-card border border-border space-y-4">
                <h3 className="font-semibold text-foreground">Mapping Preview</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {dateCol ? (
                      <CircleCheck className="w-4 h-4 text-success" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-border" />
                    )}
                    <span className="text-sm text-foreground">
                      Date column: {dateCol || <span className="text-foreground-muted">Not selected</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {targetCol ? (
                      <CircleCheck className="w-4 h-4 text-success" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-border" />
                    )}
                    <span className="text-sm text-foreground">
                      Target column: {targetCol || <span className="text-foreground-muted">Not selected</span>}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {mediaCols.length > 0 ? (
                      <CircleCheck className="w-4 h-4 text-success" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-border" />
                    )}
                    <span className="text-sm text-foreground">
                      {mediaCols.length} media channel{mediaCols.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CircleCheck className="w-4 h-4 text-foreground-subtle" />
                    <span className="text-sm text-foreground">
                      {controlCols.length} control variable{controlCols.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleContinue}
                disabled={!isValid || isLoading}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Saving...' : 'Continue to Configuration'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
