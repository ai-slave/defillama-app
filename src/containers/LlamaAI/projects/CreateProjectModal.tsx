import * as Ariakit from '@ariakit/react'
import { useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import {
	DialogCloseButton,
	DialogHeading,
	dialogScrollableBodyStyles,
	dialogSurfaceStyles,
	DialogFooter
} from '~/ui/Dialog'
import { Input, textareaStyles } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { getErrorMessage } from '~/utils/error'
import { useCreateProject, useUpdateProject } from './hooks'
import type { Project } from './types'

interface CreateProjectModalProps {
	dialogStore: Ariakit.DialogStore
	finalFocus?: React.RefObject<HTMLElement | null>
	mode?: 'create' | 'rename'
	project?: Project | null
	onCreated?: (project: Project) => void
}

export function CreateProjectModal({
	dialogStore,
	mode = 'create',
	project = null,
	finalFocus,
	onCreated
}: CreateProjectModalProps) {
	const nameRef = useRef<HTMLInputElement>(null)
	const create = useCreateProject()
	const update = useUpdateProject(project?.id ?? '')
	const pending = create.isPending || update.isPending
	const isOpen = Ariakit.useStoreState(dialogStore, 'open')

	return (
		<Ariakit.DialogProvider store={dialogStore}>
			<Ariakit.Dialog
				initialFocus={nameRef}
				finalFocus={finalFocus}
				onClose={() => {
					create.reset()
					update.reset()
				}}
				hideOnEscape={!pending}
				hideOnInteractOutside={!pending}
				className={`${dialogSurfaceStyles} [--dialog-width:448px]`}
				unmountOnHide
				portal
			>
				{isOpen ? (
					<CreateProjectForm
						key={`${mode}-${project?.id ?? 'new'}`}
						dialogStore={dialogStore}
						mode={mode}
						project={project}
						onCreated={onCreated}
						nameRef={nameRef}
						create={create}
						update={update}
					/>
				) : null}
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

function CreateProjectForm({
	dialogStore,
	mode,
	project,
	onCreated,
	create,
	update,
	nameRef
}: {
	nameRef: React.RefObject<HTMLInputElement | null>
	create: ReturnType<typeof useCreateProject>
	update: ReturnType<typeof useUpdateProject>
} & Required<Pick<CreateProjectModalProps, 'dialogStore' | 'mode'>> &
	Pick<CreateProjectModalProps, 'project' | 'onCreated'>) {
	const formRef = useRef<HTMLFormElement>(null)
	const nameId = useId()
	const descriptionId = useId()
	const [name, setName] = useState(project?.name ?? '')
	const [description, setDescription] = useState(project?.description ?? '')

	// Both read through an optional chain, which the compiler cannot lower inside a try or catch, so
	// submit calls out to them instead. The form can unmount while the request is still running, which
	// is why the check has to happen after the await rather than before the try.
	const isStillMounted = () => formRef.current?.isConnected === true
	const notifyCreated = (created: Project) => onCreated?.(created)

	const submit = async (e: { preventDefault: () => void }) => {
		e.preventDefault()
		const trimmed = name.trim()
		if (!trimmed || create.isPending || update.isPending) return
		const payload = { name: trimmed, description: description.trim() || null }
		const isRename = mode === 'rename' && project != null
		const closedMessage = isRename ? 'Project updated' : 'Project created'
		try {
			if (isRename) {
				await update.mutateAsync(payload)
			} else {
				const created = await create.mutateAsync(payload)
				if (isStillMounted()) notifyCreated(created)
			}
			if (isStillMounted()) dialogStore.hide()
			else toast.success(closedMessage)
		} catch (error) {
			if (!isStillMounted()) toast.error(getErrorMessage(error))
		}
	}

	const isPending = create.isPending || update.isPending

	return (
		<form ref={formRef} onSubmit={submit} className="flex min-h-0 flex-auto flex-col">
			<header className="flex shrink-0 items-start justify-between gap-3 border-b border-subtle px-4 py-3">
				<div className="flex flex-col gap-0.5">
					<DialogHeading>{mode === 'rename' ? 'Rename project' : 'New project'}</DialogHeading>
					<p className="body-sm text-secondary">Group sessions and give them shared file knowledge.</p>
				</div>
				<DialogCloseButton disabled={isPending} ariaLabel="Close project dialog" />
			</header>

			<div className={`${dialogScrollableBodyStyles} flex flex-col gap-4 p-4`}>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={nameId} className="label-sm text-secondary">
						Name
					</label>
					<Input
						id={nameId}
						ref={nameRef}
						autoFocus
						required
						disabled={isPending}
						maxLength={120}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="My research project"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<label htmlFor={descriptionId} className="label-sm text-secondary">
						Description (optional)
					</label>
					<textarea
						id={descriptionId}
						disabled={isPending}
						rows={3}
						maxLength={500}
						value={description ?? ''}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="What's this project about?"
						className={`${textareaStyles} resize-none`}
					/>
				</div>

				{create.error || update.error ? (
					<p role="alert" className="body-sm text-data-down">
						{(create.error || update.error)?.message} Edit the project or retry saving.
					</p>
				) : null}
			</div>
			<DialogFooter
				dismiss={
					<Ariakit.DialogDismiss type="button" disabled={isPending} render={<Button size="md" />}>
						Cancel
					</Ariakit.DialogDismiss>
				}
			>
				<Ariakit.Button
					accessibleWhenDisabled
					type="submit"
					disabled={!name.trim() || isPending}
					render={<Button size="md" variant="primary" />}
				>
					{isPending ? <LoadingSpinner size={14} /> : null}
					{isPending ? (mode === 'rename' ? 'Saving…' : 'Creating…') : mode === 'rename' ? 'Save' : 'Create project'}
				</Ariakit.Button>
			</DialogFooter>
		</form>
	)
}
