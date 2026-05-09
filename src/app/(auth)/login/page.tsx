import { Suspense } from 'react'
import { AuthScreen } from '@/components/screens/auth-screen'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <AuthScreen />
    </Suspense>
  )
}
