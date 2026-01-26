'use client'

import { AppProvider } from '@/lib/store'
import { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return <AppProvider>{children}</AppProvider>
}
