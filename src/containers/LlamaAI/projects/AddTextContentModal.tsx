import * as Ariakit from '@ariakit/react'
import { useId, useRef, useState, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey } from '~/ui/Dialog'
import { Input, textareaStyles } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { useAddTextFile } from './hooks'

interface AddTextContentModalProps {
	dialogStore: Ariakit.DialogStore
	projectId: string
	finalFocus?: RefObject<HTMLElement | null>
}

// Each opening starts with an empty draft, and a closing dialog keeps it through the fade-out.
export function AddTextContentModal(props: AddTextContentModalProps) {
	const open = Ariakit.useStoreState(props.dialogStore, 'open')
	return <AddTextContentDialog key={useOpeningKey(open)} {...props} />
}

function AddTextContentDialog({ dialogStore, projectId, finalFocus }: AddTextContentModalProps) {
	const formRef = useRef<HTMLFormElement>(null)
	const nameRef = useRef<HTMLInputElement>(null)
	const contentRef = useRef<HTMLTextAreaElement>(null)
	const nameId = useId()
	const contentId = useId()
	const [name, setName] = useState('')
	const [content, setContent] = useState('')
	// Set by a submit with an empty field; each field error then follows what is typed.
	const [checkRequired, setCheckRequired] = useState(false)
	const add = useAddTextFile(projectId)
	const nameMissing = checkRequired && !name.trim()
	const contentMissing = checkRequired && !content
	// The server can accept the request and still skip the file, e.g. at the project's file limit.
	const skippedReason =
		add.data && add.data.imported.length === 0 && add.data.skipped.length > 0 ? add.data.skipped[0].reason : null

	const submit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (add.isPending) return
		const trimmedName = name.trim()
		if (!trimmedName || !content) {
			setCheckRequired(true)
			if (trimmedName) contentRef.current?.focus()
			else nameRef.current?.focus()
			return
		}
		void add.mutateAsync({ name: trimmedName, content }).then(
			(result) => {
				const skipped = result.skipped.length > 0 && result.imported.length === 0
				// The dialog shows the outcome while it is open; after it closes, only a toast can.
				if (!formRef.current?.isConnected) {
					if (skipped) toast.error(result.skipped[0].reason)
					else toast.success('Text content added')
					return
				}
				if (!skipped) dialogStore.hide()
			},
			() => {
				if (!formRef.current?.isConnected) toast.error("Couldn't add the text content.")
			}
		)
	}

	return (
		<Dialog store={dialogStore} size="md" pending={add.isPending} finalFocus={finalFocus} unmountOnHide portal>
			<form ref={formRef} onSubmit={submit} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader
					title="Add text content"
					subtitle="Paste a note, prompt, or any plain-text content for this project."
				/>
				<DialogBody>
					<div className="flex flex-col gap-1.5">
						<label htmlFor={nameId} className="label-sm text-secondary">
							Filename
						</label>
						<Ariakit.Focusable
							autoFocus
							render={
								<Input
									id={nameId}
									ref={nameRef}
									readOnly={add.isPending}
									maxLength={255}
									value={name}
									onChange={(e) => setName(e.target.value)}
									aria-invalid={nameMissing || undefined}
									aria-describedby={nameMissing ? `${nameId}-error` : undefined}
									placeholder="notes.md"
									className="font-mono"
								/>
							}
						/>
						{nameMissing ? (
							<p id={`${nameId}-error`} role="alert" className="body-sm text-data-down">
								Enter a filename.
							</p>
						) : null}
					</div>

					<div className="flex flex-col gap-1.5">
						<label htmlFor={contentId} className="label-sm text-secondary">
							Content
						</label>
						<textarea
							id={contentId}
							ref={contentRef}
							readOnly={add.isPending}
							rows={12}
							value={content}
							onChange={(e) => setContent(e.target.value)}
							aria-invalid={contentMissing || undefined}
							aria-describedby={contentMissing ? `${contentId}-error` : undefined}
							placeholder="# my note&#10;Anything goes here…"
							className={`${textareaStyles} resize-y font-mono`}
						/>
						{contentMissing ? (
							<p id={`${contentId}-error`} role="alert" className="body-sm text-data-down">
								Enter the text to add.
							</p>
						) : null}
					</div>

					{add.isError ? (
						<InlineStatus variant="error">Couldn&apos;t add the text content. Try again.</InlineStatus>
					) : skippedReason ? (
						<InlineStatus variant="error">{skippedReason}</InlineStatus>
					) : null}
				</DialogBody>
				<DialogFooter
					dismiss={
						<Ariakit.DialogDismiss
							type="button"
							disabled={add.isPending}
							accessibleWhenDisabled
							render={<Button size="md" />}
						>
							Cancel
						</Ariakit.DialogDismiss>
					}
				>
					<Button type="submit" size="md" variant="primary" pendingLabel={add.isPending ? 'Saving…' : null}>
						Save
					</Button>
				</DialogFooter>
			</form>
		</Dialog>
	)
}
