import { useMutation } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import {
	Dialog,
	DialogBody,
	DialogCancelButton,
	DialogDiscardGuard,
	DialogFooter,
	DialogHeader,
	useOpeningKey
} from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'
import type { DashboardTeam } from '../dashboardTypes'
import { type DashboardSaveNotices, showDashboardSaveNotices } from '../hooks/useDashboardAPI'
import { dashboardFieldHintStyles, TagsField, VisibilityField } from './DashboardFormFields'
import { statusToastOptions, TOAST_DURATION_SHORT } from './dashboardToasts'

interface DashboardSettingsModalProps {
	isOpen: boolean
	onClose: () => void
	dashboardName: string
	visibility: 'private' | 'public'
	tags: Array<string>
	dashboardId: string | null
	/** Resolves with the save's notices; the modal shows them once it has closed. */
	onSave: (overrides?: { visibility?: 'private' | 'public'; tags?: Array<string> }) => Promise<DashboardSaveNotices>
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
	// The last failed save, not the mutation's error: that one clears as soon as a retry starts. Success closes.
	const [saveFailed, setSaveFailed] = useState(false)
	const save = useMutation({
		mutationFn: async (overrides: Parameters<typeof onSave>[0]) => {
			// The document fields save first: an admin moving a dashboard out loses access to it afterwards.
			const notices = await onSave(overrides)
			if (showTeamSwitch && canMove && myTeam && onMoveTeam && localSharedWithTeam !== sharedWithTeam) {
				await onMoveTeam(localSharedWithTeam ? myTeam.id : null)
			}
			return notices
		},
		onError: (error) => {
			if (formRef.current?.isConnected) setSaveFailed(true)
			else toast.error(error.message)
		}
	})
	const deletion = useMutation({ mutationFn: (idToDelete: string) => onDelete!(idToDelete) })
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const busy = save.isPending || deletion.isPending

	const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (busy) return
		;(e.nativeEvent as SubmitEvent).submitter?.focus()
		save.mutate(
			{ visibility: localVisibility, tags: localTags },
			{
				// Confirm only once the dialog is gone, so the toasts never sit over it.
				onSuccess: (notices) => {
					onClose()
					toast.success('Settings saved', statusToastOptions('dashboard-settings-saved', TOAST_DURATION_SHORT))
					showDashboardSaveNotices(notices)
				}
			}
		)
	}

	const dirty =
		localVisibility !== visibility || localSharedWithTeam !== sharedWithTeam || localTags.join('\n') !== tags.join('\n')

	return (
		<>
			<Dialog size="sm" open={isOpen} onClose={onClose} pending={busy} portal unmountOnHide>
				<form ref={formRef} noValidate onSubmit={handleSave} className="flex min-h-0 flex-auto flex-col">
					<DialogDiscardGuard
						when={dirty}
						title="Discard your changes?"
						description="Your settings changes are not saved."
					/>
					<DialogHeader title="Dashboard settings" />
					<DialogBody>
						{/* The fields lock while a request runs; the footer's Save, outside them, keeps focus and its label. */}
						<fieldset disabled={busy} className="flex min-w-0 flex-col gap-4">
							<VisibilityField
								value={localVisibility}
								onChange={setLocalVisibility}
								sharedWithTeam={localSharedWithTeam}
							/>

							{showTeamSwitch && myTeam ? (
								<div className="flex flex-col gap-1.5">
									{/* A locked choice keeps full contrast; the line below says why it is locked. */}
									<Checkbox
										variant="consent"
										id={`${id}-share-team`}
										checked={localSharedWithTeam}
										disabled={!canMove || !hasActiveSubscription}
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

							<TagsField tags={localTags} onChange={setLocalTags} />

							{onDelete && dashboardId ? (
								<div className="border-t border-subtle pt-4">
									<p className="mb-1.5 block label-sm text-error">Danger zone</p>
									<p className="mb-3 body-sm text-tertiary">Once you delete a dashboard, there is no going back.</p>
									<Button type="button" variant="destructive" size="md" onClick={() => setShowDeleteConfirm(true)}>
										<Icon name="trash-2" height={16} width={16} />
										Delete dashboard
									</Button>
								</div>
							) : null}
						</fieldset>
						{/* A failed delete explains itself in its confirm. */}
						{saveFailed ? (
							<InlineStatus variant="error">Could not save changes. Your draft is still here. Try again.</InlineStatus>
						) : null}
					</DialogBody>
					<DialogFooter dismiss={<DialogCancelButton />}>
						<Button type="submit" variant="primary" size="md" pendingLabel={save.isPending ? 'Saving…' : null}>
							Save changes
						</Button>
					</DialogFooter>
					<span role="status" className="sr-only">
						{save.isPending ? 'Saving dashboard changes' : ''}
					</span>
				</form>
			</Dialog>

			{showDeleteConfirm && dashboardId ? (
				<ConfirmActionDialog
					title="Delete dashboard"
					description={`Deleting “${dashboardName}” cannot be undone.`}
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					mutation={deletion}
					variables={dashboardId}
					onClose={() => setShowDeleteConfirm(false)}
					onSuccess={onClose}
				/>
			) : null}
		</>
	)
}

export function DashboardSettingsModal(props: DashboardSettingsModalProps) {
	const openingKey = useOpeningKey(props.isOpen)
	return <DashboardSettingsModalInner key={`${props.dashboardId ?? 'new'}:${openingKey}`} {...props} />
}
