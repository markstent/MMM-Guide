'use client'

import { CircleHelp, Calendar, Target, Megaphone, SlidersHorizontal, Plus, X, CircleCheck, ArrowRight } from 'lucide-react'

export default function ColumnMappingPage() {
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
                <select className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-foreground">
                  <option>date</option>
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
                <select className="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg text-foreground">
                  <option>sales</option>
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
                  {['tv_spend', 'digital_spend', 'social_spend', 'search_spend'].map((tag) => (
                    <span key={tag} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-white text-xs font-medium rounded-md">
                      {tag}
                      <X className="w-3 h-3" />
                    </span>
                  ))}
                  <button className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-foreground-muted text-xs rounded-md hover:bg-card-hover">
                    <Plus className="w-3 h-3" />
                    Add column
                  </button>
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
                  <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-background-secondary text-foreground text-xs font-medium rounded-md">
                    promo_flag
                    <X className="w-3 h-3 text-foreground-muted" />
                  </span>
                  <button className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border text-foreground-muted text-xs rounded-md hover:bg-card-hover">
                    <Plus className="w-3 h-3" />
                    Add column
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Preview */}
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-card border border-border space-y-4">
                <h3 className="font-semibold text-foreground">Mapping Preview</h3>
                <div className="space-y-3">
                  {[
                    'Date column: date',
                    'Target column: sales',
                    '4 media channels',
                    '1 control variable',
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <CircleCheck className="w-4 h-4 text-success" />
                      <span className="text-sm text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors">
                Continue to Configuration
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
