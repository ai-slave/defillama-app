import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { Icon } from '~/ui/Icon'
import { ProButton, ProDialog, proInputStyles } from '../ui'
import { ConfirmationModal } from './ConfirmationModal'
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
}

function visibilityCardStyles(selected: boolean) {
	return `relative flex-1 cursor-pointer rounded-md border px-4 py-3 text-center text-sm transition-colors has-focus-visible:focus-ring ${
		selected
			? 'border-brand bg-pro-info-100/60 text-pro-text-primary'
			: 'border-pro-cards-border text-pro-text-secondary hover:text-pro-text-primary'
	}`
}

function DashboardSettingsModalInner({
	isOpen,
	onClose,
	dashboardName,
	visibility,
	tags,
	dashboardId,
	onSave,
	onDelete
}: DashboardSettingsModalProps) {
	const id = useId()
	const { hasActiveSubscription } = useAuthContext()
	const [localVisibility, setLocalVisibility] = useState(visibility)
	const [localTags, setLocalTags] = useState(tags)
	// Each opening mounts a new form; late errors belong to the dismissed opening.
	const formRef = useRef<HTMLFormElement>(null)
	const save = useMutation({
		mutationFn: (overrides: Parameters<typeof onSave>[0]) => onSave(overrides),
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
	const tagInputRef = useRef<HTMLInputElement>(null)

	const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (save.isPending || deletion.isPending) return
		save.mutate(
			{ visibility: localVisibility, tags: localTags },
			{
				onSuccess: () => {
					toast.success('Settings saved', statusToastOptions('dashboard-settings-saved', TOAST_DURATION_SHORT))
					onClose()
				}
			}
		)
	}

	const handleAddTag = () => {
		const input = tagInputRef.current
		if (!input) return
		const trimmedTag = input.value.trim().toLowerCase()
		if (trimmedTag) {
			setLocalTags((prev) => (prev.includes(trimmedTag) ? prev : [...prev, trimmedTag]))
		}
		input.value = ''
	}

	const handleRemoveTag = (tag: string) => {
		setLocalTags((prev) => prev.filter((t) => t !== tag))
	}

	const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			if (save.isPending || deletion.isPending) return
			e.preventDefault()
			handleAddTag()
		}
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
			? 'Could not delete the dashboard. Please try again.'
			: save.isError
				? 'Could not save changes. Your draft is still here; please try again.'
				: null

	return (
		<>
			<Ariakit.DialogProvider
				open={isOpen}
				setOpen={(open) => {
					if (!open) onClose()
				}}
			>
				<ProDialog
					width="sm"
					heading="Dashboard Settings"
					closeButtonProps={{ ariaLabel: 'Close dashboard settings' }}
					hideOnInteractOutside
				>
					<form ref={formRef} onSubmit={handleSave}>
						<fieldset className="min-w-0 space-y-6">
							<div>
								<p id="dashboard-settings-visibility" className="mb-3 block text-sm font-medium text-pro-text-primary">
									Visibility
								</p>
								<Ariakit.RadioProvider
									value={localVisibility}
									setValue={(value) => setLocalVisibility(value as 'public' | 'private')}
								>
									<Ariakit.RadioGroup className="flex gap-3" aria-labelledby="dashboard-settings-visibility">
										<label htmlFor={`${id}-public`} className={visibilityCardStyles(localVisibility === 'public')}>
											<Ariakit.Radio
												id={`${id}-public`}
												value="public"
												accessibleWhenDisabled
												disabled={save.isPending || deletion.isPending}
												className="sr-only"
												tabIndex={!hasActiveSubscription && localVisibility === 'private' ? 0 : undefined}
											/>
											<Icon name="earth" height={16} width={16} className="mr-2 inline" />
											Public
										</label>
										<label
											htmlFor={`${id}-private`}
											className={`${visibilityCardStyles(localVisibility === 'private')} ${
												!hasActiveSubscription && localVisibility !== 'private' ? 'cursor-not-allowed opacity-50' : ''
											}`}
										>
											<Ariakit.Radio
												id={`${id}-private`}
												value="private"
												className="sr-only"
												accessibleWhenDisabled={hasActiveSubscription}
												disabled={!hasActiveSubscription || save.isPending || deletion.isPending}
											/>
											<Icon
												name={hasActiveSubscription ? 'key' : 'file-lock-2'}
												height={16}
												width={16}
												className="mr-2 inline"
											/>
											Private
											{!hasActiveSubscription ? <span className="ml-1 text-xs opacity-70">(Pro)</span> : null}
										</label>
									</Ariakit.RadioGroup>
								</Ariakit.RadioProvider>
								{localVisibility === 'public' ? (
									<p className="mt-2 text-sm text-pro-text-tertiary">
										Public dashboards are visible in the Discover tab
									</p>
								) : null}
								{!hasActiveSubscription ? (
									<p className="mt-2 text-xs text-pro-text-tertiary">Upgrade to Pro to make dashboards private</p>
								) : null}
							</div>

							<div>
								<label
									htmlFor="dashboard-settings-tag-input"
									className="mb-3 block text-sm font-medium text-pro-text-primary"
								>
									Tags
								</label>
								<div className="flex gap-2">
									<input
										id="dashboard-settings-tag-input"
										ref={tagInputRef}
										readOnly={save.isPending || deletion.isPending}
										type="text"
										onKeyDown={handleTagInputKeyDown}
										placeholder="Enter tag name"
										className={`${proInputStyles} min-w-0 flex-1`}
									/>
									<ProButton
										type="button"
										variant="secondary"
										onClick={handleAddTag}
										disabled={save.isPending || deletion.isPending}
									>
										Add Tag
									</ProButton>
								</div>

								<p className="mt-2 text-xs text-pro-text-tertiary">Press Enter to add tag</p>

								{localTags.length > 0 ? (
									<div className="mt-3 flex flex-wrap gap-2">
										{localTags.map((tag) => (
											<span
												key={tag}
												className="flex max-w-full items-center gap-1 rounded-md border border-pro-cards-border px-3 py-1 text-sm text-pro-text-secondary"
											>
												<span className="min-w-0 wrap-anywhere">{tag}</span>
												<button
													type="button"
													onClick={() => handleRemoveTag(tag)}
													disabled={save.isPending || deletion.isPending}
													aria-label={`Remove tag ${tag}`}
													title={`Remove tag ${tag}`}
													className="hover:text-pro-info-400"
												>
													<Icon name="x" height={12} width={12} />
												</button>
											</span>
										))}
									</div>
								) : null}
							</div>

							{onDelete && dashboardId ? (
								<div className="border-t border-pro-cards-border pt-6">
									<p className="mb-3 block text-sm font-medium text-error">Danger Zone</p>
									<p className="mb-4 text-sm text-pro-text-tertiary">
										Once you delete a dashboard, there is no going back.
									</p>
									<ProButton
										type="button"
										variant="danger"
										onClick={handleDeleteClick}
										disabled={save.isPending}
										icon={<Icon name="trash-2" height={16} width={16} />}
										{...(deletion.isPending ? { loading: true } : {})}
									>
										<span>Delete Dashboard</span>
									</ProButton>
								</div>
							) : null}
						</fieldset>
						{failureMessage && !showDeleteConfirm ? (
							<p role="alert" className="mt-4 text-sm text-error">
								{failureMessage}
							</p>
						) : null}

						<div className="mt-8 flex gap-3">
							<Ariakit.DialogDismiss type="button" render={<ProButton variant="secondary" className="flex-1" />}>
								Cancel
							</Ariakit.DialogDismiss>
							<Ariakit.Button
								type="submit"
								accessibleWhenDisabled
								disabled={save.isPending || deletion.isPending}
								render={
									<ProButton variant="primary" className="flex-1" {...(save.isPending ? { loading: true } : {})} />
								}
							>
								<span>{save.isPending ? 'Saving…' : 'Save Changes'}</span>
							</Ariakit.Button>
							<span role="status" className="sr-only">
								{save.isPending ? 'Saving dashboard changes' : ''}
							</span>
						</div>
					</form>
				</ProDialog>
			</Ariakit.DialogProvider>

			<ConfirmationModal
				isOpen={showDeleteConfirm}
				onClose={() => setShowDeleteConfirm(false)}
				onConfirm={handleConfirmDelete}
				closeOnConfirm={false}
				pending={deletion.isPending}
				pendingText="Deleting…"
				error={deletion.isError ? 'Could not delete the dashboard. Please try again.' : null}
				title="Delete Dashboard"
				message={`Are you sure you want to delete “${dashboardName}”? This action cannot be undone.`}
				confirmText="Delete"
				cancelText="Cancel"
			/>
		</>
	)
}

export function DashboardSettingsModal(props: DashboardSettingsModalProps) {
	const modalKey = `${props.dashboardId ?? 'new'}:${props.isOpen ? 'open' : 'closed'}`
	return <DashboardSettingsModalInner key={modalKey} {...props} />
}
