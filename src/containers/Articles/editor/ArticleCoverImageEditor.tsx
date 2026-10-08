import * as Ariakit from '@ariakit/react'
import type { RefObject } from 'react'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { Icon as SharedIcon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
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
								className="pointer-events-auto flex min-h-8 items-center gap-1.5 rounded-md border border-research-invert/30 bg-research-backdrop-soft px-2.5 py-1.5 label-sm text-on-brand backdrop-blur-sm transition-colors hover:bg-research-invert/55"
							>
								<Icon name="pencil" className="size-3.5" />
								<span>Edit details</span>
							</button>
							<Ariakit.Button
								type="button"
								disabled={isUploadingCover}
								onClick={openCoverPicker}
								accessibleWhenDisabled
								aria-busy={isUploadingCover || undefined}
								className="pointer-events-auto flex min-h-8 items-center gap-1.5 rounded-md border border-research-invert/30 bg-research-backdrop-soft px-2.5 py-1.5 label-sm text-on-brand backdrop-blur-sm transition-colors not-aria-disabled:hover:bg-research-invert/55 aria-busy:cursor-progress"
							>
								{isUploadingCover ? (
									<>
										<LoadingSpinner size={14} />
										Uploading…
									</>
								) : (
									'Replace'
								)}
							</Ariakit.Button>
							<Tooltip
								content="Remove cover"
								render={
									<Ariakit.Button
										disabled={isUploadingCover}
										accessibleWhenDisabled
										aria-label="Remove cover"
										onClick={(event) => {
											// The cover leaves with this button: the Add cover image tile that replaces it takes focus.
											const editor = event.currentTarget.closest('figure')!.parentElement!
											keepFocus(
												() => updateArticle('coverImage', null),
												() => editor.querySelector('button')
											)
										}}
										className="pointer-events-auto flex aspect-square min-h-8 items-center justify-center rounded-md border border-research-invert/30 bg-research-backdrop-soft p-1.5 text-on-brand backdrop-blur-sm transition-colors not-aria-disabled:hover:border-error-strong not-aria-disabled:hover:bg-error/70 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
									/>
								}
							>
								<Icon name="trash" className="size-4" />
							</Tooltip>
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
								<Button variant="secondary" size="sm" onClick={onOpenCoverDetails} className="justify-self-start">
									<Icon name="plus" className="size-3.5" />
									<span>Add caption & credits</span>
								</Button>
							)
						}
						return (
							<figcaption className="group/cap flex items-start justify-between gap-3">
								<div className="grid gap-0.5 body-sm">
									{headline ? <span className="label-sm text-secondary">{headline}</span> : null}
									{caption ? <span className="text-tertiary">{caption}</span> : null}
									{metaParts.length > 0 ? <span className="text-tertiary">{metaParts.join(' · ')}</span> : null}
								</div>
								<Tooltip
									content="Edit cover details"
									render={
										<Button
											variant="ghost"
											size="sm"
											square
											onClick={onOpenCoverDetails}
											aria-label="Edit cover details"
											className="opacity-0 transition-opacity group-hover/cap:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100"
										/>
									}
								>
									<Icon name="pencil" className="size-4" />
								</Tooltip>
							</figcaption>
						)
					})()}
				</figure>
			) : (
				<Ariakit.Button
					type="button"
					disabled={isUploadingCover}
					onClick={openCoverPicker}
					accessibleWhenDisabled
					aria-busy={isUploadingCover || undefined}
					className="group flex aspect-[700/400] w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-medium bg-page text-tertiary transition-colors not-aria-disabled:hover:border-brand-strong not-aria-disabled:hover:text-primary aria-busy:cursor-progress aria-disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:border-disabled aria-disabled:not-aria-busy:text-disabled"
				>
					{isUploadingCover ? <LoadingSpinner size={24} /> : <SharedIcon name="image-plus" className="size-6" />}
					<span className="label-md">{isUploadingCover ? 'Uploading…' : 'Add cover image'}</span>
					<span className="body-sm text-tertiary">PNG, JPEG, WebP, or GIF · up to 8 MB</span>
				</Ariakit.Button>
			)}
			{publishError ? <p className="mt-2 body-sm text-error">{publishError}</p> : null}
		</div>
	)
}
