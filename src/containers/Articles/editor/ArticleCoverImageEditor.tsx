import type { RefObject } from 'react'
import { Icon as SharedIcon } from '~/ui/Icon'
import type { LocalArticleDocument } from '../types'
import { Icon } from './ArticleEditorIcon'
import type { ArticleFieldUpdater } from './ArticleEditorTypes'

type ArticleCoverImageEditorProps = {
	article: LocalArticleDocument
	coverFileInputRef: RefObject<HTMLInputElement | null>
	isUploadingCover: boolean
	publishError?: string
	handleCoverFile: (file: File | null | undefined) => void
	openCoverPicker: () => void
	onOpenCoverDetails: () => void
	updateArticle: ArticleFieldUpdater
}

export function ArticleCoverImageEditor({
	article,
	coverFileInputRef,
	handleCoverFile,
	isUploadingCover,
	onOpenCoverDetails,
	openCoverPicker,
	publishError,
	updateArticle
}: ArticleCoverImageEditorProps) {
	return (
		<div className="mt-5 mb-4">
			<input
				ref={coverFileInputRef}
				type="file"
				accept="image/png,image/jpeg,image/webp,image/gif"
				className="hidden"
				aria-label="Upload cover image"
				onChange={(e) => handleCoverFile(e.target.files?.[0])}
			/>
			{article.coverImage?.url ? (
				<figure className="grid gap-2">
					<div className="group relative aspect-[700/400] w-full overflow-hidden rounded-md border border-medium">
						{/* eslint-disable-next-line @next/next/no-img-element */}
						<img
							src={article.coverImage.url}
							alt={article.coverImage.alt || article.title || ''}
							className="block size-full object-cover"
						/>
						<div
							className={`pointer-events-none absolute inset-0 flex items-end justify-end gap-2 bg-linear-to-t from-research-black/55 via-research-black/10 to-transparent p-3 transition-opacity ${
								isUploadingCover
									? 'opacity-100'
									: 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100'
							}`}
						>
							<button
								type="button"
								onClick={onOpenCoverDetails}
								className="pointer-events-auto flex h-8 items-center gap-1.5 rounded-md border border-research-invert/30 bg-research-backdrop-soft px-2.5 text-xs font-medium text-on-brand backdrop-blur-sm transition-colors hover:bg-research-invert/55"
							>
								<Icon name="pencil" className="size-3.5" />
								<span>Edit details</span>
							</button>
							<button
								type="button"
								disabled={isUploadingCover}
								onClick={openCoverPicker}
								className="pointer-events-auto flex h-8 items-center gap-1.5 rounded-md border border-research-invert/30 bg-research-backdrop-soft px-2.5 text-xs font-medium text-on-brand backdrop-blur-sm transition-colors hover:bg-research-invert/55 disabled:cursor-not-allowed disabled:opacity-60"
							>
								{isUploadingCover ? 'Uploading…' : 'Replace'}
							</button>
							<button
								type="button"
								disabled={isUploadingCover}
								aria-label="Remove cover"
								title="Remove cover"
								onClick={() => updateArticle('coverImage', null)}
								className="pointer-events-auto flex size-8 items-center justify-center rounded-md border border-research-invert/30 bg-research-backdrop-soft text-on-brand backdrop-blur-sm transition-colors hover:border-error/60 hover:bg-error/70 disabled:cursor-not-allowed disabled:opacity-60"
							>
								<Icon name="trash" className="size-3.5" />
							</button>
						</div>
					</div>
					{(() => {
						const headline = (article.coverImage.headline ?? '').trim()
						const caption = (article.coverImage.caption ?? '').trim()
						const credit = (article.coverImage.credit ?? '').trim()
						const copyright = (article.coverImage.copyright ?? '').trim()
						const metaParts = [credit ? `Credit: ${credit}` : '', copyright ? `© ${copyright}` : ''].filter(Boolean)
						const hasAny = headline || caption || metaParts.length > 0
						if (!hasAny) {
							return (
								<button
									type="button"
									onClick={onOpenCoverDetails}
									className="flex items-center gap-1.5 self-start rounded-md border border-dashed border-medium px-2.5 py-1 text-[11px] font-medium text-tertiary transition-colors hover:border-link/40 hover:text-primary"
								>
									<Icon name="plus" className="size-3" />
									<span>Add caption & credits</span>
								</button>
							)
						}
						return (
							<figcaption className="group/cap flex items-start justify-between gap-3">
								<div className="grid gap-0.5 text-xs">
									{headline ? <span className="font-medium text-secondary">{headline}</span> : null}
									{caption ? <span className="text-tertiary">{caption}</span> : null}
									{metaParts.length > 0 ? <span className="text-tertiary/75">{metaParts.join(' · ')}</span> : null}
								</div>
								<button
									type="button"
									onClick={onOpenCoverDetails}
									aria-label="Edit cover details"
									title="Edit cover details"
									className="shrink-0 rounded-md p-1.5 text-tertiary opacity-0 transition-opacity group-hover/cap:opacity-100 hover:bg-research-tint-hover hover:text-primary focus-visible:opacity-100"
								>
									<Icon name="pencil" className="size-3.5" />
								</button>
							</figcaption>
						)
					})()}
				</figure>
			) : (
				<button
					type="button"
					disabled={isUploadingCover}
					onClick={openCoverPicker}
					className="group flex aspect-[700/400] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-medium bg-page text-tertiary transition-colors hover:border-link/50 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
				>
					<SharedIcon name="image-plus" className="size-6" />
					<span className="text-sm font-medium">{isUploadingCover ? 'Uploading…' : 'Add cover image'}</span>
					<span className="text-[11px] text-tertiary/80">PNG, JPEG, WebP, or GIF · up to 8 MB</span>
				</button>
			)}
			{publishError ? <p className="mt-2 text-xs text-error">{publishError}</p> : null}
		</div>
	)
}
