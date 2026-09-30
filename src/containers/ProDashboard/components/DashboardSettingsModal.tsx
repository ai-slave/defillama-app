import { useMutation } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'
import type { DashboardTeam } from '../dashboardTypes'
import { ConfirmationModal } from './ConfirmationModal'
import { dashboardFieldHintStyles, TagsField, VisibilityField } from './DashboardFormFields'
import { statusToastOptions, TOAST_DURATION_SHORT } from './dashboardToasts'

interface DashboardSettingsModalProps {
	isOpen: boolean
	onClose: () => void
	dashboardName: string
	visibility: 'private' | 'public'
	tags: Array<string>
	dashboardId: string | null
	onSave: (overrides?: { visibility?: 'private' | 'public'; tags?: Array<string> }) => Promise<void>
	onDelete?: (dashboardId: string) => Promise<void>
	/** The viewer's team. The sharing switch renders only when present. */
	myTeam?: DashboardTeam | null
	/** The team this dashboard currently belongs to. */
	team?: DashboardTeam | null
	/** Creator or team admin. Others see the current state without a switch. */
	canMove?: boolean
	onMoveTeam?: (teamId: string | null) => Promise<void>
}

function DashboardSettingsModalInner({
	isOpen,
	onClose,
	dashboardName,
	visibility,
	tags,
	dashboardId,
	onSave,
	onDelete,
	myTeam,
	team,
	canMove,
	onMoveTeam
}: DashboardSettingsModalProps) {
	const id = useId()
	const { hasActiveSubscription } = useAuthContext()
	const [localVisibility, setLocalVisibility] = useState(visibility)
	const [localTags, setLocalTags] = useState(tags)
	const sharedWithTeam = !!team && (!myTeam || team.id === myTeam.id)
	const [localSharedWithTeam, setLocalSharedWithTeam] = useState(sharedWithTeam)
	const showTeamSwitch = !!myTeam && !!onMoveTeam && !!dashboardId && (canMove || sharedWithTeam)
	// Each opening mounts a new form; late errors belong to the dismissed opening.
	const formRef = useRef<HTMLFormElement>(null)
	const save = useMutation({
		mutationFn: async (overrides: Parameters<typeof onSave>[0]) => {
			// The document fields save first: an admin moving a dashboard out loses access to it afterwards.
			await onSave(overrides)
			if (showTeamSwitch && canMove && myTeam && onMoveTeam && localSharedWithTeam !== sharedWithTeam) {
				await onMoveTeam(localSharedWithTeam ? myTeam.id : null)
			}
		},
		onError: (error) => {
			if (!formRef.current?.isConnected) toast.error(error.message)
		}
	})
	const deletion = useMutation({
		mutationFn: (idToDelete: string) => onDelete!(idToDelete),
		onError: (error) => {
			if (!formRef.current?.isConnected) toast.error(error.message)
		}
	})
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const busy = save.isPending || deletion.isPending

	const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (busy) return
		save.mutate(
			{ visibility: localVisibility, tags: localTags },
			{
				// Confirm only once the dialog is gone, so the toast never sits over it.
				onSuccess: () => {
					onClose()
					toast.success('Settings saved', statusToastOptions('dashboard-settings-saved', TOAST_DURATION_SHORT))
				}
			}
		)
	}

	const handleDeleteClick = () => {
		deletion.reset()
		setShowDeleteConfirm(true)
	}

	const handleConfirmDelete = () => {
		if (!onDelete || !dashboardId || deletion.isPending) return
		deletion.mutate(dashboardId, { onSuccess: onClose })
	}

	// Both requests report into the same alert, so the newer attempt wins; a save that failed earlier
	// must not describe a delete that just failed.
	const failureMessage =
		deletion.isError && (!save.isError || deletion.submittedAt > save.submittedAt)
			? 'Could not delete the dashboard. Try again.'
			: save.isError
				? 'Could not save changes. Your draft is still here. Try again.'
				: null

	return (
		<>
			<Dialog size="sm" scope="pro" open={isOpen} onClose={onClose} pending={busy} portal unmountOnHide>
				<form ref={formRef} onSubmit={handleSave} className="flex min-h-0 flex-auto flex-col">
					<DialogHeader title="Dashboard settings" />
					<DialogBody>
						<fieldset className="flex min-w-0 flex-col gap-4">
							<VisibilityField
								value={localVisibility}
								onChange={setLocalVisibility}
								sharedWithTeam={localSharedWithTeam}
								disabled={busy}
							/>

							{showTeamSwitch && myTeam ? (
								<div className="flex flex-col gap-1.5">
									{/* A locked choice keeps full contrast; the line below says why it is locked. */}
									<Checkbox
										variant="consent"
										id={`${id}-share-team`}
										checked={localSharedWithTeam}
										disabled={!canMove || !hasActiveSubscription || busy}
										onChange={(event) => setLocalSharedWithTeam(event.target.checked)}
									>
										<span className="flex min-w-0 flex-col gap-0.5">
											<span className="flex items-center gap-1.5 label-sm text-primary">
												<Icon name="users" height={14} width={14} />
												Share with {myTeam.name}
											</span>
											<span className="body-sm text-secondary">
												{localSharedWithTeam
													? 'Teammates with a seat can edit it. It stays with the team if you leave.'
													: 'Only you can edit it.'}
											</span>
										</span>
									</Checkbox>
									{!hasActiveSubscription ? (
										<p className={dashboardFieldHintStyles}>Team dashboards need a seat or Pro.</p>
									) : !canMove ? (
										<p className={dashboardFieldHintStyles}>Only the creator or a team admin can change this.</p>
									) : null}
								</div>
							) : null}

							<TagsField tags={localTags} onChange={setLocalTags} disabled={busy} />

							{onDelete && dashboardId ? (
								<div className="border-t border-subtle pt-4">
									<p className="mb-1.5 block label-sm text-data-down">Danger zone</p>
									<p className="mb-3 body-sm text-tertiary">Once you delete a dashboard, there is no going back.</p>
									<Button
										type="button"
										variant="destructive"
										size="md"
										onClick={handleDeleteClick}
										disabled={save.isPending}
										pendingLabel={deletion.isPending ? 'Deleting…' : null}
									>
										<Icon name="trash-2" height={16} width={16} />
										Delete dashboard
									</Button>
								</div>
							) : null}
						</fieldset>
						{failureMessage && !showDeleteConfirm ? (
							<InlineStatus variant="error">{failureMessage}</InlineStatus>
						) : null}
					</DialogBody>
					<DialogFooter
						dismiss={
							<Button type="button" size="md" onClick={onClose} disabled={busy}>
								Cancel
							</Button>
						}
					>
						<Button
							type="submit"
							variant="primary"
							size="md"
							disabled={deletion.isPending}
							pendingLabel={save.isPending ? 'Saving…' : null}
						>
							Save changes
						</Button>
					</DialogFooter>
					<span role="status" className="sr-only">
						{save.isPending ? 'Saving dashboard changes' : ''}
					</span>
				</form>
			</Dialog>

			<ConfirmationModal
				isOpen={showDeleteConfirm}
				onClose={() => setShowDeleteConfirm(false)}
				onConfirm={handleConfirmDelete}
				closeOnConfirm={false}
				pending={deletion.isPending}
				pendingText="Deleting…"
				error={deletion.isError ? 'Could not delete the dashboard. Try again.' : null}
				title="Delete dashboard"
				message={`Deleting “${dashboardName}” cannot be undone.`}
				confirmText="Delete"
			/>
		</>
	)
}

export function DashboardSettingsModal(props: DashboardSettingsModalProps) {
	const modalKey = `${props.dashboardId ?? 'new'}:${props.isOpen ? 'open' : 'closed'}`
	return <DashboardSettingsModalInner key={modalKey} {...props} />
}
