import * as Ariakit from '@ariakit/react'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
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
	return (
		<Dialog store={store} size="sm" portal unmountOnHide>
			<DialogHeader
				title="Cover details"
				subtitle="Captions and attribution shown below the cover. Publishing needs the caption, credit and copyright."
			/>
			<DialogBody>
				{COVER_FIELDS.map(({ key, label, placeholder }) => (
					<Field key={key} label={label} error={publishErrors[`coverImage.${key}`]}>
						{(control) => (
							<Input
								{...control}
								value={article.coverImage?.[key] ?? ''}
								onChange={(e) => updateCoverField(key, e.target.value)}
								placeholder={placeholder}
							/>
						)}
					</Field>
				))}
			</DialogBody>
			<DialogFooter>
				<Ariakit.DialogDismiss render={<Button size="md" variant="primary" />}>Done</Ariakit.DialogDismiss>
			</DialogFooter>
		</Dialog>
	)
}
