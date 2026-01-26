'use client'

import { CircleHelp, Download, TrendingUp, TrendingDown } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts'

const elasticityData = [
  { channel: 'TV', elasticity: 0.21, lower: 0.15, upper: 0.27 },
  { channel: 'Digital', elasticity: 0.18, lower: 0.12, upper: 0.24 },
  { channel: 'Social', elasticity: 0.12, lower: 0.08, upper: 0.16 },
  { channel: 'Search', elasticity: 0.09, lower: 0.05, upper: 0.13 },
]

const responseData = Array.from({ length: 50 }, (_, i) => ({
  spend: i * 10000,
  response: Math.log(i + 1) * 100000,
}))

const decompositionData = [
  { period: 'Q1', baseline: 40, tv: 15, digital: 12, social: 8, search: 5 },
  { period: 'Q2', baseline: 42, tv: 18, digital: 14, social: 10, search: 6 },
  { period: 'Q3', baseline: 45, tv: 20, digital: 16, social: 12, search: 7 },
  { period: 'Q4', baseline: 48, tv: 22, digital: 18, social: 14, search: 8 },
]

const roiData = [
  { channel: 'TV', roi: 2.47, ciLower: 1.85, ciUpper: 3.09, color: 'var(--chart-1)' },
  { channel: 'Digital', roi: 1.89, ciLower: 1.42, ciUpper: 2.36, color: 'var(--chart-2)' },
  { channel: 'Social', roi: 3.94, ciLower: 2.96, ciUpper: 4.92, color: 'var(--chart-3)' },
  { channel: 'Search', roi: 2.29, ciLower: 1.72, ciUpper: 2.87, color: 'var(--chart-4)' },
]

export default function ResultsPage() {
  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="h-16 flex items-center justify-between px-8 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold text-foreground">Results Analysis</h1>
          <span className="text-sm text-foreground-muted">/ Step 6 of 8</span>
        </div>
        <button className="flex items-center gap-2 px-3.5 h-9 rounded-lg border border-border text-foreground-muted hover:text-foreground hover:bg-card-hover transition-colors">
          <CircleHelp className="w-4 h-4" />
          <span className="text-sm">Help</span>
        </button>
      </header>

      {/* Content */}
      <div className="flex-1 p-8 overflow-auto">
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-5 rounded-xl bg-card border border-border">
              <p className="text-sm text-foreground-muted">R-squared</p>
              <p className="text-3xl font-semibold font-mono text-foreground mt-2">0.847</p>
              <div className="flex items-center gap-1.5 mt-2 text-success">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-medium">Good Fit</span>
              </div>
            </div>
            <div className="p-5 rounded-xl bg-card border border-border">
              <p className="text-sm text-foreground-muted">MAPE</p>
              <p className="text-3xl font-semibold font-mono text-foreground mt-2">8.2%</p>
              <div className="flex items-center gap-1.5 mt-2 text-warning">
                <TrendingDown className="w-4 h-4" />
                <span className="text-xs font-medium">Below Target</span>
              </div>
            </div>
            <div className="p-5 rounded-xl bg-card border border-border">
              <p className="text-sm text-foreground-muted">LOO-CV Score</p>
              <p className="text-3xl font-semibold font-mono text-foreground mt-2">-142.3</p>
              <div className="flex items-center gap-1.5 mt-2 text-foreground-muted">
                <span className="text-xs">Bayesian Model Validation</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6">
            {/* Channel Elasticities */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Channel Elasticities</h3>
                <span className="text-xs text-foreground-muted">with 95% credible intervals</span>
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={elasticityData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" stroke="var(--foreground-muted)" fontSize={12} />
                    <YAxis dataKey="channel" type="category" stroke="var(--foreground-muted)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="elasticity" fill="var(--chart-1)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Response Curves */}
            <div className="p-5 rounded-xl bg-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-foreground">Response Curves</h3>
                <select className="px-3 py-1.5 text-sm bg-background-secondary border border-border rounded-md text-foreground">
                  <option>TV Spend</option>
                  <option>Digital Spend</option>
                  <option>Social Spend</option>
                  <option>Search Spend</option>
                </select>
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={responseData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="spend" stroke="var(--foreground-muted)" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                    <YAxis stroke="var(--foreground-muted)" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                      }}
                    />
                    <Line type="monotone" dataKey="response" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Sales Decomposition */}
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Sales Decomposition</h3>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-sm bg-primary text-white rounded-md">Stacked</button>
                <button className="px-3 py-1.5 text-sm bg-background-secondary border border-border rounded-md text-foreground-muted">Waterfall</button>
              </div>
            </div>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={decompositionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="period" stroke="var(--foreground-muted)" fontSize={12} />
                  <YAxis stroke="var(--foreground-muted)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                  />
                  <Area type="monotone" dataKey="baseline" stackId="1" fill="var(--foreground-subtle)" stroke="none" />
                  <Area type="monotone" dataKey="tv" stackId="1" fill="var(--chart-1)" stroke="none" />
                  <Area type="monotone" dataKey="digital" stackId="1" fill="var(--chart-2)" stroke="none" />
                  <Area type="monotone" dataKey="social" stackId="1" fill="var(--chart-3)" stroke="none" />
                  <Area type="monotone" dataKey="search" stackId="1" fill="var(--chart-4)" stroke="none" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-foreground-subtle" />
                <span className="text-xs text-foreground-muted">Baseline</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-chart-1" />
                <span className="text-xs text-foreground-muted">TV</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-chart-2" />
                <span className="text-xs text-foreground-muted">Digital</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-chart-3" />
                <span className="text-xs text-foreground-muted">Social</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-chart-4" />
                <span className="text-xs text-foreground-muted">Search</span>
              </div>
            </div>
          </div>

          {/* ROI Table */}
          <div className="p-5 rounded-xl bg-card border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Channel ROI Summary</h3>
              <button className="flex items-center gap-2 px-3 h-8 rounded-md border border-border text-foreground-muted hover:text-foreground transition-colors">
                <Download className="w-4 h-4" />
                <span className="text-sm">Export</span>
              </button>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-background-secondary">
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">Channel</th>
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">ROI</th>
                    <th className="px-4 h-11 text-left text-sm font-medium text-foreground-muted">95% CI</th>
                  </tr>
                </thead>
                <tbody>
                  {roiData.map((row) => (
                    <tr key={row.channel} className="border-t border-border">
                      <td className="px-4 h-12">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: row.color }} />
                          <span className="text-sm text-foreground">{row.channel}</span>
                        </div>
                      </td>
                      <td className="px-4 h-12">
                        <span className="font-mono text-sm text-foreground">${row.roi.toFixed(2)}</span>
                      </td>
                      <td className="px-4 h-12">
                        <span className="text-sm text-foreground-muted">
                          ${row.ciLower.toFixed(2)} - ${row.ciUpper.toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
