import { useIsFetching } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { isResearcher } from './ArticlesAccessGate'

export function ResearchAdminFab() {
	const { user, isAuthenticated, loaders } = useAuthContext()
	const router = useRouter()
	const landingLoading = useIsFetching({ queryKey: ['research-landing'] }) > 0

	if (loaders.userLoading || !isAuthenticated || !isResearcher(user)) return null
	if (router.pathname.startsWith('/research/admin')) return null
	// The editor header already holds Publish and the admin actions, and the fab would cover them.
	if (router.pathname.startsWith('/research/edit/') || router.pathname === '/research/new') return null
	if (landingLoading) return null

	return (
		<div className="fixed top-[74px] right-3 z-30 rounded-lg bg-overlay shadow-overlay lg:top-3 lg:right-4">
			<Button as={BasicLink} href="/research/admin" variant="secondary" size="md" aria-label="Open research admin">
				<Icon name="shield-check" className="size-3.5" aria-hidden />
				Admin
			</Button>
		</div>
	)
}
