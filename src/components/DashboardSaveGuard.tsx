import * as Ariakit from '@ariakit/react'
import { useMutationState, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { useAuthContext } from '~/auth'
import type { Dashboard } from '~/containers/ProDashboard/dashboardTypes'
import type { DashboardUpdate } from '~/containers/ProDashboard/hooks/useDashboardAPI'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { pageContent } from '~/ui/focus'
import { getDashboardRecovery, getDraftStatus, type DashboardSaveAttempt } from './dashboardRecovery'

// Writes and recoverable drafts outlive the Pro route. Keep the warning and recovery UI with them.
// Each account gets its own guard: an open discard question names one account's draft, so another account
// starts without it instead of retargeting it.
export function DashboardSaveGuard() {
	const { user } = useAuthContext()
	return <AccountSaveGuard key={user?.id} />
}

function AccountSaveGuard() {
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
	// One confirmation for every notice, owned here: a notice hides while a newer save runs, and its open question
	// must not go with it. It closes only when the reader answers.
	const discardDialog = Ariakit.useDialogStore()
	const [discarding, setDiscarding] = useState<DashboardUpdate | null>(null)
	const draft = discarding ? getDraftStatus(attempts, user?.id, discarding.id) : null
	return (
		<>
			<div
				aria-live="polite"
				className="fixed right-3 bottom-3 left-3 z-40 flex max-h-[40dvh] flex-col gap-2 overflow-y-auto sm:left-auto sm:w-96"
			>
				{notices.map((request) => (
					<FailedDashboardDraft
						key={request.id}
						request={request}
						discardDialog={discardDialog}
						onDiscard={() => setDiscarding(request)}
					/>
				))}
			</div>
			{discarding ? (
				<ConfirmDialog
					store={discardDialog}
					unmountOnHide
					title="Discard unsaved dashboard changes?"
					description={
						<span className="break-words">
							{draft === 'gone'
								? `There is no unsaved draft for ${discarding.data.dashboardName} any more, so there is nothing to discard.`
								: `This discards the unsaved draft for ${discarding.data.dashboardName}. The saved dashboard stays unchanged.`}
						</span>
					}
					confirmLabel="Discard draft"
					cancelLabel={draft === 'gone' ? 'Close' : 'Keep draft'}
					pendingLabel={null}
					// A newer save may still land or fail as a newer draft; discarding waits until it settles.
					waitingLabel={draft === 'saving' ? 'Waiting for save…' : null}
					confirmDisabled={draft === 'gone'}
					error={null}
					// When the notice left with its trigger (discarded, or a newer save landed), focus goes on past the notices.
					autoFocusOnHide={(element) => {
						if (element?.isConnected) return true
						afterNotices()?.focus()
						return false
					}}
					onConfirm={() => {
						const filters = { mutationKey: ['pro-dashboard-update', discarding.id, user?.id] }
						// The render can lag a save that just started; that save decides the draft, not this click.
						if (client.isMutating(filters)) return
						// The question closes with the notice it asked about, in the same click, so it never shows the
						// nothing-left state or disables its focused button on the way out.
						for (const mutation of client.getMutationCache().findAll(filters)) {
							if ((mutation.state.variables as DashboardUpdate | undefined)?.source === 'autosave')
								client.getMutationCache().remove(mutation)
						}
						discardDialog.hide()
						setDiscarding(null)
					}}
				/>
			) : null}
		</>
	)
}

// Where focus goes when a notice leaves: the first remaining notice's first control, else the page content.
function afterNotices() {
	const control = document.querySelector<HTMLElement>('[data-dashboard-draft] a, [data-dashboard-draft] button')
	return control ?? pageContent()
}

function FailedDashboardDraft({
	request,
	discardDialog,
	onDiscard
}: {
	request: DashboardUpdate
	discardDialog: Ariakit.DialogStore
	onDiscard: () => void
}) {
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
				<Ariakit.DialogDisclosure store={discardDialog} onClick={onDiscard} render={<Button size="md" />}>
					Discard draft…
				</Ariakit.DialogDisclosure>
			</div>
		</section>
	)
}
