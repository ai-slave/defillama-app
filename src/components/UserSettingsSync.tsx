import { useAuthContext } from '~/auth'
import { useUserConfig } from '~/hooks/useUserConfig'

function AccountSettingsSync() {
	useUserConfig()
	return null
}

export function UserSettingsSync() {
	const { user } = useAuthContext()
	return <AccountSettingsSync key={user?.id ?? 'anonymous'} />
}
