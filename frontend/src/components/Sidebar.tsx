'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Upload,
  Search,
  Columns2,
  Settings,
  Play,
  BarChart3,
  PieChart,
  GitBranch,
  Moon,
  Sun,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppState } from '@/lib/store'

const navItems = [
  { name: 'Data Upload', href: '/', icon: Upload, step: 1 },
  { name: 'Data Exploration', href: '/explore', icon: Search, step: 2 },
  { name: 'Column Mapping', href: '/mapping', icon: Columns2, step: 3 },
  { name: 'Configuration', href: '/config', icon: Settings, step: 4 },
  { name: 'Training', href: '/training', icon: Play, step: 5 },
  { name: 'Results', href: '/results', icon: BarChart3, step: 6 },
  { name: 'Budget Optimization', href: '/optimization', icon: PieChart, step: 7 },
  { name: 'Scenario Planning', href: '/scenarios', icon: GitBranch, step: 8 },
]

export function Sidebar() {
  const pathname = usePathname()
  const { currentStep, data } = useAppState()
  const [darkMode, setDarkMode] = useState(true)

  // Initialize dark mode from localStorage or system preference
  useEffect(() => {
    const stored = localStorage.getItem('mmm-dark-mode')
    if (stored !== null) {
      setDarkMode(stored === 'true')
    } else {
      // Default to dark mode, or check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setDarkMode(prefersDark)
    }
  }, [])

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('mmm-dark-mode', String(darkMode))
  }, [darkMode])

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev)
  }

  // Calculate progress based on what's completed
  const progress = (currentStep / 8) * 100

  return (
    <div className="w-[260px] h-screen bg-background-secondary border-r border-border flex flex-col">
      {/* Header */}
      <div className="h-16 flex items-center gap-3 px-5 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <span className="font-semibold text-foreground">MMM Studio</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-xs font-medium text-foreground-subtle uppercase tracking-wider">
          Data
        </div>
        {navItems.slice(0, 3).map((item) => {
          const isActive = pathname === item.href
          const isDisabled = !data && item.step > 1
          return (
            <Link
              key={item.href}
              href={isDisabled ? '#' : item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary text-white'
                  : isDisabled
                  ? 'text-foreground-subtle cursor-not-allowed'
                  : 'text-foreground-muted hover:bg-card-hover hover:text-foreground'
              )}
              onClick={(e) => isDisabled && e.preventDefault()}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.name}</span>
            </Link>
          )
        })}

        <div className="px-3 py-2 mt-4 text-xs font-medium text-foreground-subtle uppercase tracking-wider">
          Model
        </div>
        {navItems.slice(3, 6).map((item) => {
          const isActive = pathname === item.href
          const isDisabled = currentStep < item.step - 1
          return (
            <Link
              key={item.href}
              href={isDisabled ? '#' : item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary text-white'
                  : isDisabled
                  ? 'text-foreground-subtle cursor-not-allowed'
                  : 'text-foreground-muted hover:bg-card-hover hover:text-foreground'
              )}
              onClick={(e) => isDisabled && e.preventDefault()}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.name}</span>
            </Link>
          )
        })}

        <div className="px-3 py-2 mt-4 text-xs font-medium text-foreground-subtle uppercase tracking-wider">
          Planning
        </div>
        {navItems.slice(6).map((item) => {
          const isActive = pathname === item.href
          const isDisabled = currentStep < 6
          return (
            <Link
              key={item.href}
              href={isDisabled ? '#' : item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary text-white'
                  : isDisabled
                  ? 'text-foreground-subtle cursor-not-allowed'
                  : 'text-foreground-muted hover:bg-card-hover hover:text-foreground'
              )}
              onClick={(e) => isDisabled && e.preventDefault()}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border space-y-3">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-card-hover transition-colors"
        >
          <div className="flex items-center gap-2">
            {darkMode ? (
              <Moon className="w-4 h-4 text-foreground-muted" />
            ) : (
              <Sun className="w-4 h-4 text-foreground-muted" />
            )}
            <span className="text-sm text-foreground-muted">
              {darkMode ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
          <div
            className={cn(
              'w-9 h-5 rounded-full transition-colors relative',
              darkMode ? 'bg-primary' : 'bg-border'
            )}
          >
            <div
              className={cn(
                'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all',
                darkMode ? 'left-[18px]' : 'left-0.5'
              )}
            />
          </div>
        </button>

        {/* Progress */}
        <div className="space-y-2">
          <div className="text-xs text-foreground-subtle">Workflow Progress</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-foreground-muted">Step {currentStep} of 8</span>
          </div>
        </div>
      </div>
    </div>
  )
}
