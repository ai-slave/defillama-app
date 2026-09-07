import * as Ariakit from '@ariakit/react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '~/ui/Icon'
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
				className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(440px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-ai-line bg-surface p-5 shadow-2xl"
				backdrop={<div className="backdrop fixed inset-0 bg-ai-backdrop backdrop-blur-md" />}
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
	const [name, setName] = useState(project?.name ?? '')
	const [description, setDescription] = useState(project?.description ?? '')

	const submit = async (e: { preventDefault: () => void }) => {
		e.preventDefault()
		const trimmed = name.trim()
		if (!trimmed || create.isPending || update.isPending) return
		const payload = { name: trimmed, description: description.trim() || null }
		// Both read through an optional chain, which the compiler cannot lower inside a try or catch, so
		// they are called out to instead. The form can unmount while the request is still running, which
		// is why the check has to happen after the await rather than before the try.
		const isStillMounted = () => formRef.current?.isConnected === true
		const notifyCreated = (created: Project) => onCreated?.(created)
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
		<form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
			<header className="flex items-start justify-between">
				<div>
					<Ariakit.DialogHeading className="text-base font-semibold text-primary">
						{mode === 'rename' ? 'Rename project' : 'New project'}
					</Ariakit.DialogHeading>
					<p className="mt-0.5 text-xs text-ai-tertiary">Group sessions and give them shared file knowledge.</p>
				</div>
				<Ariakit.DialogDismiss
					disabled={isPending}
					aria-label="Close project dialog"
					className="-mr-1.5 rounded-lg p-2 text-ai-tertiary transition-colors hover:bg-ai-hover hover:text-ai-primary"
				>
					<Icon name="x" height={16} width={16} />
				</Ariakit.DialogDismiss>
			</header>

			<label className="flex flex-col gap-1.5">
				<span className="text-xs font-medium text-ai-secondary">Name</span>
				<input
					ref={nameRef}
					autoFocus
					required
					disabled={isPending}
					maxLength={120}
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="My research project"
					className="rounded-md border border-ai-line bg-surface px-3 py-2 text-sm text-inherit placeholder:text-ai-muted focus:border-brand focus:outline-hidden"
				/>
			</label>

			<label className="flex flex-col gap-1.5">
				<span className="text-xs font-medium text-ai-secondary">Description (optional)</span>
				<textarea
					disabled={isPending}
					rows={3}
					maxLength={500}
					value={description ?? ''}
					onChange={(e) => setDescription(e.target.value)}
					placeholder="What's this project about?"
					className="resize-none rounded-md border border-ai-line bg-surface px-3 py-2 text-sm text-inherit placeholder:text-ai-muted focus:border-brand focus:outline-hidden"
				/>
			</label>

			{create.error || update.error ? (
				<p role="alert" className="text-sm text-ai-error">
					{(create.error || update.error)?.message} Edit the project or retry saving.
				</p>
			) : null}
			<footer className="mt-1 flex justify-end gap-2">
				<Ariakit.DialogDismiss
					type="button"
					disabled={isPending}
					className="rounded-md px-3 py-1.5 text-xs text-ai-tertiary hover:bg-ai-surface-muted"
				>
					Cancel
				</Ariakit.DialogDismiss>
				<Ariakit.Button
					accessibleWhenDisabled
					type="submit"
					disabled={!name.trim() || isPending}
					className="flex items-center gap-1.5 rounded-md border border-brand bg-brand px-3 py-1.5 text-xs font-medium text-ai-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{isPending ? <LoadingSpinner size={12} /> : null}
					{isPending ? (mode === 'rename' ? 'Saving…' : 'Creating…') : mode === 'rename' ? 'Save' : 'Create project'}
				</Ariakit.Button>
			</footer>
		</form>
	)
}
