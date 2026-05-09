import { BottomNav } from '@/components/bottom-nav'
import { PredictionProvider } from '@/components/prediction-provider'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <PredictionProvider>
      <div className="min-h-screen bg-background pb-20">
        {children}
      </div>
      <BottomNav />
    </PredictionProvider>
  )
}
