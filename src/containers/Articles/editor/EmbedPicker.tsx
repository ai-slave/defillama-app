import * as Ariakit from '@ariakit/react'
import { useMemo, useState } from 'react'
import { detectEmbed, getEmbedProviderLabel, type EmbedDetection } from '../embedProviders'
import type { ArticleEmbedAspectRatio, ArticleEmbedConfig } from '../types'

type Props = {
	store: Ariakit.DialogStore
	onInsert: (config: ArticleEmbedConfig) => void
	initialConfig?: ArticleEmbedConfig | null
}

const ASPECT_OPTIONS: { value: ArticleEmbedAspectRatio; label: string }[] = [
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
			backdrop={<div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" />}
			className="fixed top-1/2 left-1/2 z-[81] flex max-h-[88vh] w-[min(640px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl border border-(--legacy-cards-border) bg-(--legacy-cards-bg) shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] outline-none"
		>
			<div className="flex items-center justify-between gap-3 border-b border-(--legacy-cards-border) px-5 py-3">
				<Ariakit.DialogHeading className="text-sm font-semibold tracking-tight text-(--legacy-text-primary)">
					{initialConfig ? 'Edit embed' : 'Insert embed'}
				</Ariakit.DialogHeading>
				<Ariakit.DialogDismiss className="rounded-md border border-transparent px-2 py-1 text-xs text-(--legacy-text-tertiary) hover:border-(--legacy-cards-border) hover:text-(--legacy-text-primary)">
					Close
				</Ariakit.DialogDismiss>
			</div>

			<div className="grid gap-4 px-5 py-4">
				<label className="grid gap-1.5">
					<span className="font-jetbrains text-[10px] tracking-[0.18em] text-(--legacy-text-tertiary) uppercase">
						URL
					</span>
					<input
						autoFocus
						value={rawUrl}
						onChange={(e) => setRawUrl(e.target.value)}
						placeholder="x.com · youtube · t.me · flourish · datawrapper · medium · substack · github"
						className="rounded-md border border-(--legacy-form-control-border) bg-(--legacy-app-bg) px-3 py-2 text-sm text-(--legacy-text-primary) placeholder:text-(--legacy-text-tertiary) focus:border-(--legacy-link-text) focus:outline-none"
					/>
					<DetectionLine status={detectionStatus} detection={detection} />
				</label>

				<label className="grid gap-1.5">
					<span className="font-jetbrains text-[10px] tracking-[0.18em] text-(--legacy-text-tertiary) uppercase">
						Title (optional)
					</span>
					<input
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="Short label shown above the embed"
						className="rounded-md border border-(--legacy-form-control-border) bg-(--legacy-app-bg) px-3 py-2 text-sm text-(--legacy-text-primary) placeholder:text-(--legacy-text-tertiary) focus:border-(--legacy-link-text) focus:outline-none"
					/>
				</label>

				<label className="grid gap-1.5">
					<span className="font-jetbrains text-[10px] tracking-[0.18em] text-(--legacy-text-tertiary) uppercase">
						Caption (optional)
					</span>
					<textarea
						value={caption}
						onChange={(e) => setCaption(e.target.value)}
						rows={2}
						placeholder="Source notes or context shown below the embed"
						className="resize-none rounded-md border border-(--legacy-form-control-border) bg-(--legacy-app-bg) px-3 py-2 text-sm text-(--legacy-text-primary) placeholder:text-(--legacy-text-tertiary) focus:border-(--legacy-link-text) focus:outline-none"
					/>
				</label>

				<div className="grid gap-1.5">
					<span className="font-jetbrains text-[10px] tracking-[0.18em] text-(--legacy-text-tertiary) uppercase">
						Aspect
					</span>
					<div className="flex items-center rounded-md border border-(--legacy-cards-border) bg-(--legacy-app-bg) p-0.5 text-xs">
						{ASPECT_OPTIONS.map((opt) => {
							const active = aspectValue === opt.value
							return (
								<button
									key={opt.value}
									type="button"
									onClick={() => setAspectRatio(opt.value)}
									className={`flex-1 rounded px-2 py-1 font-medium transition-colors ${
										active
											? 'bg-(--legacy-cards-bg) text-(--legacy-text-primary) shadow-sm'
											: 'text-(--legacy-text-tertiary) hover:text-(--legacy-text-primary)'
									}`}
								>
									{opt.label}
								</button>
							)
						})}
					</div>
				</div>
			</div>

			<div className="flex items-center justify-end gap-2 border-t border-(--legacy-cards-border) bg-(--legacy-app-bg)/30 px-5 py-3">
				<Ariakit.DialogDismiss className="rounded-md border border-(--legacy-cards-border) px-3 py-2 text-xs text-(--legacy-text-secondary) hover:bg-(--legacy-link-hover-bg)">
					Cancel
				</Ariakit.DialogDismiss>
				<button
					type="button"
					disabled={!detection}
					onClick={submit}
					className="rounded-md bg-(--legacy-link-button) px-3 py-2 text-xs font-medium text-(--legacy-link-text) shadow-sm transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
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
			<span className="text-[11px] text-(--legacy-text-tertiary)">
				Tweet, YouTube, Telegram post, Flourish, Datawrapper, Medium, Substack, or GitHub gist. Other domains are
				blocked.
			</span>
		)
	}
	if (status === 'invalid') {
		return <span className="text-[11px] text-[#c44747]">URL not recognized or domain not on allowlist.</span>
	}
	if (!detection) return null
	return (
		<span className="flex items-center gap-2 text-[11px] text-(--legacy-text-secondary)">
			<span className="rounded-sm border border-(--legacy-cards-border) bg-(--legacy-app-bg) px-1.5 py-0.5 font-jetbrains text-[10px] tracking-wider text-(--legacy-text-secondary) uppercase">
				{getEmbedProviderLabel(detection.provider)}
			</span>
			<span className="truncate text-(--legacy-text-tertiary)">{detection.url}</span>
		</span>
	)
}
