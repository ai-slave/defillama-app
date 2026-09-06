import * as Ariakit from '@ariakit/react'
import { useMemo, useState } from 'react'
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
	const [rawUrl, setRawUrl] = useState(initialConfig?.sourceUrl ?? '')
	const [title, setTitle] = useState(initialConfig?.title ?? '')
	const [caption, setCaption] = useState(initialConfig?.caption ?? '')
	const [aspectRatio, setAspectRatio] = useState<ArticleEmbedAspectRatio | null>(initialConfig?.aspectRatio ?? null)

	const detection: EmbedDetection | null = useMemo(() => detectEmbed(rawUrl), [rawUrl])
	const detectionStatus = rawUrl.trim().length === 0 ? 'empty' : detection ? 'ok' : 'invalid'

	const submit = () => {
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
		<Ariakit.Dialog
			store={store}
			modal
			backdrop={<div className="fixed inset-0 z-[80] bg-research-backdrop backdrop-blur-sm" />}
			className="fixed top-1/2 left-1/2 z-[81] flex max-h-[88vh] w-[min(640px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-medium bg-surface shadow-article-dialog outline-hidden"
		>
			<div className="flex items-center justify-between gap-3 border-b border-medium px-5 py-3">
				<Ariakit.DialogHeading className="text-sm font-semibold tracking-tight text-primary">
					{initialConfig ? 'Edit embed' : 'Insert embed'}
				</Ariakit.DialogHeading>
				<Ariakit.DialogDismiss className="rounded-md border border-transparent px-2 py-1 text-xs text-tertiary hover:border-medium hover:text-primary">
					Close
				</Ariakit.DialogDismiss>
			</div>

			<div className="grid gap-4 px-5 py-4">
				<label className="grid gap-1.5">
					<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">URL</span>
					<input
						autoFocus
						value={rawUrl}
						onChange={(e) => setRawUrl(e.target.value)}
						placeholder="x.com · youtube · t.me · flourish · datawrapper · medium · substack · github"
						className="rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
					/>
					<DetectionLine status={detectionStatus} detection={detection} />
				</label>

				<label className="grid gap-1.5">
					<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">Title (optional)</span>
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Short label shown above the embed"
						className="rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
					/>
				</label>

				<label className="grid gap-1.5">
					<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">
						Caption (optional)
					</span>
					<textarea
						value={caption}
						onChange={(e) => setCaption(e.target.value)}
						rows={2}
						placeholder="Source notes or context shown below the embed"
						className="resize-none rounded-md border border-medium bg-page px-3 py-2 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
					/>
				</label>

				<div className="grid gap-1.5">
					<span className="font-jetbrains text-[10px] tracking-[0.18em] text-tertiary uppercase">Aspect</span>
					<div className="flex items-center rounded-md border border-medium bg-page p-0.5 text-xs">
						{ASPECT_OPTIONS.map((opt) => {
							const active = aspectValue === opt.value
							return (
								<button
									key={opt.value}
									type="button"
									onClick={() => setAspectRatio(opt.value)}
									className={`flex-1 rounded-sm px-2 py-1 font-medium transition-colors ${
										active ? 'bg-surface text-primary shadow-sm' : 'text-tertiary hover:text-primary'
									}`}
								>
									{opt.label}
								</button>
							)
						})}
					</div>
				</div>
			</div>

			<div className="flex items-center justify-end gap-2 border-t border-medium bg-page/30 px-5 py-3">
				<Ariakit.DialogDismiss className="rounded-md border border-medium px-3 py-2 text-xs text-secondary hover:bg-research-tint-hover">
					Cancel
				</Ariakit.DialogDismiss>
				<button
					type="button"
					disabled={!detection}
					onClick={submit}
					className="rounded-md bg-research-tint px-3 py-2 text-xs font-medium text-link shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{initialConfig ? 'Update embed' : 'Insert embed'}
				</button>
			</div>
		</Ariakit.Dialog>
	)
}

function DetectionLine({
	status,
	detection
}: {
	status: 'empty' | 'ok' | 'invalid'
	detection: EmbedDetection | null
}) {
	if (status === 'empty') {
		return (
			<span className="text-[11px] text-tertiary">
				Tweet, YouTube, Telegram post, Flourish, Datawrapper, Medium, Substack, or GitHub gist. Other domains are
				blocked.
			</span>
		)
	}
	if (status === 'invalid') {
		return <span className="text-[11px] text-error">URL not recognized or domain not on allowlist.</span>
	}
	if (!detection) return null
	return (
		<span className="flex items-center gap-2 text-[11px] text-secondary">
			<span className="rounded-sm border border-medium bg-page px-1.5 py-0.5 font-jetbrains text-[10px] tracking-wider text-secondary uppercase">
				{getEmbedProviderLabel(detection.provider)}
			</span>
			<span className="truncate text-tertiary">{detection.url}</span>
		</span>
	)
}
