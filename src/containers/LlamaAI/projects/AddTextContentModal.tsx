import * as Ariakit from '@ariakit/react'
import { useId, useRef, useState, type RefObject } from 'react'
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
import { useAddTextFile } from './hooks'

interface AddTextContentModalProps {
	dialogStore: Ariakit.DialogStore
	projectId: string
	finalFocus?: RefObject<HTMLElement | null>
}

export function AddTextContentModal({ dialogStore, projectId, finalFocus }: AddTextContentModalProps) {
	const nameRef = useRef<HTMLInputElement>(null)
	return (
		<Ariakit.DialogProvider store={dialogStore}>
			<Ariakit.Dialog
				initialFocus={nameRef}
				finalFocus={finalFocus}
				className={`${dialogSurfaceStyles} [--dialog-width:640px]`}
				unmountOnHide
				portal
			>
				<AddTextContentForm dialogStore={dialogStore} projectId={projectId} nameRef={nameRef} />
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

// Lives inside the dialog, so closing it discards the draft and the next open starts empty.
function AddTextContentForm({
	dialogStore,
	projectId,
	nameRef
}: AddTextContentModalProps & { nameRef: RefObject<HTMLInputElement | null> }) {
	const formRef = useRef<HTMLFormElement>(null)
	const nameId = useId()
	const contentId = useId()
	const [name, setName] = useState('')
	const [content, setContent] = useState('')
	const add = useAddTextFile(projectId)

	const submit = (e: { preventDefault: () => void }) => {
		e.preventDefault()
		const trimmedName = name.trim()
		if (!trimmedName || !content || add.isPending) return
		void add.mutateAsync({ name: trimmedName, content }).then(
			(result) => {
				const skipped = result.skipped.length > 0 && result.imported.length === 0
				if (!formRef.current?.isConnected) {
					if (skipped) toast.error(result.skipped[0].reason)
					else toast.success('Text content added')
					return
				}
				if (!skipped) dialogStore.hide()
			},
			(error: Error) => {
				if (!formRef.current?.isConnected) toast.error(error.message)
			}
		)
	}

	return (
		<form ref={formRef} onSubmit={submit} className="flex min-h-0 flex-auto flex-col">
			<header className="flex shrink-0 items-start justify-between gap-3 border-b border-subtle px-4 py-3">
				<div className="flex flex-col gap-0.5">
					<DialogHeading>Add text content</DialogHeading>
					<p className="body-sm text-secondary">Paste a note, prompt, or any plain-text content for this project.</p>
				</div>
				<DialogCloseButton ariaLabel="Close text content dialog" />
			</header>

			<div className={`${dialogScrollableBodyStyles} flex flex-col gap-4 p-4`}>
				<div className="flex flex-col gap-1.5">
					<label htmlFor={nameId} className="label-sm text-secondary">
						Filename
					</label>
					<Input
						id={nameId}
						ref={nameRef}
						disabled={add.isPending}
						required
						maxLength={255}
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="notes.md"
						className="font-mono"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<label htmlFor={contentId} className="label-sm text-secondary">
						Content
					</label>
					<textarea
						id={contentId}
						disabled={add.isPending}
						required
						rows={12}
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder="# my note&#10;Anything goes here…"
						className={`${textareaStyles} resize-y font-mono`}
					/>
				</div>

				{add.isError || (add.data?.skipped.length && add.data.imported.length === 0) ? (
					<p role="alert" className="body-sm text-data-down">
						{add.error?.message ?? add.data?.skipped[0].reason}
					</p>
				) : null}
			</div>
			<DialogFooter
				dismiss={
					<Ariakit.DialogDismiss type="button" render={<Button size="md" />}>
						Cancel
					</Ariakit.DialogDismiss>
				}
			>
				<Button type="submit" size="md" variant="primary" disabled={!name.trim() || !content || add.isPending}>
					{add.isPending ? <LoadingSpinner size={14} /> : null}
					{add.isPending ? 'Saving…' : 'Save'}
				</Button>
			</DialogFooter>
		</form>
	)
}
