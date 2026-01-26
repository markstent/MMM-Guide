'use client'

import { CircleHelp, Download, Zap } from 'lucide-react'

const channelData = [
  { name: 'TV', current: 1200000, pct: 42, color: 'var(--chart-1)' },
  { name: 'Digital', current: 890000, pct: 31, color: 'var(--chart-2)' },
  { name: 'Social', current: 450000, pct: 16, color: 'var(--chart-3)' },
  { name: 'Search', current: 320000, pct: 11, color: 'var(--chart-4)' },
]

export default function OptimizationPage() {
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
        <div className="grid grid-cols-3 gap-6 h-full">
          {/* Left Column */}
          <div className="col-span-2 space-y-6">
            {/* Current Budget */}
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <h3 className="font-semibold text-foreground">Current Budget Allocation</h3>
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-foreground-muted">Total Budget</p>
                  <p className="text-2xl font-semibold font-mono text-foreground">$2.86M</p>
                </div>
                <div className="flex-1 h-[150px] flex items-center justify-center">
                  {/* Pie chart placeholder */}
                  <div className="w-[120px] h-[120px] rounded-full border-8 border-chart-1" style={{
                    borderRightColor: 'var(--chart-2)',
                    borderBottomColor: 'var(--chart-3)',
                    borderLeftColor: 'var(--chart-4)',
                  }} />
                </div>
              </div>
              <div className="space-y-2">
                {channelData.map((ch) => (
                  <div key={ch.name} className="flex items-center gap-2 text-sm">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: ch.color }} />
                    <span className="text-foreground font-medium">{ch.name}:</span>
                    <span className="text-foreground-muted">${(ch.current / 1000000).toFixed(2)}M ({ch.pct}%)</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Constraints */}
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Channel Constraints</h3>
                <button className="text-xs text-foreground-muted hover:text-foreground">Reset</button>
              </div>
              <div className="space-y-4">
                {channelData.map((ch) => (
                  <div key={ch.name} className="space-y-2">
                    <span className="text-sm font-medium text-foreground">{ch.name}</span>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="h-1.5 bg-background-secondary rounded-full">
                        <div className="h-full w-1/5 bg-foreground-subtle rounded-full" />
                      </div>
                      <div className="h-1.5 bg-background-secondary rounded-full">
                        <div className="h-full w-1/2 bg-foreground-subtle rounded-full" />
                      </div>
                    </div>
                    <p className="text-xs text-foreground-muted">10% - 50%</p>
                  </div>
                ))}
              </div>
            </div>
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
                  defaultValue="$2,860,000"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="px-4 py-2 border border-border rounded-md text-foreground-muted text-sm hover:bg-card-hover">-10%</button>
                <button className="px-4 py-2 border border-border rounded-md text-foreground-muted text-sm hover:bg-card-hover">+10%</button>
              </div>
              <button className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors">
                <Zap className="w-4 h-4" />
                Optimize Budget
              </button>
            </div>

            {/* Results */}
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <h3 className="font-semibold text-foreground">Optimization Results</h3>
              <div className="p-4 rounded-lg bg-success-muted">
                <p className="text-xl font-semibold text-success">+12.4% Expected Lift</p>
                <p className="text-xs text-foreground-muted mt-1">Projected revenue increase</p>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">Recommended Changes</p>
                {[
                  { name: 'TV', change: '+8%' },
                  { name: 'Digital', change: '+15%' },
                  { name: 'Social', change: '-5%' },
                  { name: 'Search', change: '-3%' },
                ].map((ch) => (
                  <div key={ch.name} className="flex justify-between text-sm">
                    <span className="text-foreground font-medium">{ch.name}</span>
                    <span className={ch.change.startsWith('+') ? 'text-success font-semibold' : 'text-error font-semibold'}>
                      {ch.change}
                    </span>
                  </div>
                ))}
              </div>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-foreground-muted hover:text-foreground hover:bg-card-hover transition-colors">
                <Download className="w-4 h-4" />
                Export Optimized Plan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
