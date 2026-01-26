'use client'

import { CircleHelp, RotateCcw, Save, Download } from 'lucide-react'

const channels = [
  { name: 'TV', spend: 1200000, change: '+15%', color: 'var(--chart-1)' },
  { name: 'Digital', spend: 890000, change: '+22%', color: 'var(--chart-2)' },
  { name: 'Social', spend: 450000, change: '-8%', color: 'var(--chart-3)' },
  { name: 'Search', spend: 320000, change: '0%', color: 'var(--chart-4)' },
]

export default function ScenariosPage() {
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
        <div className="grid grid-cols-3 gap-6 h-full">
          {/* Left Column */}
          <div className="col-span-2 space-y-6">
            {/* Spend Adjustments */}
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Adjust Channel Spend</h3>
                <button className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-md text-foreground-muted text-xs hover:bg-card-hover">
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
                        <span className="text-sm text-foreground font-medium">${(ch.spend / 1000).toFixed(0)}K</span>
                        <span className={`text-xs font-medium ${ch.change.startsWith('+') ? 'text-success' : ch.change.startsWith('-') ? 'text-error' : 'text-foreground-muted'}`}>
                          {ch.change}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-background-secondary rounded-full">
                      <div
                        className="h-full rounded-full"
                        style={{
                          backgroundColor: ch.color,
                          width: `${(ch.spend / 1500000) * 100}%`,
                        }}
                      />
                    </div>
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
                  <p className="text-xl font-semibold font-mono text-foreground mt-1">$2.86M</p>
                  <p className="text-[11px] text-success mt-1">+8.2% vs current</p>
                </div>
                <div className="p-4 rounded-lg bg-background-secondary">
                  <p className="text-xs text-foreground-muted">Expected Sales</p>
                  <p className="text-xl font-semibold font-mono text-foreground mt-1">$12.4M</p>
                  <p className="text-[11px] text-success mt-1">+5.8% lift</p>
                </div>
                <div className="p-4 rounded-lg bg-background-secondary">
                  <p className="text-xs text-foreground-muted">Expected ROI</p>
                  <p className="text-xl font-semibold font-mono text-foreground mt-1">4.34x</p>
                  <p className="text-[11px] text-error mt-1">-2.1% vs current</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Saved Scenarios */}
            <div className="p-5 rounded-xl bg-card border border-border space-y-4">
              <h3 className="font-semibold text-foreground">Saved Scenarios</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Scenario 2"
                  className="flex-1 px-3.5 py-2.5 bg-background border border-border rounded-lg text-foreground text-sm"
                />
                <button className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium">
                  <Save className="w-3.5 h-3.5" />
                  Save
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 bg-background-secondary rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">Current Baseline</p>
                    <p className="text-[11px] text-foreground-muted">$2.64M spend</p>
                  </div>
                  <span className="font-mono text-sm text-foreground font-medium">$11.7M</span>
                </div>
                <div className="flex items-center justify-between p-3 border border-primary rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-foreground">Aggressive Digital</p>
                    <p className="text-[11px] text-foreground-muted">$2.86M spend</p>
                  </div>
                  <span className="font-mono text-sm text-success font-medium">$12.4M</span>
                </div>
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
