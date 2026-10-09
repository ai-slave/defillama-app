import * as Ariakit from '@ariakit/react'
import { useMutationState, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useAuthContext } from '~/auth'
import type { Dashboard } from '~/containers/ProDashboard/dashboardTypes'
import type { DashboardUpdate } from '~/containers/ProDashboard/hooks/useDashboardAPI'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { pageContent } from '~/ui/focus'
import { getDashboardRecovery, type DashboardSaveAttempt } from './dashboardRecovery'

// Writes and recoverable drafts outlive the Pro route. Keep the warning and recovery UI with them.
export function DashboardSaveGuard() {
	const { user, isAuthenticated } = useAuthContext()
	const client = useQueryClient()
	const router = useRouter()
	const attempts = useMutationState({
		filters: { mutationKey: ['pro-dashboard-update'] },
		select: (mutation): DashboardSaveAttempt => ({
			userId: mutation.options.mutationKey?.[2],
			status: mutation.state.status,
			request: mutation.state.variables as DashboardUpdate
		})
	})
	const routeKey = router.query.dashboardId
	const routeMode = Array.isArray(router.query.mode) ? router.query.mode[0] : router.query.mode
	const onDashboardEditRoute = router.pathname === '/pro/[dashboardId]/[[...mode]]' && routeMode === 'edit'
	const routeDashboard = client.getQueryData<Dashboard>([
		'pro-dashboard',
		'dashboard',
		routeKey,
		isAuthenticated,
		user?.id
	])
	// Filter snapshots during render: changing useMutationState's filters alone does not refresh them.
	const { unsaved, notices } = getDashboardRecovery(
		attempts,
		user?.id,
		onDashboardEditRoute ? { routeKey, dashboardId: routeDashboard?.id } : null
	)
	useEffect(() => {
		if (!unsaved) return
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault()
			event.returnValue = ''
		}
		window.addEventListener('beforeunload', warn)
		return () => window.removeEventListener('beforeunload', warn)
	}, [unsaved])
	return (
		<div
			aria-live="polite"
			className="fixed right-3 bottom-3 left-3 z-40 flex max-h-[40dvh] flex-col gap-2 overflow-y-auto sm:left-auto sm:w-96"
		>
			{notices.map((request) => (
				// Keyed by account too: the discard question belongs to one account's draft and leaves with it.
				<FailedDashboardDraft key={`${user?.id}:${request.id}`} request={request} userId={user?.id} />
			))}
		</div>
	)
}

// Where focus goes when a notice leaves: the first remaining notice's first control, else the page content.
function afterNotices() {
	const control = document.querySelector<HTMLElement>('[data-dashboard-draft] a, [data-dashboard-draft] button')
	return control ?? pageContent()
}

function FailedDashboardDraft({ request, userId }: { request: DashboardUpdate; userId: string | undefined }) {
	const client = useQueryClient()
	const discardDialog = Ariakit.useDialogStore()
	return (
		<section
			data-dashboard-draft
			aria-label={`Unsaved dashboard: ${request.data.dashboardName}`}
			className="rounded-lg border border-medium bg-overlay p-3 text-primary shadow-dialog"
		>
			<p className="body-sm break-words">
				Unsaved changes to {request.data.dashboardName}. Open the editor to retry, or discard this draft.
			</p>
			<div className="mt-2 flex flex-wrap gap-2">
				<Button as={Link} href={`/pro/${encodeURIComponent(request.id)}/edit`} variant="primary" size="md">
					Open editor
				</Button>
				<Ariakit.DialogDisclosure store={discardDialog} render={<Button size="md" />}>
					Discard draft…
				</Ariakit.DialogDisclosure>
			</div>
			<ConfirmDialog
				store={discardDialog}
				unmountOnHide
				title="Discard unsaved dashboard changes?"
				description={
					<span className="break-words">
						This discards the unsaved draft for {request.data.dashboardName}. The saved dashboard stays unchanged.
					</span>
				}
				confirmLabel="Discard draft"
				cancelLabel="Keep draft"
				error={null}
				// A discard removes the notice and its trigger, so focus goes on past the notices.
				autoFocusOnHide={(element) => {
					if (element?.isConnected) return true
					afterNotices()?.focus()
					return false
				}}
				onConfirm={() => {
					const filters = { mutationKey: ['pro-dashboard-update', request.id, userId] }
					// The render can lag a save that just started; that save decides the draft, not this click.
					if (client.isMutating(filters)) return
					// Removing the draft removes this notice, and the question leaves with it.
					for (const mutation of client.getMutationCache().findAll(filters)) {
						if ((mutation.state.variables as DashboardUpdate | undefined)?.source === 'autosave')
							client.getMutationCache().remove(mutation)
					}
				}}
			/>
		</section>
	)
}
