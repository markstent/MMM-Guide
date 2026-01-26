'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Timer, X, CheckCircle, AlertCircle } from 'lucide-react'
import { useAppState } from '@/lib/store'
import { trainModel, getModelResults } from '@/lib/api'

export default function TrainingPage() {
  const router = useRouter()
  const { modelConfig, isTraining, setIsTraining, setResults, setCurrentStep } = useAppState()

  const [status, setStatus] = useState<'training' | 'success' | 'error'>('training')
  const [progress, setProgress] = useState(0)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [chainProgress, setChainProgress] = useState<number[]>([0, 0, 0, 0])
  const trainingStarted = useRef(false)

  // Format elapsed time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs.toString().padStart(2, '0')}s`
  }

  // Start training on mount
  useEffect(() => {
    if (trainingStarted.current) return
    trainingStarted.current = true

    const startTraining = async () => {
      setStatus('training')

      // Start the timer
      const timerInterval = setInterval(() => {
        setElapsedTime(prev => prev + 1)
      }, 1000)

      // Simulate chain progress while waiting for the actual API
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + Math.random() * 2, 95))
        setChainProgress(prev => prev.map((p, i) => {
          const increment = Math.random() * 3 * (1 - i * 0.1)
          return Math.min(p + increment, i === 0 ? 100 : 95)
        }))
      }, 500)

      try {
        const result = await trainModel()

        clearInterval(progressInterval)

        if (result.success && result.data) {
          // Training complete
          setProgress(100)
          setChainProgress([100, 100, 100, 100])
          setStatus('success')

          const trainData = result.data as any

          // Fetch results
          const resultsResponse = await getModelResults()
          if (resultsResponse.success && resultsResponse.data) {
            const data = resultsResponse.data as any
            setResults({
              rSquared: data.r_squared,
              mape: data.mape,
              elasticities: data.elasticities,
              roi: data.roi,
              diagnostics: {
                converged: trainData.converged,
                rhat_max: trainData.diagnostics?.rhat_max || 1.0,
                ess_min: trainData.diagnostics?.ess_min || 1000,
                divergences: trainData.diagnostics?.divergences || 0,
              },
            })
          }

          setCurrentStep(6)
          setIsTraining(false)

          // Redirect to results after a short delay
          setTimeout(() => {
            router.push('/results')
          }, 2000)
        } else {
          setStatus('error')
          setError(result.error || 'Training failed')
        }
      } catch (err) {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Training failed')
      } finally {
        clearInterval(timerInterval)
      }
    }

    startTraining()
  }, [])

  const handleCancel = () => {
    setIsTraining(false)
    router.push('/config')
  }

  const overallProgress = Math.round(progress)
  const chains = modelConfig.mcmcChains || 4
  const draws = modelConfig.mcmcDraws || 2000

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
          <div className={`w-[120px] h-[120px] mx-auto rounded-full flex items-center justify-center ${
            status === 'success' ? 'bg-success' : status === 'error' ? 'bg-error' : 'bg-primary'
          }`}>
            {status === 'training' && <Loader2 className="w-12 h-12 text-white animate-spin" />}
            {status === 'success' && <CheckCircle className="w-12 h-12 text-white" />}
            {status === 'error' && <AlertCircle className="w-12 h-12 text-white" />}
          </div>

          {/* Status Text */}
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              {status === 'training' && 'Training in Progress'}
              {status === 'success' && 'Training Complete!'}
              {status === 'error' && 'Training Failed'}
            </h2>
            <p className="text-sm text-foreground-muted">
              {status === 'training' && `Running ${chains} chains with ${draws.toLocaleString()} draws each`}
              {status === 'success' && 'Model trained successfully. Redirecting to results...'}
              {status === 'error' && (error || 'An error occurred during training')}
            </p>
          </div>

          {/* Progress Card */}
          <div className="p-6 rounded-xl bg-card border border-border space-y-5">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-foreground">Overall Progress</span>
              <span className={`font-mono text-lg font-semibold ${
                status === 'success' ? 'text-success' : status === 'error' ? 'text-error' : 'text-primary'
              }`}>
                {overallProgress}%
              </span>
            </div>
            <div className="h-2 bg-background-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  status === 'success' ? 'bg-success' : status === 'error' ? 'bg-error' : 'bg-primary'
                }`}
                style={{ width: `${overallProgress}%` }}
              />
            </div>

            <div className="space-y-3">
              <span className="text-xs text-foreground-muted">Chain Progress</span>
              <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${Math.min(chains, 4)}, 1fr)` }}>
                {Array.from({ length: Math.min(chains, 4) }).map((_, i) => {
                  const pct = Math.round(chainProgress[i] || 0)
                  const isComplete = pct >= 100
                  return (
                    <div key={i} className="p-3 bg-background-secondary rounded-lg space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-foreground font-medium">Chain {i + 1}</span>
                        <span className={isComplete ? 'text-success' : 'text-primary'}>
                          {pct}%
                        </span>
                      </div>
                      <div className="h-1 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${isComplete ? 'bg-success' : 'bg-primary'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Time & Cancel */}
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-foreground-muted">
              <Timer className="w-4 h-4" />
              <span className="text-sm">Elapsed: {formatTime(elapsedTime)}</span>
            </div>
            {status === 'training' && (
              <button
                onClick={handleCancel}
                className="flex items-center gap-1.5 px-4 py-2 border border-border rounded-md text-foreground-muted hover:text-foreground hover:bg-card-hover transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span className="text-sm">Cancel</span>
              </button>
            )}
            {status === 'error' && (
              <button
                onClick={() => router.push('/config')}
                className="px-4 py-2 bg-primary text-white rounded-md text-sm"
              >
                Back to Configuration
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
