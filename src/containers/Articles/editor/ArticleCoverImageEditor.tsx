import type { RefObject } from 'react'
import { Button } from '~/ui/Button'
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { MetaLine } from '~/ui/MetaLine'
import { ErrorLine } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { UploadTile } from '~/ui/UploadTile'
import type { LocalArticleDocument } from '../types'
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
							className={`pointer-events-none absolute inset-0 flex items-end justify-end gap-2 bg-linear-to-t from-research-backdrop-soft to-transparent p-3 transition-opacity ${
								isUploadingCover
									? 'opacity-100'
									: 'opacity-0 group-hover:opacity-100 group-has-focus-visible:opacity-100 pointer-coarse:opacity-100'
							}`}
						>
							<Button variant="onMedia" size="md" onClick={onOpenCoverDetails} className="pointer-events-auto">
								<Icon name="pencil" className="size-3.5" />
								<span>Edit details</span>
							</Button>
							<Button
								variant="onMedia"
								size="md"
								onClick={openCoverPicker}
								pendingLabel="Uploading…"
								pending={isUploadingCover}
								className="pointer-events-auto"
							>
								Replace
							</Button>
							<Tooltip
								content="Remove cover"
								render={
									<Button
										variant="onMedia"
										size="md"
										square
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
										className="pointer-events-auto"
									/>
								}
							>
								<Icon name="trash-2" className="size-4" />
							</Tooltip>
						</div>
					</div>
					{(() => {
						const headline = (article.coverImage.headline ?? '').trim()
						const caption = (article.coverImage.caption ?? '').trim()
						const credit = (article.coverImage.credit ?? '').trim()
						const copyright = (article.coverImage.copyright ?? '').trim()
						const hasAny = headline || caption || credit || copyright
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
									<MetaLine>
										{credit ? `Credit: ${credit}` : null}
										{copyright ? `© ${copyright}` : null}
									</MetaLine>
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
				<UploadTile
					shape="cover"
					icon="image-plus"
					label="Add cover image"
					hint="PNG, JPEG, WebP, or GIF · up to 8 MB"
					pendingLabel="Uploading…"
					pending={isUploadingCover}
					onClick={openCoverPicker}
				/>
			)}
			{publishError ? (
				<div className="mt-2">
					<ErrorLine inset="none">{publishError}</ErrorLine>
				</div>
			) : null}
		</div>
	)
}
