import * as Ariakit from '@ariakit/react'
import { useRef, useState, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '~/ui/Icon'
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
				className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-ai-line bg-surface p-5 shadow-2xl"
				backdrop={<div className="backdrop fixed inset-0 bg-ai-backdrop backdrop-blur-md" />}
				unmountOnHide
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
		<form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
			<header className="flex items-start justify-between">
				<div>
					<Ariakit.DialogHeading className="text-base font-semibold text-primary">
						Add text content
					</Ariakit.DialogHeading>
					<p className="mt-0.5 text-xs text-ai-tertiary">
						Paste a note, prompt, or any plain-text content for this project.
					</p>
				</div>
				<Ariakit.DialogDismiss
					aria-label="Close text content dialog"
					className="-mr-1.5 rounded-lg p-2 text-ai-tertiary transition-colors hover:bg-ai-hover hover:text-ai-primary"
				>
					<Icon name="x" height={16} width={16} />
				</Ariakit.DialogDismiss>
			</header>

			<label className="flex flex-col gap-1.5">
				<span className="text-xs font-medium text-ai-secondary">Filename</span>
				<input
					ref={nameRef}
					disabled={add.isPending}
					required
					maxLength={255}
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="notes.md"
					className="rounded-md border border-ai-line bg-surface px-3 py-2 font-mono text-sm text-inherit placeholder:text-ai-muted focus:border-brand focus:outline-hidden"
				/>
			</label>

			<label className="flex flex-col gap-1.5">
				<span className="text-xs font-medium text-ai-secondary">Content</span>
				<textarea
					disabled={add.isPending}
					required
					rows={12}
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder="# my note&#10;Anything goes here…"
					className="resize-y rounded-md border border-ai-line bg-surface px-3 py-2 font-mono text-xs text-inherit placeholder:text-ai-muted focus:border-brand focus:outline-hidden"
				/>
			</label>

			{add.isError || (add.data?.skipped.length && add.data.imported.length === 0) ? (
				<p role="alert" className="text-sm text-ai-error">
					{add.error?.message ?? add.data?.skipped[0].reason}
				</p>
			) : null}
			<footer className="mt-1 flex justify-end gap-2">
				<Ariakit.DialogDismiss
					type="button"
					className="rounded-md px-3 py-1.5 text-xs text-ai-tertiary hover:bg-ai-surface-muted"
				>
					Cancel
				</Ariakit.DialogDismiss>
				<button
					type="submit"
					disabled={!name.trim() || !content || add.isPending}
					className="flex items-center gap-1.5 rounded-md border border-brand bg-brand px-3 py-1.5 text-xs font-medium text-ai-white transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{add.isPending ? <LoadingSpinner size={12} /> : null}
					{add.isPending ? 'Saving…' : 'Save'}
				</button>
			</footer>
		</form>
	)
}
