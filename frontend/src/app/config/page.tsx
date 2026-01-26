'use client'

import { CircleHelp, Play, Timer } from 'lucide-react'

export default function ModelConfigPage() {
  return (
    <div className="flex flex-col h-screen">
      <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Model Configuration</h1>
          <span className="text-sm text-foreground-muted">/ Step 4 of 8</span>
        </div>
        <button className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted">
          <CircleHelp className="w-4 h-4" />
          <span className="text-sm">Help</span>
        </button>
      </header>

      <div className="flex-1 p-8 overflow-auto">
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Configure Your Model</h2>
            <p className="text-sm text-foreground-muted mt-1">
              Choose your model type and configure the parameters for training.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-5">
              {/* Model Type */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Model Type</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-card border-2 border-primary cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full border-2 border-primary flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      </div>
                      <span className="font-semibold text-foreground">Log-Log Model</span>
                      <span className="px-2 py-0.5 bg-primary text-white text-[10px] font-medium rounded">Recommended</span>
                    </div>
                    <p className="text-xs text-foreground-muted mt-2">Coefficients represent elasticities directly. Best for interpretability.</p>
                  </div>
                  <div className="p-4 rounded-xl bg-card border border-border cursor-pointer hover:border-primary/50">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 rounded-full border-2 border-border" />
                      <span className="font-semibold text-foreground">Lift-Factor Model</span>
                    </div>
                    <p className="text-xs text-foreground-muted mt-2">Explicit adstock decay estimation. Better for carryover analysis.</p>
                  </div>
                </div>
              </div>

              {/* Seasonality Settings */}
              <div className="p-5 rounded-xl bg-card border border-border space-y-4">
                <h3 className="font-semibold text-foreground">Seasonality Settings</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">Period</span>
                      <span className="text-sm text-primary font-medium">52 weeks</span>
                    </div>
                    <div className="h-1.5 bg-background-secondary rounded-full">
                      <div className="h-full w-3/4 bg-primary rounded-full" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">Fourier Harmonics</span>
                      <span className="text-sm text-primary font-medium">3</span>
                    </div>
                    <div className="h-1.5 bg-background-secondary rounded-full">
                      <div className="h-full w-1/2 bg-primary rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              {/* MCMC Settings */}
              <div className="p-5 rounded-xl bg-card border border-border space-y-4">
                <h3 className="font-semibold text-foreground">MCMC Settings</h3>
                <div className="flex gap-2">
                  <button className="px-4 py-2 bg-background-secondary border border-border rounded-md text-foreground-muted text-sm">Quick</button>
                  <button className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium">Standard</button>
                  <button className="px-4 py-2 bg-background-secondary border border-border rounded-md text-foreground-muted text-sm">Thorough</button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">Draws</span>
                      <span className="text-sm text-primary font-medium">2,000</span>
                    </div>
                    <div className="h-1.5 bg-background-secondary rounded-full">
                      <div className="h-full w-2/5 bg-primary rounded-full" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">Chains</span>
                      <span className="text-sm text-primary font-medium">4</span>
                    </div>
                    <div className="h-1.5 bg-background-secondary rounded-full">
                      <div className="h-full w-1/2 bg-primary rounded-full" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-card border border-border space-y-4">
                <h3 className="font-semibold text-foreground">Configuration Summary</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Model Type', value: 'Log-Log' },
                    { label: 'Seasonality Period', value: '52 weeks' },
                    { label: 'Harmonics', value: '3' },
                    { label: 'MCMC Draws', value: '2,000' },
                    { label: 'Chains', value: '4' },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between">
                      <span className="text-sm text-foreground-muted">{item.label}</span>
                      <span className="text-sm text-foreground font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Timer className="w-4 h-4 text-foreground-muted" />
                      <span className="text-sm text-foreground-muted">Est. Training Time</span>
                    </div>
                    <span className="text-sm text-foreground font-medium">~3-5 min</span>
                  </div>
                </div>
              </div>

              <button className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover transition-colors">
                <Play className="w-4 h-4" />
                Start Training
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
