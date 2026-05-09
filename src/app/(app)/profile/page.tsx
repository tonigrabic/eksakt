import { Card } from '@/components/ui/card'
import { User } from 'lucide-react'

export default function ProfilePage() {
  return (
    <>
      <div className="border-b border-border bg-card">
        <div className="max-w-2xl mx-auto px-4 pt-5 pb-4">
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            Profile
          </h1>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8 flex flex-col items-center gap-4">
        <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
          <User className="h-10 w-10 text-muted-foreground" />
        </div>
        <Card className="w-full p-6 bg-card border-border text-center">
          <p className="text-muted-foreground">
            Profile screen coming soon
          </p>
        </Card>
      </div>
    </>
  )
}
