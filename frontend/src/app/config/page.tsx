'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Play, Timer, AlertCircle, ChevronDown, ChevronRight,
  Plus, X, Calendar, TrendingUp, Sliders, Settings2, CircleHelp
} from 'lucide-react'
import { useAppState, CustomEvent } from '@/lib/store'
import { setModelConfig, ModelConfig } from '@/lib/api'

type McmcPreset = 'quick' | 'standard' | 'thorough'
type PriorPreset = 'uninformed' | 'industry' | 'conservative' | 'custom'

const mcmcPresets: Record<McmcPreset, { draws: number; tune: number; chains: number }> = {
  quick: { draws: 500, tune: 500, chains: 2 },
  standard: { draws: 2000, tune: 1000, chains: 4 },
  thorough: { draws: 4000, tune: 2000, chains: 4 },
}

const priorPresets: Record<PriorPreset, { sigma: number; description: string }> = {
  uninformed: { sigma: 1.0, description: 'Wide priors - let data decide' },
  industry: { sigma: 0.3, description: 'Typical MMM values from literature' },
  conservative: { sigma: 0.15, description: 'Expect lower elasticities' },
  custom: { sigma: 0.3, description: 'Full manual control' },
}

export default function ModelConfigPage() {
  const router = useRouter()
  const { data, mapping, modelConfig, setModelConfig: setConfig, setCurrentStep, setIsTraining } = useAppState()

  // Basic config
  const [modelType, setModelType] = useState<'loglog' | 'lift'>(modelConfig.modelType)
  const [seasonalityPeriod, setSeasonalityPeriod] = useState(modelConfig.seasonalityPeriod)
  const [fourierHarmonics, setFourierHarmonics] = useState(modelConfig.fourierHarmonics)
  const [seasonalityEnabled, setSeasonalityEnabled] = useState(modelConfig.seasonalityEnabled)
  const [trendType, setTrendType] = useState<'none' | 'linear' | 'log' | 'quadratic'>(modelConfig.trendType)

  // MCMC config
  const [mcmcPreset, setMcmcPreset] = useState<McmcPreset>('standard')
  const [mcmcDraws, setMcmcDraws] = useState(modelConfig.mcmcDraws)
  const [mcmcTune, setMcmcTune] = useState(modelConfig.mcmcTune)
  const [mcmcChains, setMcmcChains] = useState(modelConfig.mcmcChains)

  // Extended config
  const [priorPreset, setPriorPreset] = useState<PriorPreset>('industry')
  const [adstockConfig, setAdstockConfig] = useState<Record<string, { enabled: boolean; decayRate: number; maxCarryover: number }>>(
    modelConfig.adstockConfig || {}
  )
  const [saturationConfig, setSaturationConfig] = useState<Record<string, { enabled: boolean; K: number; S: number }>>(
    modelConfig.saturationConfig || {}
  )
  const [priorConfig, setPriorConfig] = useState<Record<string, { sigma: number }>>(
    {}
  )
  const [customEvents, setCustomEvents] = useState<CustomEvent[]>(modelConfig.customEvents || [])
  const [holdoutWeeks, setHoldoutWeeks] = useState(modelConfig.holdoutWeeks)
  const [useControls, setUseControls] = useState(modelConfig.useControls)

  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['model', 'mcmc']))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // New event form
  const [newEventName, setNewEventName] = useState('')
  const [newEventStart, setNewEventStart] = useState('')
  const [newEventEnd, setNewEventEnd] = useState('')

  // Initialize channel configs when media cols change
  useEffect(() => {
    if (mapping.mediaCols.length > 0) {
      const newAdstock: Record<string, { enabled: boolean; decayRate: number; maxCarryover: number }> = {}
      const newSaturation: Record<string, { enabled: boolean; K: number; S: number }> = {}
      const newPrior: Record<string, { sigma: number }> = {}

      mapping.mediaCols.forEach(col => {
        newAdstock[col] = adstockConfig[col] || { enabled: true, decayRate: 0.3, maxCarryover: 8 }
        newSaturation[col] = saturationConfig[col] || { enabled: true, K: 50000, S: 1.5 }
        newPrior[col] = priorConfig[col] || { sigma: priorPresets[priorPreset].sigma }
      })

      setAdstockConfig(newAdstock)
      setSaturationConfig(newSaturation)
      setPriorConfig(newPrior)
    }
  }, [mapping.mediaCols])

  // Update priors when preset changes
  useEffect(() => {
    if (priorPreset !== 'custom') {
      const newPrior: Record<string, { sigma: number }> = {}
      mapping.mediaCols.forEach(col => {
        newPrior[col] = { sigma: priorPresets[priorPreset].sigma }
      })
      setPriorConfig(newPrior)
    }
  }, [priorPreset, mapping.mediaCols])

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

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

  const handleAddEvent = () => {
    if (newEventName && newEventStart && newEventEnd) {
      setCustomEvents([...customEvents, {
        name: newEventName,
        startDate: newEventStart,
        endDate: newEventEnd,
        effectType: 'additive'
      }])
      setNewEventName('')
      setNewEventStart('')
      setNewEventEnd('')
    }
  }

  const handleRemoveEvent = (index: number) => {
    setCustomEvents(customEvents.filter((_, i) => i !== index))
  }

  const handleStartTraining = async () => {
    setIsLoading(true)
    setError(null)

    // Convert frontend state to API format
    const apiAdstockConfig: Record<string, { enabled: boolean; decay_rate: number; max_carryover: number }> = {}
    const apiSaturationConfig: Record<string, { enabled: boolean; K: number; S: number }> = {}
    const apiPriorConfig: Record<string, { prior_type: string; sigma: number; lower_bound: number; upper_bound: number }> = {}

    Object.entries(adstockConfig).forEach(([col, config]) => {
      apiAdstockConfig[col] = {
        enabled: config.enabled,
        decay_rate: config.decayRate,
        max_carryover: config.maxCarryover
      }
    })

    Object.entries(saturationConfig).forEach(([col, config]) => {
      apiSaturationConfig[col] = config
    })

    Object.entries(priorConfig).forEach(([col, config]) => {
      apiPriorConfig[col] = {
        prior_type: 'halfnormal',
        sigma: config.sigma,
        lower_bound: 0,
        upper_bound: 2
      }
    })

    const config: ModelConfig = {
      model_type: modelType,
      seasonality_period: seasonalityPeriod,
      fourier_harmonics: fourierHarmonics,
      mcmc_draws: mcmcDraws,
      mcmc_tune: mcmcTune,
      mcmc_chains: mcmcChains,
      trend_type: trendType,
      seasonality_enabled: seasonalityEnabled,
      adstock_config: apiAdstockConfig,
      saturation_config: apiSaturationConfig,
      prior_config: apiPriorConfig,
      custom_events: customEvents.map(e => ({
        name: e.name,
        start_date: e.startDate,
        end_date: e.endDate,
        effect_type: e.effectType
      })),
      holdout_weeks: holdoutWeeks,
      use_controls: useControls,
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
        trendType,
        seasonalityEnabled,
        adstockConfig,
        saturationConfig,
        priorConfig: {},
        customEvents,
        holdoutWeeks,
        useControls,
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
          <span className="text-sm text-foreground-muted">/ Step 4 of 7</span>
        </div>
        <button className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted">
          <CircleHelp className="w-4 h-4" />
          <span className="text-sm">Help</span>
        </button>
      </header>

      <div className="flex-1 p-8 overflow-auto">
        <div className="space-y-6">
          {error && (
            <div className="p-4 rounded-lg bg-error/10 border border-error text-error text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              {/* Model Type Section */}
              <div className="rounded-xl bg-card border border-border overflow-hidden">
                <button
                  onClick={() => toggleSection('model')}
                  className="w-full p-4 flex items-center justify-between hover:bg-card-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Settings2 className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-foreground">Model Type & Seasonality</span>
                  </div>
                  {expandedSections.has('model') ? <ChevronDown className="w-5 h-5 text-foreground-muted" /> : <ChevronRight className="w-5 h-5 text-foreground-muted" />}
                </button>
                {expandedSections.has('model') && (
                  <div className="p-4 pt-0 space-y-4 border-t border-border">
                    {/* Model Type */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setModelType('loglog')}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          modelType === 'loglog' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full border-2 ${modelType === 'loglog' ? 'border-primary bg-primary' : 'border-border'}`} />
                          <span className="font-medium text-foreground">Log-Log Model</span>
                          <span className="px-1.5 py-0.5 bg-primary text-white text-[10px] font-medium rounded">Recommended</span>
                        </div>
                        <p className="text-[11px] text-foreground-muted/70 mt-1 ml-5">Coefficients are elasticities (% change in sales per 1% change in spend). Best for most use cases.</p>
                      </button>
                      <button
                        onClick={() => setModelType('lift')}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${
                          modelType === 'lift' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full border-2 ${modelType === 'lift' ? 'border-primary bg-primary' : 'border-border'}`} />
                          <span className="font-medium text-foreground">Lift-Factor Model</span>
                        </div>
                        <p className="text-[11px] text-foreground-muted/70 mt-1 ml-5">Explicitly estimates decay rate. Better for understanding how long ads continue to impact sales.</p>
                      </button>
                    </div>

                    {/* Trend Type */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Trend Type</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setTrendType('none')}
                          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                            trendType === 'none'
                              ? 'bg-primary text-white'
                              : 'bg-background-secondary text-foreground-muted hover:text-foreground'
                          }`}
                        >
                          None
                        </button>
                        <button
                          onClick={() => setTrendType('linear')}
                          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                            trendType === 'linear'
                              ? 'bg-primary text-white'
                              : 'bg-background-secondary text-foreground-muted hover:text-foreground'
                          }`}
                        >
                          Linear
                        </button>
                        <button
                          onClick={() => setTrendType('log')}
                          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                            trendType === 'log'
                              ? 'bg-primary text-white'
                              : 'bg-background-secondary text-foreground-muted hover:text-foreground'
                          }`}
                        >
                          Log
                        </button>
                        <button
                          onClick={() => setTrendType('quadratic')}
                          className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                            trendType === 'quadratic'
                              ? 'bg-primary text-white'
                              : 'bg-background-secondary text-foreground-muted hover:text-foreground'
                          }`}
                        >
                          Quadratic
                        </button>
                      </div>
                      <p className="text-[11px] text-foreground-muted/70">None = flat baseline. Linear = gradual growth/decline. Log = diminishing growth. Quadratic = accelerating change.</p>
                    </div>

                    {/* Seasonality */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-foreground">Seasonality</label>
                        <button
                          onClick={() => setSeasonalityEnabled(!seasonalityEnabled)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            seasonalityEnabled ? 'bg-primary' : 'bg-background-secondary'
                          }`}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            seasonalityEnabled ? 'translate-x-5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>
                      {seasonalityEnabled && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-foreground-muted">Period (weeks)</span>
                              <span className="text-primary font-medium">{seasonalityPeriod}</span>
                            </div>
                            <input
                              type="range"
                              min="4"
                              max="104"
                              value={seasonalityPeriod}
                              onChange={(e) => setSeasonalityPeriod(Number(e.target.value))}
                              className="w-full h-1.5 bg-background-secondary rounded-full appearance-none cursor-pointer accent-primary"
                            />
                            <p className="text-[11px] text-foreground-muted/70">Weeks per cycle. Use 52 for annual, 12 for quarterly, 4 for monthly patterns.</p>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-foreground-muted">Harmonics</span>
                              <span className="text-primary font-medium">{fourierHarmonics}</span>
                            </div>
                            <input
                              type="range"
                              min="1"
                              max="6"
                              value={fourierHarmonics}
                              onChange={(e) => setFourierHarmonics(Number(e.target.value))}
                              className="w-full h-1.5 bg-background-secondary rounded-full appearance-none cursor-pointer accent-primary"
                            />
                            <p className="text-[11px] text-foreground-muted/70">Complexity of seasonal pattern. 2-3 for simple, 4-6 for complex patterns.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Adstock & Saturation Section */}
              <div className="rounded-xl bg-card border border-border overflow-hidden">
                <button
                  onClick={() => toggleSection('transforms')}
                  className="w-full p-4 flex items-center justify-between hover:bg-card-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-chart-1" />
                    <span className="font-semibold text-foreground">Adstock & Saturation</span>
                    <span className="text-xs text-foreground-muted">per channel</span>
                  </div>
                  {expandedSections.has('transforms') ? <ChevronDown className="w-5 h-5 text-foreground-muted" /> : <ChevronRight className="w-5 h-5 text-foreground-muted" />}
                </button>
                {expandedSections.has('transforms') && (
                  <div className="p-4 pt-0 space-y-4 border-t border-border max-h-[400px] overflow-auto">
                    {mapping.mediaCols.map(col => (
                      <div key={col} className="p-3 rounded-lg bg-background-secondary space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground text-sm">{col}</span>
                        </div>

                        {/* Adstock */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-foreground-muted">Adstock Decay</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-primary">{adstockConfig[col]?.decayRate.toFixed(2) || 0.3}</span>
                              <button
                                onClick={() => setAdstockConfig({
                                  ...adstockConfig,
                                  [col]: { ...adstockConfig[col], enabled: !adstockConfig[col]?.enabled }
                                })}
                                className={`w-8 h-4 rounded-full transition-colors ${
                                  adstockConfig[col]?.enabled ? 'bg-primary' : 'bg-border'
                                }`}
                              >
                                <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${
                                  adstockConfig[col]?.enabled ? 'translate-x-4' : 'translate-x-0.5'
                                }`} />
                              </button>
                            </div>
                          </div>
                          {adstockConfig[col]?.enabled && (
                            <>
                              <input
                                type="range"
                                min="0.1"
                                max="0.9"
                                step="0.05"
                                value={adstockConfig[col]?.decayRate || 0.3}
                                onChange={(e) => setAdstockConfig({
                                  ...adstockConfig,
                                  [col]: { ...adstockConfig[col], decayRate: Number(e.target.value) }
                                })}
                                className="w-full h-1 bg-card rounded-full appearance-none cursor-pointer accent-primary"
                              />
                              <p className="text-[10px] text-foreground-muted/70">How fast ad effects fade. 0.1-0.3 = fast (digital). 0.4-0.7 = slow (TV, brand).</p>
                            </>
                          )}
                        </div>

                        {/* Saturation */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-foreground-muted">Saturation (Hill)</span>
                            <button
                              onClick={() => setSaturationConfig({
                                ...saturationConfig,
                                [col]: { ...saturationConfig[col], enabled: !saturationConfig[col]?.enabled }
                              })}
                              className={`w-8 h-4 rounded-full transition-colors ${
                                saturationConfig[col]?.enabled ? 'bg-primary' : 'bg-border'
                              }`}
                            >
                              <div className={`w-3 h-3 rounded-full bg-white shadow transition-transform ${
                                saturationConfig[col]?.enabled ? 'translate-x-4' : 'translate-x-0.5'
                              }`} />
                            </button>
                          </div>
                          {saturationConfig[col]?.enabled && (
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[10px] text-foreground-muted">K (half-sat)</label>
                                <input
                                  type="number"
                                  value={saturationConfig[col]?.K || 50000}
                                  onChange={(e) => setSaturationConfig({
                                    ...saturationConfig,
                                    [col]: { ...saturationConfig[col], K: Number(e.target.value) }
                                  })}
                                  className="w-full px-2 py-1 text-xs bg-card border border-border rounded"
                                />
                                <p className="text-[10px] text-foreground-muted/70">50% effect point. Set near average spend.</p>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] text-foreground-muted">S (shape)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0.5"
                                  max="5"
                                  value={saturationConfig[col]?.S || 1.5}
                                  onChange={(e) => setSaturationConfig({
                                    ...saturationConfig,
                                    [col]: { ...saturationConfig[col], S: Number(e.target.value) }
                                  })}
                                  className="w-full px-2 py-1 text-xs bg-card border border-border rounded"
                                />
                                <p className="text-[10px] text-foreground-muted/70">1.0 = gradual. 2.0+ = sharp plateau.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Priors Section */}
              <div className="rounded-xl bg-card border border-border overflow-hidden">
                <button
                  onClick={() => toggleSection('priors')}
                  className="w-full p-4 flex items-center justify-between hover:bg-card-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Sliders className="w-5 h-5 text-chart-2" />
                    <span className="font-semibold text-foreground">Prior Configuration</span>
                  </div>
                  {expandedSections.has('priors') ? <ChevronDown className="w-5 h-5 text-foreground-muted" /> : <ChevronRight className="w-5 h-5 text-foreground-muted" />}
                </button>
                {expandedSections.has('priors') && (
                  <div className="p-4 pt-0 space-y-4 border-t border-border">
                    {/* Prior Presets */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Prior Preset</label>
                      <p className="text-[11px] text-foreground-muted/70">Priors use a Half-Normal distribution (positive elasticities only). Sigma controls how spread out the distribution is.</p>
                      <div className="grid grid-cols-4 gap-2">
                        <button
                          onClick={() => setPriorPreset('uninformed')}
                          className={`p-2 text-xs rounded-lg border transition-colors ${
                            priorPreset === 'uninformed'
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border text-foreground-muted hover:border-primary/50'
                          }`}
                        >
                          <span className="capitalize font-medium">Uninformed</span>
                          <p className="text-[10px] text-foreground-muted/70 mt-0.5">sigma=1.0 - let data decide</p>
                        </button>
                        <button
                          onClick={() => setPriorPreset('industry')}
                          className={`p-2 text-xs rounded-lg border transition-colors ${
                            priorPreset === 'industry'
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border text-foreground-muted hover:border-primary/50'
                          }`}
                        >
                          <span className="capitalize font-medium">Industry</span>
                          <p className="text-[10px] text-foreground-muted/70 mt-0.5">sigma=0.3 - good default</p>
                        </button>
                        <button
                          onClick={() => setPriorPreset('conservative')}
                          className={`p-2 text-xs rounded-lg border transition-colors ${
                            priorPreset === 'conservative'
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border text-foreground-muted hover:border-primary/50'
                          }`}
                        >
                          <span className="capitalize font-medium">Conservative</span>
                          <p className="text-[10px] text-foreground-muted/70 mt-0.5">sigma=0.15 - expect small effects</p>
                        </button>
                        <button
                          onClick={() => setPriorPreset('custom')}
                          className={`p-2 text-xs rounded-lg border transition-colors ${
                            priorPreset === 'custom'
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border text-foreground-muted hover:border-primary/50'
                          }`}
                        >
                          <span className="capitalize font-medium">Custom</span>
                          <p className="text-[10px] text-foreground-muted/70 mt-0.5">Set per-channel values</p>
                        </button>
                      </div>
                    </div>

                    {priorPreset === 'custom' && (
                      <div className="space-y-2">
                        <label className="text-sm text-foreground-muted">Per-Channel Elasticity Prior (sigma)</label>
                        <p className="text-[11px] text-foreground-muted/70">Smaller sigma (0.1-0.2) = expect small effects. Larger (0.5-1.0) = uncertain.</p>
                        {mapping.mediaCols.map(col => (
                          <div key={col} className="flex items-center justify-between p-2 bg-background-secondary rounded">
                            <span className="text-sm text-foreground">{col}</span>
                            <input
                              type="number"
                              step="0.05"
                              min="0.05"
                              max="2"
                              value={priorConfig[col]?.sigma || 0.3}
                              onChange={(e) => setPriorConfig({
                                ...priorConfig,
                                [col]: { sigma: Number(e.target.value) }
                              })}
                              className="w-20 px-2 py-1 text-sm bg-card border border-border rounded text-right font-mono"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Custom Events & External Factors Section */}
              <div className="rounded-xl bg-card border border-border overflow-hidden">
                <button
                  onClick={() => toggleSection('events')}
                  className="w-full p-4 flex items-center justify-between hover:bg-card-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-chart-3" />
                    <span className="font-semibold text-foreground">Holidays & External Factors</span>
                    {customEvents.length > 0 && (
                      <span className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded-full">{customEvents.length}</span>
                    )}
                  </div>
                  {expandedSections.has('events') ? <ChevronDown className="w-5 h-5 text-foreground-muted" /> : <ChevronRight className="w-5 h-5 text-foreground-muted" />}
                </button>
                {expandedSections.has('events') && (
                  <div className="p-4 pt-0 space-y-4 border-t border-border">
                    <p className="text-[11px] text-foreground-muted/70">
                      Events affect sales independently of media. Include holidays, promotions, or external factors as control variables.
                    </p>

                    {/* COVID Quick Add */}
                    <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg space-y-2">
                      <p className="text-xs text-warning"><strong>Tip:</strong> If your data spans 2020-2022, add COVID events to account for pandemic effects on sales.</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { name: 'COVID_Wave1', label: 'Wave 1 (Mar-Jun 2020)', startDate: '2020-03-15', endDate: '2020-06-01' },
                          { name: 'COVID_Wave2', label: 'Wave 2 (Oct 2020-Feb 2021)', startDate: '2020-10-01', endDate: '2021-02-28' },
                          { name: 'COVID_Delta', label: 'Delta (Jul-Sep 2021)', startDate: '2021-07-01', endDate: '2021-09-30' },
                          { name: 'COVID_Omicron', label: 'Omicron (Dec 2021-Feb 2022)', startDate: '2021-12-01', endDate: '2022-02-28' },
                        ].map((covid) => (
                          <button
                            key={covid.name}
                            onClick={() => {
                              if (!customEvents.find(e => e.name === covid.name)) {
                                setCustomEvents([...customEvents, {
                                  name: covid.name,
                                  startDate: covid.startDate,
                                  endDate: covid.endDate,
                                  effectType: 'additive'
                                }])
                              }
                            }}
                            disabled={customEvents.some(e => e.name === covid.name)}
                            className="px-2 py-1 text-xs bg-warning/20 text-warning rounded hover:bg-warning/30 transition-colors disabled:opacity-50"
                          >
                            + {covid.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Quick Add Presets */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-foreground-muted">Quick Add Common Holidays:</p>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { name: 'Christmas', start: '-12-20', end: '-12-26' },
                          { name: 'Thanksgiving', start: '-11-22', end: '-11-24' },
                          { name: 'Black Friday', start: '-11-25', end: '-11-28' },
                          { name: 'New Year', start: '-12-31', end: '-01-02' },
                          { name: 'Easter', start: '-04-07', end: '-04-10' },
                          { name: 'Summer Sale', start: '-07-01', end: '-07-15' },
                          { name: 'Back to School', start: '-08-15', end: '-09-15' },
                        ].map((preset) => (
                          <button
                            key={preset.name}
                            onClick={() => {
                              const year = new Date().getFullYear()
                              const startYear = preset.start.includes('-01-') ? year + 1 : year
                              setCustomEvents([...customEvents, {
                                name: preset.name,
                                startDate: `${startYear}${preset.start}`,
                                endDate: `${preset.end.includes('-01-') ? year + 1 : year}${preset.end}`,
                                effectType: 'additive'
                              }])
                            }}
                            disabled={customEvents.some(e => e.name === preset.name)}
                            className="px-2 py-1 text-xs bg-background-secondary border border-border rounded hover:bg-card-hover transition-colors disabled:opacity-50"
                          >
                            + {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Event List */}
                    {customEvents.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground-muted">Added Events:</p>
                        {customEvents.map((event, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-background-secondary rounded">
                            <div>
                              <span className="text-sm font-medium text-foreground">{event.name}</span>
                              <span className="text-xs text-foreground-muted ml-2">
                                {event.startDate} to {event.endDate}
                              </span>
                              <span className={`text-xs ml-2 px-1.5 py-0.5 rounded ${
                                event.effectType === 'multiplicative' ? 'bg-chart-2/20 text-chart-2' : 'bg-chart-1/20 text-chart-1'
                              }`}>
                                {event.effectType}
                              </span>
                            </div>
                            <button onClick={() => handleRemoveEvent(i)} className="text-error hover:text-error/80">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add Custom Event Form */}
                    <div className="space-y-2 pt-2 border-t border-border">
                      <p className="text-xs font-medium text-foreground-muted">Add Custom Event:</p>
                      <div className="grid grid-cols-5 gap-2">
                        <input
                          type="text"
                          placeholder="Event name (e.g., TV Campaign)"
                          value={newEventName}
                          onChange={(e) => setNewEventName(e.target.value)}
                          className="col-span-2 px-3 py-2 text-sm bg-background border border-border rounded"
                        />
                        <input
                          type="date"
                          value={newEventStart}
                          onChange={(e) => setNewEventStart(e.target.value)}
                          className="px-3 py-2 text-sm bg-background border border-border rounded"
                        />
                        <input
                          type="date"
                          value={newEventEnd}
                          onChange={(e) => setNewEventEnd(e.target.value)}
                          className="px-3 py-2 text-sm bg-background border border-border rounded"
                        />
                        <button
                          onClick={handleAddEvent}
                          disabled={!newEventName || !newEventStart || !newEventEnd}
                          className="flex items-center justify-center gap-1 px-3 py-2 bg-primary text-white text-sm rounded disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                      <p className="text-xs text-foreground-muted">
                        Examples: Competitor promotion, price change, weather event, economic announcement, store opening
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* MCMC Settings */}
              <div className="rounded-xl bg-card border border-border overflow-hidden">
                <button
                  onClick={() => toggleSection('mcmc')}
                  className="w-full p-4 flex items-center justify-between hover:bg-card-hover transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Timer className="w-5 h-5 text-chart-4" />
                    <span className="font-semibold text-foreground">MCMC Settings</span>
                  </div>
                  {expandedSections.has('mcmc') ? <ChevronDown className="w-5 h-5 text-foreground-muted" /> : <ChevronRight className="w-5 h-5 text-foreground-muted" />}
                </button>
                {expandedSections.has('mcmc') && (
                  <div className="p-4 pt-0 space-y-4 border-t border-border">
                    {/* Presets */}
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

                    {/* Sliders */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground-muted">Draws</span>
                          <span className="text-primary font-medium">{mcmcDraws.toLocaleString()}</span>
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
                        <p className="text-[11px] text-foreground-muted/70">Samples per chain. 500 = quick test. 2000 = production. 4000+ = publication.</p>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground-muted">Chains</span>
                          <span className="text-primary font-medium">{mcmcChains}</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="8"
                          value={mcmcChains}
                          onChange={(e) => setMcmcChains(Number(e.target.value))}
                          className="w-full h-1.5 bg-background-secondary rounded-full appearance-none cursor-pointer accent-primary"
                        />
                        <p className="text-[11px] text-foreground-muted/70">Independent samplers. More = better convergence check. 2 for testing, 4 for production.</p>
                      </div>
                    </div>

                    {/* Holdout & Controls */}
                    <div className="pt-3 border-t border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <span className="text-sm font-medium text-foreground">Holdout Validation</span>
                          <p className="text-[11px] text-foreground-muted/70">Reserve recent weeks for testing. Model trains without this data, then we check prediction accuracy.</p>
                        </div>
                        <select
                          value={holdoutWeeks}
                          onChange={(e) => setHoldoutWeeks(Number(e.target.value))}
                          className="px-3 py-1.5 text-sm bg-background border border-border rounded"
                        >
                          <option value={0}>None</option>
                          <option value={4}>4 weeks</option>
                          <option value={8}>8 weeks</option>
                          <option value={12}>12 weeks</option>
                        </select>
                      </div>
                      {mapping.controlCols.length > 0 && (
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-sm font-medium text-foreground">Use Control Variables</span>
                            <p className="text-xs text-foreground-muted">{mapping.controlCols.length} mapped</p>
                          </div>
                          <button
                            onClick={() => setUseControls(!useControls)}
                            className={`w-10 h-5 rounded-full transition-colors ${
                              useControls ? 'bg-primary' : 'bg-background-secondary'
                            }`}
                          >
                            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              useControls ? 'translate-x-5' : 'translate-x-0.5'
                            }`} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="space-y-5">
              <div className="p-5 rounded-xl bg-card border border-border space-y-4 sticky top-8">
                <h3 className="font-semibold text-foreground">Configuration Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Model Type</span>
                    <span className="text-foreground font-medium">{modelType === 'loglog' ? 'Log-Log' : 'Lift-Factor'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Trend</span>
                    <span className="text-foreground font-medium capitalize">{trendType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Seasonality</span>
                    <span className="text-foreground font-medium">{seasonalityEnabled ? `${seasonalityPeriod}w, ${fourierHarmonics}h` : 'Off'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Adstock Channels</span>
                    <span className="text-foreground font-medium">{Object.values(adstockConfig).filter(c => c.enabled).length}/{mapping.mediaCols.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Saturation Channels</span>
                    <span className="text-foreground font-medium">{Object.values(saturationConfig).filter(c => c.enabled).length}/{mapping.mediaCols.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Custom Events</span>
                    <span className="text-foreground font-medium">{customEvents.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Prior Preset</span>
                    <span className="text-foreground font-medium capitalize">{priorPreset}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">MCMC Samples</span>
                    <span className="text-foreground font-medium">{(mcmcDraws * mcmcChains).toLocaleString()}</span>
                  </div>
                  {holdoutWeeks > 0 && (
                    <div className="flex justify-between">
                      <span className="text-foreground-muted">Holdout</span>
                      <span className="text-foreground font-medium">{holdoutWeeks} weeks</span>
                    </div>
                  )}
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
