import * as Ariakit from '@ariakit/react'
import { useRef, useState, type RefObject } from 'react'
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
	const [name, setName] = useState('')
	const [content, setContent] = useState('')
	// Set by a submit with an empty field; each field error then follows what is typed.
	const [submitted, setSubmitted] = useState(false)
	const add = useAddTextFile(projectId)
	// The last failed save, not the mutation's error: that one clears as soon as a retry starts.
	const [failed, setFailed] = useState(false)
	const nameError = submitted && !name.trim() ? 'Enter a filename.' : null
	const contentError = submitted && !content ? 'Enter the text to add.' : null
	// The server can accept the request and still skip the file, e.g. at the project's file limit.
	const skippedReason =
		add.data && add.data.imported.length === 0 && add.data.skipped.length > 0 ? add.data.skipped[0].reason : null

	const submit = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (add.isPending) return
		const trimmedName = name.trim()
		if (!trimmedName || !content) return showFieldErrors(e.currentTarget, () => setSubmitted(true))
		void add.mutateAsync({ name: trimmedName, content }).then(
			(result) => {
				setFailed(false)
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
				if (formRef.current?.isConnected) setFailed(true)
				else toast.error("Couldn't add the text content.")
			}
		)
	}

	return (
		<Dialog store={dialogStore} size="md" pending={add.isPending} finalFocus={finalFocus} unmountOnHide portal>
			<form ref={formRef} noValidate onSubmit={submit} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader
					title="Add text content"
					subtitle="Paste a note, prompt, or any plain-text content for this project."
				/>
				<DialogDiscardGuard
					when={name.trim() !== '' || content.trim() !== ''}
					title="Discard this text?"
					description="The text you entered is not added to the project."
				/>
				<DialogBody>
					<Field label="Filename" error={nameError}>
						{(control) => (
							<Ariakit.Focusable
								autoFocus
								render={
									<Input
										{...control}
										required
										readOnly={add.isPending}
										maxLength={255}
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder="notes.md"
										className="font-mono"
									/>
								}
							/>
						)}
					</Field>

					<Field label="Content" error={contentError}>
						{(control) => (
							<textarea
								{...control}
								required
								readOnly={add.isPending}
								rows={12}
								value={content}
								onChange={(e) => setContent(e.target.value)}
								placeholder="# my note&#10;Anything goes here…"
								className={`${textareaStyles} resize-y font-mono`}
							/>
						)}
					</Field>

					{failed ? (
						<InlineStatus variant="error">Couldn&apos;t add the text content. Try again.</InlineStatus>
					) : skippedReason ? (
						<InlineStatus variant="error">{skippedReason}</InlineStatus>
					) : null}
				</DialogBody>
				<DialogFooter dismiss={<DialogCancelButton />}>
					<Button type="submit" size="md" variant="primary" pendingLabel={add.isPending ? 'Saving…' : null}>
						Save
					</Button>
				</DialogFooter>
			</form>
		</Dialog>
	)
}
