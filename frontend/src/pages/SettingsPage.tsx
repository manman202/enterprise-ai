import { useAuth } from '@/contexts/AuthContext'
import { PasswordForm } from '@/components/settings/PasswordForm'
import { ProfileForm } from '@/components/settings/ProfileForm'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/layout/PageHeader'

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()

  if (!user) return null

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Settings" />
      <Card>
        <ProfileForm user={user} onUpdated={refreshUser} />
      </Card>
      <Card>
        <PasswordForm />
      </Card>
    </div>
  )
}
