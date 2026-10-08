import * as Ariakit from '@ariakit/react'
import { useId, useMemo, useState } from 'react'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogCancelButton, DialogDiscardGuard, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Input, textareaStyles } from '~/ui/Input'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Tag } from '~/ui/Tag'
import { detectEmbed, getEmbedProviderLabel, type EmbedDetection } from '../embedProviders'
import type { ArticleEmbedAspectRatio, ArticleEmbedConfig } from '../types'

type Props = {
	store: Ariakit.DialogStore
	onInsert: (config: ArticleEmbedConfig) => void
	initialConfig: ArticleEmbedConfig | null
}

const ASPECT_OPTIONS: Array<{ value: ArticleEmbedAspectRatio; label: string }> = [
	{ value: '16/9', label: '16 : 9' },
	{ value: '4/3', label: '4 : 3' },
	{ value: '1/1', label: '1 : 1' },
	{ value: 'auto', label: 'Auto' }
]

export function EmbedPicker({ store, onInsert, initialConfig }: Props) {
	const aspectId = useId()
	const [rawUrl, setRawUrl] = useState(initialConfig?.sourceUrl ?? '')
	const [title, setTitle] = useState(initialConfig?.title ?? '')
	const [caption, setCaption] = useState(initialConfig?.caption ?? '')
	const [aspectRatio, setAspectRatio] = useState<ArticleEmbedAspectRatio | null>(initialConfig?.aspectRatio ?? null)
	const [submitted, setSubmitted] = useState(false)

	// Leaving with the fields changed asks first, and an outside tap never drops them.
	const draftSnapshot = JSON.stringify({ rawUrl, title, caption, aspectRatio })
	const [openedSnapshot] = useState(draftSnapshot)

	const detection: EmbedDetection | null = useMemo(() => detectEmbed(rawUrl), [rawUrl])
	const empty = rawUrl.trim().length === 0
	// Whether the link can embed answers while the reader types; an empty field waits for Insert.
	const urlError =
		!empty && !detection
			? 'Enter a link from a supported source: a tweet, YouTube, Telegram, Flourish, Datawrapper, Medium, Substack or a GitHub gist.'
			: submitted && empty
				? 'Enter a link to embed.'
				: null

	const submit = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (!detection) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
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
			<form noValidate onSubmit={submit} className="flex min-h-0 flex-auto flex-col">
				<DialogDiscardGuard
					when={draftSnapshot !== openedSnapshot}
					title="Discard this embed?"
					description="The link and details you entered are not added to the article."
				/>
				<DialogHeader title={initialConfig ? 'Edit embed' : 'Insert embed'} />
				<DialogBody>
					<Field
						label="URL"
						hint={
							detection ? (
								<span className="flex min-w-0 items-center gap-2">
									<Tag className="shrink-0">{getEmbedProviderLabel(detection.provider)}</Tag>
									<span className="truncate">{detection.url}</span>
								</span>
							) : empty ? (
								<>
									Paste a tweet, YouTube video, Telegram post, Flourish or Datawrapper chart, Medium or Substack post,
									or GitHub gist. Other sources can&apos;t be embedded.
								</>
							) : null
						}
						error={urlError}
						live
					>
						{(control) => (
							<Ariakit.Focusable
								autoFocus
								render={
									<Input
										{...control}
										inputMode="url"
										value={rawUrl}
										onChange={(e) => setRawUrl(e.target.value)}
										placeholder="https://www.youtube.com/watch?v=…"
									/>
								}
							/>
						)}
					</Field>

					<Field label="Title (optional)">
						{(control) => (
							<Input
								{...control}
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Short label shown above the embed"
							/>
						)}
					</Field>

					<Field label="Caption (optional)">
						{(control) => (
							<textarea
								{...control}
								value={caption}
								onChange={(e) => setCaption(e.target.value)}
								rows={2}
								placeholder="Source notes or context shown below the embed"
								className={`${textareaStyles} resize-none`}
							/>
						)}
					</Field>

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
				<DialogFooter dismiss={<DialogCancelButton />}>
					<Button type="submit" size="md" variant="primary">
						{initialConfig ? 'Update embed' : 'Insert embed'}
					</Button>
				</DialogFooter>
			</form>
		</Dialog>
	)
}
