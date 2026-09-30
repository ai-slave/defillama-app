import * as Ariakit from '@ariakit/react'
import { useId, useMemo, useState } from 'react'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Input, textareaStyles } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tag } from '~/ui/Tag'
import { detectEmbed, getEmbedProviderLabel, type EmbedDetection } from '../embedProviders'
import type { ArticleEmbedAspectRatio, ArticleEmbedConfig } from '../types'

type Props = {
	store: Ariakit.DialogStore
	onInsert: (config: ArticleEmbedConfig) => void
	initialConfig?: ArticleEmbedConfig | null
}

const ASPECT_OPTIONS: Array<{ value: ArticleEmbedAspectRatio; label: string }> = [
	{ value: '16/9', label: '16 : 9' },
	{ value: '4/3', label: '4 : 3' },
	{ value: '1/1', label: '1 : 1' },
	{ value: 'auto', label: 'Auto' }
]

export function EmbedPicker({ store, onInsert, initialConfig }: Props) {
	const urlId = useId()
	const titleId = useId()
	const captionId = useId()
	const aspectId = useId()
	const [rawUrl, setRawUrl] = useState(initialConfig?.sourceUrl ?? '')
	const [title, setTitle] = useState(initialConfig?.title ?? '')
	const [caption, setCaption] = useState(initialConfig?.caption ?? '')
	const [aspectRatio, setAspectRatio] = useState<ArticleEmbedAspectRatio | null>(initialConfig?.aspectRatio ?? null)

	const detection: EmbedDetection | null = useMemo(() => detectEmbed(rawUrl), [rawUrl])
	const invalid = rawUrl.trim().length > 0 && !detection

	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!detection) return
		const config: ArticleEmbedConfig = {
			provider: detection.provider,
			url: detection.url,
			sourceUrl: detection.sourceUrl
		}
		const trimmedTitle = title.trim()
		const trimmedCaption = caption.trim()
		if (trimmedTitle) config.title = trimmedTitle
		if (trimmedCaption) config.caption = trimmedCaption
		const finalAspect = aspectRatio || detection.aspectRatio
		if (finalAspect) config.aspectRatio = finalAspect
		onInsert(config)
		store.hide()
	}

	const aspectValue = aspectRatio || detection?.aspectRatio || '16/9'

	return (
		<Dialog store={store} size="md" unmountOnHide portal>
			<form onSubmit={submit} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader title={initialConfig ? 'Edit embed' : 'Insert embed'} />
				<DialogBody>
					<div className="flex flex-col gap-1.5">
						<label htmlFor={urlId} className="label-sm text-secondary">
							URL
						</label>
						<Ariakit.Focusable
							autoFocus
							render={
								<Input
									id={urlId}
									inputMode="url"
									aria-describedby={`${urlId}-detection`}
									aria-invalid={invalid || undefined}
									value={rawUrl}
									onChange={(e) => setRawUrl(e.target.value)}
									placeholder="https://www.youtube.com/watch?v=…"
								/>
							}
						/>
						{/* The primary action stays disabled until this line recognises the URL, so it also says why. */}
						<p id={`${urlId}-detection`} className="body-sm">
							{invalid ? (
								<span className="text-data-down">
									This URL isn&apos;t from a supported source. Use a tweet, YouTube, Telegram, Flourish, Datawrapper,
									Medium, Substack or GitHub gist link.
								</span>
							) : detection ? (
								<span className="flex min-w-0 items-center gap-2">
									<Tag className="shrink-0">{getEmbedProviderLabel(detection.provider)}</Tag>
									<span className="truncate text-tertiary">{detection.url}</span>
								</span>
							) : (
								<span className="text-tertiary">
									Paste a tweet, YouTube video, Telegram post, Flourish or Datawrapper chart, Medium or Substack post,
									or GitHub gist. Other sources can&apos;t be embedded.
								</span>
							)}
						</p>
					</div>

					<div className="flex flex-col gap-1.5">
						<label htmlFor={titleId} className="label-sm text-secondary">
							Title (optional)
						</label>
						<Input
							id={titleId}
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Short label shown above the embed"
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<label htmlFor={captionId} className="label-sm text-secondary">
							Caption (optional)
						</label>
						<textarea
							id={captionId}
							value={caption}
							onChange={(e) => setCaption(e.target.value)}
							rows={2}
							placeholder="Source notes or context shown below the embed"
							className={`${textareaStyles} resize-none`}
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<span id={aspectId} className="label-sm text-secondary">
							Aspect ratio
						</span>
						<SegmentedControl<ArticleEmbedAspectRatio>
							label="Aspect ratio"
							aria-labelledby={aspectId}
							value={aspectValue}
							onValueChange={setAspectRatio}
							options={ASPECT_OPTIONS}
							variant="field"
							size="md"
						/>
					</div>
				</DialogBody>
				<DialogFooter
					dismiss={
						<Ariakit.DialogDismiss type="button" render={<Button size="md" />}>
							Cancel
						</Ariakit.DialogDismiss>
					}
				>
					<Button type="submit" size="md" variant="primary" disabled={!detection}>
						{initialConfig ? 'Update embed' : 'Insert embed'}
					</Button>
				</DialogFooter>
			</form>
		</Dialog>
	)
}
