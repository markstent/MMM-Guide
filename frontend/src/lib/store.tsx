'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface DataState {
  filename: string | null
  rows: number
  columns: number
  columnNames: string[]
  columnTypes: {
    date: string[]
    numeric: string[]
    categorical: string[]
    potential_target: string[]
    potential_media: string[]
  }
  preview: Record<string, unknown>[]
}

interface MappingState {
  dateCol: string | null
  targetCol: string | null
  mediaCols: string[]
  controlCols: string[]
}

interface ModelConfigState {
  modelType: 'loglog' | 'lift'
  seasonalityPeriod: number
  fourierHarmonics: number
  mcmcDraws: number
  mcmcTune: number
  mcmcChains: number
}

interface ResultsState {
  rSquared: number | null
  mape: number | null
  elasticities: Record<string, { mean: number; ci_lower: number; ci_upper: number }>
  roi: { channel: string; spend: number; contribution: number; roi: number }[]
  diagnostics: {
    converged: boolean
    rhat_max: number
    ess_min: number
    divergences: number
  } | null
  decomposition?: { date: string; actual: number; baseline: number; [channel: string]: number | string }[]
}

interface OptimizationState {
  currentSpend: Record<string, number>
  optimalSpend: Record<string, number>
  expectedLift: {
    current_sales: number
    expected_sales: number
    lift: number
    lift_pct: number
  } | null
}

interface AppState {
  // Data
  data: DataState | null
  setData: (data: DataState | null) => void

  // Mapping
  mapping: MappingState
  setMapping: (mapping: MappingState) => void

  // Model Config
  modelConfig: ModelConfigState
  setModelConfig: (config: ModelConfigState) => void

  // Training
  isTraining: boolean
  setIsTraining: (training: boolean) => void
  trainingProgress: number
  setTrainingProgress: (progress: number) => void

  // Results
  results: ResultsState | null
  setResults: (results: ResultsState | null) => void

  // Optimization
  optimization: OptimizationState | null
  setOptimization: (opt: OptimizationState | null) => void

  // Scenarios
  scenarios: { name: string; spend_allocation: Record<string, number>; total_spend: number; projected_sales: number; roi: number }[]
  addScenario: (scenario: { name: string; spend_allocation: Record<string, number>; total_spend: number; projected_sales: number; roi: number }) => void

  // Current step
  currentStep: number
  setCurrentStep: (step: number) => void
}

const defaultMapping: MappingState = {
  dateCol: null,
  targetCol: null,
  mediaCols: [],
  controlCols: [],
}

const defaultModelConfig: ModelConfigState = {
  modelType: 'loglog',
  seasonalityPeriod: 52,
  fourierHarmonics: 3,
  mcmcDraws: 2000,
  mcmcTune: 1000,
  mcmcChains: 4,
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataState | null>(null)
  const [mapping, setMapping] = useState<MappingState>(defaultMapping)
  const [modelConfig, setModelConfig] = useState<ModelConfigState>(defaultModelConfig)
  const [isTraining, setIsTraining] = useState(false)
  const [trainingProgress, setTrainingProgress] = useState(0)
  const [results, setResults] = useState<ResultsState | null>(null)
  const [optimization, setOptimization] = useState<OptimizationState | null>(null)
  const [scenarios, setScenarios] = useState<{ name: string; spend_allocation: Record<string, number>; total_spend: number; projected_sales: number; roi: number }[]>([])
  const [currentStep, setCurrentStep] = useState(1)

  const addScenario = (scenario: { name: string; spend_allocation: Record<string, number>; total_spend: number; projected_sales: number; roi: number }) => {
    setScenarios(prev => [...prev, scenario])
  }

  return (
    <AppContext.Provider
      value={{
        data,
        setData,
        mapping,
        setMapping,
        modelConfig,
        setModelConfig,
        isTraining,
        setIsTraining,
        trainingProgress,
        setTrainingProgress,
        results,
        setResults,
        optimization,
        setOptimization,
        scenarios,
        addScenario,
        currentStep,
        setCurrentStep,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useAppState() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppState must be used within AppProvider')
  }
  return context
}
