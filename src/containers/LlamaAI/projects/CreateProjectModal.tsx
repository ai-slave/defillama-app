import * as Ariakit from '@ariakit/react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import {
	Dialog,
	DialogBody,
	DialogCancelButton,
	DialogDiscardGuard,
	DialogFooter,
	DialogHeader,
	useOpeningKey
} from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input, Textarea } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { useCreateProject, useProjectUsage, useUpdateProject } from './hooks'
import type { Project } from './types'

interface CreateProjectModalProps {
	dialogStore: Ariakit.DialogStore
	finalFocus?: React.RefObject<HTMLElement | null>
	/** The project to rename; without one the dialog creates a project. */
	project?: Project | null
	onCreated?: (project: Project) => void
}

// Each opening starts from the saved project, and a closing dialog keeps its draft through the fade-out.
export function CreateProjectModal(props: CreateProjectModalProps) {
	const open = Ariakit.useStoreState(props.dialogStore, 'open')
	return <CreateProjectDialog key={useOpeningKey(open)} {...props} />
}

function CreateProjectDialog({ dialogStore, project = null, finalFocus, onCreated }: CreateProjectModalProps) {
	const formRef = useRef<HTMLFormElement>(null)
	const [name, setName] = useState(project?.name ?? '')
	const [description, setDescription] = useState(project?.description ?? '')
	// Set by a submit with an empty name; the field error then follows what is typed.
	const [submitted, setSubmitted] = useState(false)
	const create = useCreateProject()
	const update = useUpdateProject(project?.id ?? '')
	const isRename = project !== null
	const pending = create.isPending || update.isPending
	// The last failed save, not the mutations' errors: those clear as soon as a retry starts.
	const [failed, setFailed] = useState(false)
	const nameError = submitted && !name.trim() ? 'Enter a name for the project.' : null
	const edited = name.trim() !== (project?.name ?? '') || description.trim() !== (project?.description ?? '')
	// The server refuses a project past the plan's cap, so say so up front instead of after a failed create.
	const usage = useProjectUsage(!isRename)
	const projectCap = isRename ? null : (usage.data?.limits.projects ?? null)
	const atCap = projectCap !== null && usage.data!.project_count >= projectCap

	// The compiler cannot lower optional chains or conditionals inside a try or catch, so submit reads
	// them before the try or calls out to these. The dialog can unmount while the request is still running (its host
	// re-keys it), which is why the check has to happen after the await rather than before the try.
	const isStillMounted = () => formRef.current?.isConnected === true
	const notifyCreated = (created: Project) => onCreated?.(created)

	const submit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (pending || atCap) return
		const trimmed = name.trim()
		if (!trimmed) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
		const payload = { name: trimmed, description: description.trim() || null }
		const doneMessage = isRename ? 'Project updated' : 'Project created'
		const failedMessage = isRename ? "Couldn't save the project." : "Couldn't create the project."
		try {
			if (isRename) {
				await update.mutateAsync(payload)
			} else {
				const created = await create.mutateAsync(payload)
				if (isStillMounted()) notifyCreated(created)
			}
			if (isStillMounted()) dialogStore.hide()
			else toast.success(doneMessage)
		} catch {
			// The dialog shows the error while it is open; after it closes, only a toast can.
			if (isStillMounted()) setFailed(true)
			else toast.error(failedMessage)
		}
	}

	return (
		<Dialog store={dialogStore} size="sm" pending={pending} finalFocus={finalFocus} unmountOnHide portal>
			<form ref={formRef} noValidate onSubmit={submit} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader
					title={isRename ? 'Rename project' : 'New project'}
					subtitle="Group sessions and give them shared file knowledge."
				/>
				<DialogDiscardGuard
					when={edited}
					title={isRename ? 'Discard your changes?' : 'Discard this project?'}
					description={
						isRename ? 'Your changes to the project are not saved.' : 'The project you started is not created.'
					}
				/>
				<DialogBody>
					<Field label="Name" error={nameError}>
						{(control) => (
							<Ariakit.Focusable
								autoFocus
								render={
									<Input
										{...control}
										required
										readOnly={pending}
										maxLength={120}
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="My research project"
									/>
								}
							/>
						)}
					</Field>

					<Field label="Description (optional)">
						{(control) => (
							<Textarea
								{...control}
								readOnly={pending}
								rows={3}
								maxLength={500}
								value={description ?? ''}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="What's this project about?"
								className="resize-none"
							/>
						)}
					</Field>

					{atCap ? (
						<InlineStatus variant="warning">
							{`Your plan allows ${projectCap} projects. Delete one to create another.`}
						</InlineStatus>
					) : null}
					{failed ? (
						<InlineStatus variant="error">
							{isRename ? "Couldn't save the project. Try again." : "Couldn't create the project. Try again."}
						</InlineStatus>
					) : null}
				</DialogBody>
				<DialogFooter dismiss={<DialogCancelButton />}>
					<Button
						type="submit"
						size="md"
						variant="primary"
						disabled={atCap}
						pendingLabel={isRename ? 'Saving…' : 'Creating…'}
						pending={pending}
					>
						{isRename ? 'Save' : 'Create project'}
					</Button>
				</DialogFooter>
			</form>
		</Dialog>
	)
}
