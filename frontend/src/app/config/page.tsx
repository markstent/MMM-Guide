'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleHelp, Play, Timer, AlertCircle } from 'lucide-react'
import { useAppState } from '@/lib/store'
import { setModelConfig } from '@/lib/api'

type McmcPreset = 'quick' | 'standard' | 'thorough'

const mcmcPresets: Record<McmcPreset, { draws: number; tune: number; chains: number }> = {
  quick: { draws: 500, tune: 500, chains: 2 },
  standard: { draws: 2000, tune: 1000, chains: 4 },
  thorough: { draws: 4000, tune: 2000, chains: 4 },
}

export default function ModelConfigPage() {
  const router = useRouter()
  const { data, mapping, modelConfig, setModelConfig: setConfig, setCurrentStep, setIsTraining } = useAppState()

  const [modelType, setModelType] = useState<'loglog' | 'lift'>(modelConfig.modelType)
  const [seasonalityPeriod, setSeasonalityPeriod] = useState(modelConfig.seasonalityPeriod)
  const [fourierHarmonics, setFourierHarmonics] = useState(modelConfig.fourierHarmonics)
  const [mcmcPreset, setMcmcPreset] = useState<McmcPreset>('standard')
  const [mcmcDraws, setMcmcDraws] = useState(modelConfig.mcmcDraws)
  const [mcmcTune, setMcmcTune] = useState(modelConfig.mcmcTune)
  const [mcmcChains, setMcmcChains] = useState(modelConfig.mcmcChains)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePresetChange = (preset: McmcPreset) => {
    setMcmcPreset(preset)
    const config = mcmcPresets[preset]
    setMcmcDraws(config.draws)
    setMcmcTune(config.tune)
    setMcmcChains(config.chains)
  }

  const estimatedTime = () => {
    const totalSamples = mcmcDraws * mcmcChains
    if (totalSamples < 2000) return '~1-2 min'
    if (totalSamples < 8000) return '~3-5 min'
    return '~8-15 min'
  }

  const handleStartTraining = async () => {
    setIsLoading(true)
    setError(null)

    const config = {
      model_type: modelType,
      seasonality_period: seasonalityPeriod,
      fourier_harmonics: fourierHarmonics,
      mcmc_draws: mcmcDraws,
      mcmc_tune: mcmcTune,
      mcmc_chains: mcmcChains,
    }

    const result = await setModelConfig(config)

    if (result.success) {
      setConfig({
        modelType,
        seasonalityPeriod,
        fourierHarmonics,
        mcmcDraws,
        mcmcTune,
        mcmcChains,
      })
      setCurrentStep(5)
      setIsTraining(true)
      router.push('/training')
    } else {
      setError(result.error || 'Failed to set configuration')
      setIsLoading(false)
    }
  }

  if (!data || !mapping.dateCol) {
    return (
      <div className="flex flex-col h-screen">
        <header className="h-16 flex items-center px-8 border-b border-border shrink-0">
          <h1 className="text-xl font-semibold text-foreground">Model Configuration</h1>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <AlertCircle className="w-12 h-12 text-foreground-muted mx-auto" />
            <p className="text-foreground-muted">Please complete column mapping first</p>
            <button
              onClick={() => router.push('/mapping')}
              className="px-4 py-2 bg-primary text-white rounded-lg"
            >
              Go to Mapping
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

          {error && (
            <div className="p-4 rounded-lg bg-error/10 border border-error text-error text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-5">
              {/* Model Type */}
              <div className="space-y-3">
                <h3 className="font-semibold text-foreground">Model Type</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setModelType('loglog')}
                    className={`p-4 rounded-xl bg-card border-2 cursor-pointer text-left transition-colors ${
                      modelType === 'loglog' ? 'border-primary' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        modelType === 'loglog' ? 'border-primary' : 'border-border'
                      }`}>
                        {modelType === 'loglog' && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <span className="font-semibold text-foreground">Log-Log Model</span>
                      <span className="px-2 py-0.5 bg-primary text-white text-[10px] font-medium rounded">Recommended</span>
                    </div>
                    <p className="text-xs text-foreground-muted mt-2">Coefficients represent elasticities directly. Best for interpretability.</p>
                  </button>
                  <button
                    onClick={() => setModelType('lift')}
                    className={`p-4 rounded-xl bg-card border-2 cursor-pointer text-left transition-colors ${
                      modelType === 'lift' ? 'border-primary' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        modelType === 'lift' ? 'border-primary' : 'border-border'
                      }`}>
                        {modelType === 'lift' && <div className="w-2 h-2 rounded-full bg-primary" />}
                      </div>
                      <span className="font-semibold text-foreground">Lift-Factor Model</span>
                    </div>
                    <p className="text-xs text-foreground-muted mt-2">Explicit adstock decay estimation. Better for carryover analysis.</p>
                  </button>
                </div>
              </div>

              {/* Seasonality Settings */}
              <div className="p-5 rounded-xl bg-card border border-border space-y-4">
                <h3 className="font-semibold text-foreground">Seasonality Settings</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">Period (weeks)</span>
                      <span className="text-sm text-primary font-medium">{seasonalityPeriod}</span>
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="104"
                      value={seasonalityPeriod}
                      onChange={(e) => setSeasonalityPeriod(Number(e.target.value))}
                      className="w-full h-1.5 bg-background-secondary rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">Fourier Harmonics</span>
                      <span className="text-sm text-primary font-medium">{fourierHarmonics}</span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="6"
                      value={fourierHarmonics}
                      onChange={(e) => setFourierHarmonics(Number(e.target.value))}
                      className="w-full h-1.5 bg-background-secondary rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                </div>
              </div>

              {/* MCMC Settings */}
              <div className="p-5 rounded-xl bg-card border border-border space-y-4">
                <h3 className="font-semibold text-foreground">MCMC Settings</h3>
                <div className="flex gap-2">
                  {(['quick', 'standard', 'thorough'] as McmcPreset[]).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handlePresetChange(preset)}
                      className={`px-4 py-2 rounded-md text-sm capitalize transition-colors ${
                        mcmcPreset === preset
                          ? 'bg-primary text-white font-medium'
                          : 'bg-background-secondary border border-border text-foreground-muted hover:bg-card-hover'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">Draws</span>
                      <span className="text-sm text-primary font-medium">{mcmcDraws.toLocaleString()}</span>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="5000"
                      step="500"
                      value={mcmcDraws}
                      onChange={(e) => setMcmcDraws(Number(e.target.value))}
                      className="w-full h-1.5 bg-background-secondary rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-foreground">Chains</span>
                      <span className="text-sm text-primary font-medium">{mcmcChains}</span>
                    </div>
                    <input
                      type="range"
                      min="2"
                      max="8"
                      value={mcmcChains}
                      onChange={(e) => setMcmcChains(Number(e.target.value))}
                      className="w-full h-1.5 bg-background-secondary rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-card border border-border space-y-4">
                <h3 className="font-semibold text-foreground">Configuration Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-foreground-muted">Model Type</span>
                    <span className="text-sm text-foreground font-medium">
                      {modelType === 'loglog' ? 'Log-Log' : 'Lift-Factor'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-foreground-muted">Seasonality Period</span>
                    <span className="text-sm text-foreground font-medium">{seasonalityPeriod} weeks</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-foreground-muted">Harmonics</span>
                    <span className="text-sm text-foreground font-medium">{fourierHarmonics}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-foreground-muted">MCMC Draws</span>
                    <span className="text-sm text-foreground font-medium">{mcmcDraws.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-foreground-muted">Chains</span>
                    <span className="text-sm text-foreground font-medium">{mcmcChains}</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Timer className="w-4 h-4 text-foreground-muted" />
                      <span className="text-sm text-foreground-muted">Est. Training Time</span>
                    </div>
                    <span className="text-sm text-foreground font-medium">{estimatedTime()}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleStartTraining}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-primary text-white font-semibold rounded-lg hover:bg-primary-hover transition-colors disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                {isLoading ? 'Saving...' : 'Start Training'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
