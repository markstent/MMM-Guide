'use client'

import { Loader, Timer, X } from 'lucide-react'

export default function TrainingPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Model Training</h1>
          <span className="text-sm text-foreground-muted">/ Step 5 of 8</span>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-[600px] space-y-8 text-center">
          {/* Status Icon */}
          <div className="w-[120px] h-[120px] mx-auto rounded-full bg-primary flex items-center justify-center">
            <Loader className="w-12 h-12 text-white animate-spin" />
          </div>

          {/* Status Text */}
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Training in Progress</h2>
            <p className="text-sm text-foreground-muted">Running 4 chains with 2,000 draws each</p>
          </div>

          {/* Progress Card */}
          <div className="p-6 rounded-xl bg-card border border-border space-y-5">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-foreground">Overall Progress</span>
              <span className="font-mono text-lg font-semibold text-primary">67%</span>
            </div>
            <div className="h-2 bg-background-secondary rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-primary rounded-full" />
            </div>

            <div className="space-y-3">
              <span className="text-xs text-foreground-muted">Chain Progress</span>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { name: 'Chain 1', pct: 100, status: 'success' },
                  { name: 'Chain 2', pct: 78, status: 'active' },
                  { name: 'Chain 3', pct: 65, status: 'active' },
                  { name: 'Chain 4', pct: 52, status: 'active' },
                ].map((chain) => (
                  <div key={chain.name} className="p-3 bg-background-secondary rounded-lg space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-foreground font-medium">{chain.name}</span>
                      <span className={chain.status === 'success' ? 'text-success' : 'text-primary'}>
                        {chain.pct}%
                      </span>
                    </div>
                    <div className="h-1 bg-border rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${chain.status === 'success' ? 'bg-success' : 'bg-primary'}`}
                        style={{ width: `${chain.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Time & Cancel */}
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-foreground-muted">
              <Timer className="w-4 h-4" />
              <span className="text-sm">Elapsed: 2m 34s</span>
            </div>
            <button className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-md text-foreground-muted hover:text-foreground hover:bg-card-hover transition-colors">
              <X className="w-3.5 h-3.5" />
              <span className="text-sm">Cancel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
