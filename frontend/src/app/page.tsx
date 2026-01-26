'use client'

import { useState } from 'react'
import { CloudUpload, FileSpreadsheet, CircleHelp } from 'lucide-react'

export default function DataUploadPage() {
  const [data, setData] = useState<string[][] | null>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // File handling logic would go here
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-border">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Data Upload</h1>
          <span className="text-sm text-foreground-muted">/ Step 1 of 8</span>
        </div>
        <button className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted hover:text-foreground hover:bg-card-hover transition-colors">
          <CircleHelp className="w-4 h-4" />
          <span className="text-sm">Help</span>
        </button>
      </header>

      {/* Content */}
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

            {/* Drop Zone */}
            <label className="flex flex-col items-center justify-center w-full h-[200px] border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary hover:bg-card/50 transition-colors">
              <CloudUpload className="w-12 h-12 text-foreground-subtle mb-4" />
              <span className="text-sm text-foreground-muted">
                Drag and drop your file here, or click to browse
              </span>
              <span className="text-xs text-foreground-subtle mt-2">
                Supports CSV, XLSX
              </span>
              <input
                type="file"
                className="hidden"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
              />
            </label>

            {/* OR divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-foreground-subtle font-medium">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Sample Data Cards */}
            <div className="space-y-3">
              <p className="text-base font-medium text-foreground">Or use sample data to explore</p>
              <div className="grid grid-cols-2 gap-4">
                <button className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary transition-colors text-left">
                  <div className="w-10 h-10 rounded-lg bg-chart-1/20 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-chart-1" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Conjura MMM Dataset</h3>
                    <p className="text-sm text-foreground-muted mt-0.5">
                      3 years of weekly data with 4 media channels.
                    </p>
                    <span className="inline-block mt-2 text-xs text-primary font-medium">
                      Load Sample
                    </span>
                  </div>
                </button>
                <button className="flex items-start gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary transition-colors text-left">
                  <div className="w-10 h-10 rounded-lg bg-chart-2/20 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5 text-chart-2" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">E-commerce Demo</h3>
                    <p className="text-sm text-foreground-muted mt-0.5">
                      2 years of daily data with 6 media channels.
                    </p>
                    <span className="inline-block mt-2 text-xs text-primary font-medium">
                      Load Sample
                    </span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Preview Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-medium text-foreground">Data Preview</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-foreground-muted">
                  Rows: <span className="text-foreground font-medium">156</span>
                </span>
                <span className="text-foreground-muted">
                  Columns: <span className="text-foreground font-medium">12</span>
                </span>
                <span className="text-foreground-muted">
                  Date Range: <span className="text-foreground font-medium">Jan 2022 - Dec 2024</span>
                </span>
              </div>
            </div>

            {/* Data Table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-background-secondary">
                      <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">date</th>
                      <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">revenue_eur_total</th>
                      <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">cost_appinstallcampaign_spend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ['2020-01-05', '2245', '0.72'],
                      ['2020-01-12', '3476', '0.51'],
                      ['2020-01-19', '3469', '0.06'],
                      ['2020-01-27', '2445', '0.07'],
                      ['2022-01-14', '2653', '0.69'],
                    ].map((row, i) => (
                      <tr key={i} className="border-t border-border">
                        <td className="px-4 h-10 text-sm text-foreground">{row[0]}</td>
                        <td className="px-4 h-10 text-sm text-foreground">{row[1]}</td>
                        <td className="px-4 h-10 text-sm text-foreground">{row[2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
