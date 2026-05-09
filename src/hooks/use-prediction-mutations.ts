'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { quickPredict, submitPrediction } from '@/lib/mock/api'
import type { QuickPredictInput, SubmitPredictionInput } from '@/types'

// Invalidates everything that depends on prediction state. Mock writes are
// in-memory mutations to the same module-level array used by reads, so a
// cache invalidation is enough to re-render with new data.
function useInvalidateAll() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}

export function useSubmitPrediction() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: SubmitPredictionInput) => submitPrediction(input),
    onSuccess: invalidate,
  })
}

export function useQuickPredict() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (input: QuickPredictInput) => quickPredict(input),
    onSuccess: invalidate,
  })
}
