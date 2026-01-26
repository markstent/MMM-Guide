/**
 * API client for communicating with the FastAPI backend
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      return { success: false, error: error.detail || `HTTP ${response.status}` }
    }

    const data = await response.json()
    return { success: true, data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error'
    }
  }
}

// Data Upload APIs
export async function uploadFile(file: File) {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/api/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }))
    return { success: false, error: error.detail }
  }

  const data = await response.json()
  return { success: true, data }
}

export async function loadSampleData(sampleName: string) {
  return fetchApi(`/api/sample-data/${sampleName}`)
}

// Data Exploration APIs
export async function getExplorationData() {
  return fetchApi('/api/data/explore')
}

// Column Mapping APIs
export interface ColumnMapping {
  date_col: string
  target_col: string
  media_cols: string[]
  control_cols?: string[]
}

export async function setColumnMapping(mapping: ColumnMapping) {
  return fetchApi('/api/mapping', {
    method: 'POST',
    body: JSON.stringify(mapping),
  })
}

// Model Configuration APIs
export interface ModelConfig {
  model_type: 'loglog' | 'lift'
  seasonality_period: number
  fourier_harmonics: number
  mcmc_draws: number
  mcmc_tune: number
  mcmc_chains: number
}

export async function setModelConfig(config: ModelConfig) {
  return fetchApi('/api/model/config', {
    method: 'POST',
    body: JSON.stringify(config),
  })
}

// Model Training APIs
export async function trainModel() {
  return fetchApi('/api/model/train', {
    method: 'POST',
  })
}

export async function getModelResults() {
  return fetchApi('/api/model/results')
}

// Optimization APIs
export interface OptimizationRequest {
  total_budget: number
  constraints?: Record<string, [number, number]>
}

export async function optimizeBudget(request: OptimizationRequest) {
  return fetchApi('/api/optimize', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

// Scenario APIs
export interface ScenarioRequest {
  name: string
  spend_allocation: Record<string, number>
}

export async function createScenario(request: ScenarioRequest) {
  return fetchApi('/api/scenarios/create', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

export async function getScenarios() {
  return fetchApi('/api/scenarios')
}
