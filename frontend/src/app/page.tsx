'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { CloudUpload, FileSpreadsheet, CircleHelp, Loader2 } from 'lucide-react'
import { uploadFile, loadSampleData } from '@/lib/api'
import { useAppState } from '@/lib/store'

export default function DataUploadPage() {
  const router = useRouter()
  const { data, setData, setCurrentStep } = useAppState()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleDataLoaded = useCallback((responseData: any) => {
    setData({
      filename: responseData.filename,
      rows: responseData.rows,
      columns: responseData.columns,
      columnNames: responseData.column_names,
      columnTypes: responseData.column_types,
      preview: responseData.preview,
    })
    setCurrentStep(2)
    setError(null)
  }, [setData, setCurrentStep])

  const handleFileUpload = async (file: File) => {
    setIsLoading(true)
    setError(null)

    const result = await uploadFile(file)

    if (result.success && result.data) {
      handleDataLoaded(result.data)
    } else {
      setError(result.error || 'Upload failed')
    }

    setIsLoading(false)
  }

  const handleSampleData = async (sampleName: string) => {
    setIsLoading(true)
    setError(null)

    const result = await loadSampleData(sampleName)

    if (result.success && result.data) {
      handleDataLoaded(result.data)
    } else {
      setError(result.error || 'Failed to load sample data')
    }

    setIsLoading(false)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Data Upload</h1>
          <span className="text-sm text-foreground-muted">/ Step 1 of 7</span>
        </div>
        <button className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted hover:text-foreground hover:bg-card-hover transition-colors">
          <CircleHelp className="w-4 h-4" />
          <span className="text-sm">Help</span>
        </button>
      </header>

      <div className="flex-1 p-8 overflow-auto">
        <div className="max-w-6xl space-y-6">
          {/* Upload Section */}
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Upload Your Data</h2>
              <p className="text-sm text-foreground-muted mt-1">
                Upload a CSV or Excel file containing your marketing spend and sales data.
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-lg bg-error/10 border border-error text-error text-sm">
                {error}
              </div>
            )}

            <label
              className={`flex flex-col items-center justify-center w-full h-[200px] border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                isDragging
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary hover:bg-card/50'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              {isLoading ? (
                <Loader2 className="w-12 h-12 text-primary animate-spin" />
              ) : (
                <>
                  <CloudUpload className="w-12 h-12 text-foreground-subtle mb-4" />
                  <span className="text-sm text-foreground-muted">
                    Drag and drop your file here, or click to browse
                  </span>
                  <span className="text-xs text-foreground-subtle mt-2">Supports CSV, XLSX</span>
                </>
              )}
              <input
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileChange}
                disabled={isLoading}
              />
            </label>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-foreground-subtle font-medium">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Sample Data */}
            <div className="space-y-3">
              <p className="text-base font-medium text-foreground">Or use sample data to explore</p>
              <button
                onClick={() => handleSampleData('demo')}
                disabled={isLoading}
                className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary transition-colors text-left disabled:opacity-50 w-full max-w-md"
              >
                <div className="w-10 h-10 rounded-lg bg-chart-1/20 flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-chart-1" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Demo Dataset</h3>
                  <p className="text-sm text-foreground-muted mt-0.5">
                    230 weeks of marketing data with Google and Facebook spend.
                  </p>
                  <span className="inline-block mt-2 text-xs text-primary font-medium">
                    Load Sample
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Data Preview */}
          {data && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-medium text-foreground">Data Preview</h3>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-foreground-muted">
                    Rows: <span className="text-foreground font-medium">{data.rows.toLocaleString()}</span>
                  </span>
                  <span className="text-foreground-muted">
                    Columns: <span className="text-foreground font-medium">{data.columns}</span>
                  </span>
                  <span className="text-foreground-muted">
                    File: <span className="text-foreground font-medium">{data.filename}</span>
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-background-secondary">
                        {data.columnNames.slice(0, 6).map((col) => (
                          <th
                            key={col}
                            className="px-4 h-11 text-left text-sm font-medium text-foreground-muted whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                        {data.columnNames.length > 6 && (
                          <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">
                            +{data.columnNames.length - 6} more
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {data.preview.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          {data.columnNames.slice(0, 6).map((col) => (
                            <td key={col} className="px-4 h-10 text-sm text-foreground whitespace-nowrap">
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                          {data.columnNames.length > 6 && (
                            <td className="px-4 h-10 text-sm text-foreground-muted">...</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => router.push('/explore')}
                  className="px-6 py-2.5 bg-primary text-white font-medium rounded-lg hover:bg-primary-hover transition-colors"
                >
                  Continue to Exploration
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
