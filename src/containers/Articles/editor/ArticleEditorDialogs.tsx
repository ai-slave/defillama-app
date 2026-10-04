import * as Ariakit from '@ariakit/react'
import { useId } from 'react'
import { Button } from '~/ui/Button'
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
