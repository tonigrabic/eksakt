'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import { PredictionModal } from '@/components/modals/prediction-modal'
import type { UUID } from '@/types'

type Ctx = {
  openPrediction: (matchId: UUID) => void
}

const PredictionContext = createContext<Ctx | null>(null)

export function usePrediction(): Ctx {
  const ctx = useContext(PredictionContext)
  if (!ctx) throw new Error('usePrediction must be used within PredictionProvider')
  return ctx
}

export function PredictionProvider({ children }: { children: React.ReactNode }) {
  const [matchId, setMatchId] = useState<UUID | null>(null)

  const openPrediction = useCallback((id: UUID) => setMatchId(id), [])
  const close = useCallback(() => setMatchId(null), [])

  return (
    <PredictionContext.Provider value={{ openPrediction }}>
      {children}
      <PredictionModal
        matchId={matchId}
        open={matchId !== null}
        onOpenChange={(open) => {
          if (!open) close()
        }}
        onClose={close}
      />
    </PredictionContext.Provider>
  )
}
