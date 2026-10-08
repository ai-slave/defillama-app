import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'

interface UserHeaderProps {
	displayName: string
	onLogout: () => void
}

export function UserHeader({ displayName, onLogout }: UserHeaderProps) {
	return (
		<div className="flex items-center justify-between">
			<div className="flex items-center gap-4">
				<img src="/assets/account_avatar.png" alt="" className="size-12 shrink-0 rounded-full" />
				<span className="label-md text-primary">{displayName}</span>
			</div>
			<Button variant="secondary" size="md" onClick={onLogout}>
				<Icon name="sign-out" className="size-3.5" />
				Sign out
			</Button>
		</div>
	)
}
