import * as Ariakit from '@ariakit/react'
import { useId, type Ref } from 'react'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Input } from '~/ui/Input'
import type { LocalArticleDocument } from '../types'

type DialogStore = ReturnType<typeof Ariakit.useDialogStore>

type CoverField = 'headline' | 'caption' | 'credit' | 'copyright'

type CoverDetailsDialogProps = {
	article: LocalArticleDocument
	publishErrors: Record<string, string>
	store: DialogStore
	updateCoverField: (key: CoverField, value: string) => void
}

const COVER_FIELDS: Array<{ key: CoverField; label: string; placeholder: string }> = [
	{ key: 'headline', label: 'Headline', placeholder: 'Image title' },
	{ key: 'caption', label: 'Caption', placeholder: 'Caption shown under the cover' },
	{ key: 'credit', label: 'Credit', placeholder: 'Photographer' },
	{ key: 'copyright', label: 'Copyright', placeholder: 'Rights holder' }
]

// The fields write straight to the article, so there is nothing to cancel: Done only closes.
export function CoverDetailsDialog({ article, publishErrors, store, updateCoverField }: CoverDetailsDialogProps) {
	const id = useId()
	return (
		<Dialog store={store} size="sm" portal unmountOnHide>
			<DialogHeader title="Cover details" subtitle="Optional captions and attribution shown below the cover." />
			<DialogBody>
				{COVER_FIELDS.map(({ key, label, placeholder }) => {
					const fieldId = `${id}-${key}`
					const error = publishErrors[`coverImage.${key}`]
					return (
						<div key={key} className="flex flex-col gap-1.5">
							<label htmlFor={fieldId} className="label-sm text-secondary">
								{label}
							</label>
							<Input
								id={fieldId}
								value={article.coverImage?.[key] ?? ''}
								onChange={(e) => updateCoverField(key, e.target.value)}
								placeholder={placeholder}
								aria-invalid={error ? true : undefined}
								aria-describedby={error ? `${fieldId}-error` : undefined}
							/>
							{error ? (
								<p id={`${fieldId}-error`} className="body-sm text-data-down">
									{error}
								</p>
							) : null}
						</div>
					)
				})}
			</DialogBody>
			<DialogFooter>
				<Ariakit.DialogDismiss render={<Button size="md" variant="primary" />}>Done</Ariakit.DialogDismiss>
			</DialogFooter>
		</Dialog>
	)
}

type DeleteArticleDialogProps = {
	failed: boolean
	isPending: boolean
	isPublished: boolean
	ref: Ref<HTMLDivElement>
	store: DialogStore
	title: string
	confirmDeleteArticle: () => void
}

export function DeleteArticleDialog({
	confirmDeleteArticle,
	failed,
	isPending,
	isPublished,
	ref,
	store,
	title
}: DeleteArticleDialogProps) {
	return (
		<ConfirmDialog
			ref={ref}
			store={store}
			portal
			unmountOnHide
			title={isPublished ? 'Delete this article?' : 'Delete this draft?'}
			description={
				title ? (
					<>
						<span className="font-medium text-primary">{title}</span> will be permanently removed. This cannot be
						undone.
					</>
				) : (
					'This will be permanently removed. This cannot be undone.'
				)
			}
			confirmLabel="Delete"
			pendingLabel={isPending ? 'Deleting…' : null}
			error={failed ? "Couldn't delete this article. Try again." : null}
			onConfirm={confirmDeleteArticle}
		/>
	)
}

type DiscardPendingDialogProps = {
	failed: boolean
	isPending: boolean
	store: DialogStore
	onConfirm: () => void
}

export function DiscardPendingDialog({ failed, isPending, store, onConfirm }: DiscardPendingDialogProps) {
	return (
		<ConfirmDialog
			store={store}
			portal
			unmountOnHide
			title="Discard pending changes?"
			description="Your pending edits are removed and the editor shows the live version again. Readers see no change."
			confirmLabel="Discard changes"
			cancelLabel="Keep changes"
			pendingLabel={isPending ? 'Discarding…' : null}
			error={failed ? "Couldn't discard the pending changes. Try again." : null}
			onConfirm={onConfirm}
		/>
	)
}
