import * as Ariakit from '@ariakit/react'
import { useMutationState, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import { useAuthContext } from '~/auth'
import type { Dashboard } from '~/containers/ProDashboard/dashboardTypes'
import type { DashboardUpdate } from '~/containers/ProDashboard/hooks/useDashboardAPI'
import { Button } from '~/ui/Button'
import { DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
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
				<FailedDashboardDraft key={request.id} request={request} userId={user?.id} />
			))}
		</div>
	)
}

function FailedDashboardDraft({ request, userId }: { request: DashboardUpdate; userId: string | undefined }) {
	const client = useQueryClient()
	return (
		<Ariakit.DialogProvider>
			<section
				aria-label={`Unsaved dashboard: ${request.data.dashboardName}`}
				className="rounded-lg border border-medium bg-overlay p-3 text-primary shadow-dialog"
			>
				<p className="body-sm break-words">
					Unsaved changes to {request.data.dashboardName}. Open the editor to retry, or discard this draft.
				</p>
				<div className="mt-2 flex flex-wrap gap-2">
					<Link href={`/pro/${encodeURIComponent(request.id)}/edit`} className="self-center text-link underline">
						Open editor
					</Link>
					<Ariakit.DialogDisclosure render={<Button size="md" />}>Discard draft…</Ariakit.DialogDisclosure>
				</div>
			</section>
			<Ariakit.Dialog
				role="alertdialog"
				className={`${dialogSurfaceStyles} [--dialog-width:448px] max-sm:h-fit max-sm:min-h-0`}
				autoFocusOnHide={(element) => {
					if (element) return true
					// Discard removes this notice and its trigger. Return to the page content in that case.
					const main = document.querySelector('main')
					if (main) {
						main.tabIndex = -1
						main.focus()
					}
					return false
				}}
			>
				<DialogHeading className="shrink-0 p-3">Discard unsaved dashboard changes?</DialogHeading>
				<div className={`${dialogScrollableBodyStyles} px-3`}>
					<Ariakit.DialogDescription className="body-sm break-words text-secondary">
						This discards the unsaved draft for {request.data.dashboardName}. The saved dashboard stays unchanged.
					</Ariakit.DialogDescription>
				</div>
				<footer className="flex shrink-0 justify-end gap-2 p-3">
					<Ariakit.DialogDismiss autoFocus render={<Button size="md" />}>
						Keep draft
					</Ariakit.DialogDismiss>
					<Ariakit.Button
						render={<Button size="md" variant="destructive" />}
						onClick={() => {
							const filters = { mutationKey: ['pro-dashboard-update', request.id, userId] }
							if (client.isMutating(filters)) return
							for (const mutation of client.getMutationCache().findAll(filters)) {
								if ((mutation.state.variables as DashboardUpdate | undefined)?.source === 'autosave')
									client.getMutationCache().remove(mutation)
							}
						}}
					>
						Discard draft
					</Ariakit.Button>
				</footer>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
