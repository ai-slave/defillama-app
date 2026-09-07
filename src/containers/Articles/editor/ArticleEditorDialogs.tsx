import * as Ariakit from '@ariakit/react'
import type { LocalArticleDocument } from '../types'
import { Icon } from './ArticleEditorIcon'

type DialogStore = ReturnType<typeof Ariakit.useDialogStore>

type CoverDetailsDialogProps = {
	article: LocalArticleDocument
	publishErrors: Record<string, string>
	store: DialogStore
	updateCoverField: (key: 'headline' | 'caption' | 'credit' | 'copyright', value: string) => void
}

export function CoverDetailsDialog({ article, publishErrors, store, updateCoverField }: CoverDetailsDialogProps) {
	return (
		<Ariakit.Dialog
			store={store}
			backdrop={
				<div className="fixed inset-0 z-40 bg-research-backdrop-soft opacity-0 backdrop-blur-sm transition-opacity duration-150 data-[enter]:opacity-100 data-[leave]:opacity-0" />
			}
			className="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-medium bg-surface p-5 opacity-0 shadow-2xl transition-opacity duration-150 data-[enter]:opacity-100"
		>
			<div className="mb-4 flex items-start justify-between gap-3">
				<div className="grid gap-1">
					<Ariakit.DialogHeading className="text-base font-semibold tracking-tight text-primary">
						Cover details
					</Ariakit.DialogHeading>
					<p className="text-xs text-tertiary">Optional captions and attribution shown below the cover.</p>
				</div>
				<Ariakit.DialogDismiss
					aria-label="Close"
					className="rounded-md p-1.5 text-secondary hover:bg-research-tint-hover"
				>
					<Icon name="x" className="size-4" />
				</Ariakit.DialogDismiss>
			</div>

			<div className="grid gap-3">
				<label className="grid gap-1">
					<span className="text-[11px] font-medium tracking-wide text-tertiary uppercase">Headline</span>
					<input
						value={article.coverImage?.headline ?? ''}
						onChange={(e) => updateCoverField('headline', e.target.value)}
						placeholder="Image title"
						className="rounded-md border border-medium bg-page px-2.5 py-1.5 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
					/>
				</label>
				<label className="grid gap-1">
					<span className="text-[11px] font-medium tracking-wide text-tertiary uppercase">Caption</span>
					<input
						value={article.coverImage?.caption ?? ''}
						onChange={(e) => updateCoverField('caption', e.target.value)}
						placeholder="Caption shown under the cover"
						className="rounded-md border border-medium bg-page px-2.5 py-1.5 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
					/>
					{publishErrors['coverImage.caption'] ? (
						<span className="text-[11px] text-error">{publishErrors['coverImage.caption']}</span>
					) : null}
				</label>
				<div className="grid grid-cols-2 gap-2">
					<label className="grid gap-1">
						<span className="text-[11px] font-medium tracking-wide text-tertiary uppercase">Credit</span>
						<input
							value={article.coverImage?.credit ?? ''}
							onChange={(e) => updateCoverField('credit', e.target.value)}
							placeholder="Photographer"
							className="rounded-md border border-medium bg-page px-2.5 py-1.5 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
						/>
						{publishErrors['coverImage.credit'] ? (
							<span className="text-[11px] text-error">{publishErrors['coverImage.credit']}</span>
						) : null}
					</label>
					<label className="grid gap-1">
						<span className="text-[11px] font-medium tracking-wide text-tertiary uppercase">Copyright</span>
						<input
							value={article.coverImage?.copyright ?? ''}
							onChange={(e) => updateCoverField('copyright', e.target.value)}
							placeholder="Rights holder"
							className="rounded-md border border-medium bg-page px-2.5 py-1.5 text-sm text-primary placeholder:text-tertiary focus:border-link focus:outline-hidden"
						/>
						{publishErrors['coverImage.copyright'] ? (
							<span className="text-[11px] text-error">{publishErrors['coverImage.copyright']}</span>
						) : null}
					</label>
				</div>
			</div>

			<div className="mt-5 flex justify-end">
				<Ariakit.DialogDismiss className="flex h-9 items-center rounded-md bg-link px-3.5 text-xs font-medium text-on-brand transition-opacity hover:opacity-90">
					Done
				</Ariakit.DialogDismiss>
			</div>
		</Ariakit.Dialog>
	)
}

type DeleteArticleDialogProps = {
	isPending: boolean
	isPublished: boolean
	store: DialogStore
	title: string
	confirmDeleteArticle: () => void
}

export function DeleteArticleDialog({
	confirmDeleteArticle,
	isPending,
	isPublished,
	store,
	title
}: DeleteArticleDialogProps) {
	return (
		<Ariakit.Dialog
			store={store}
			backdrop={
				<div className="fixed inset-0 z-40 bg-research-backdrop-soft opacity-0 backdrop-blur-sm transition-opacity duration-150 data-[enter]:opacity-100 data-[leave]:opacity-0" />
			}
			className="fixed top-1/2 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-medium bg-surface p-5 opacity-0 shadow-2xl transition-opacity duration-150 data-[enter]:opacity-100"
		>
			<div className="flex items-start gap-3">
				<div
					aria-hidden
					className="flex size-9 shrink-0 items-center justify-center rounded-full bg-error/10 text-error"
				>
					<Icon name="trash" className="size-4" />
				</div>
				<div className="grid gap-1">
					<Ariakit.DialogHeading className="text-base font-semibold tracking-tight text-primary">
						{isPublished ? 'Delete this article?' : 'Delete this draft?'}
					</Ariakit.DialogHeading>
					<Ariakit.DialogDescription className="text-sm text-secondary">
						{title ? (
							<>
								<span className="font-medium text-primary">{title}</span> will be permanently removed. This cannot be
								undone.
							</>
						) : (
							<>This will be permanently removed. This cannot be undone.</>
						)}
					</Ariakit.DialogDescription>
				</div>
			</div>
			<div className="mt-5 flex justify-end gap-2">
				<Ariakit.DialogDismiss
					disabled={isPending}
					className="flex h-9 items-center rounded-md border border-medium bg-transparent px-3 text-xs font-medium text-secondary transition-colors hover:bg-research-tint-hover hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
				>
					Cancel
				</Ariakit.DialogDismiss>
				<button
					type="button"
					onClick={confirmDeleteArticle}
					disabled={isPending}
					className="flex h-9 items-center gap-1.5 rounded-md bg-research-error px-3.5 text-xs font-medium text-on-brand shadow-danger transition-colors hover:bg-error disabled:cursor-not-allowed disabled:opacity-60"
				>
					<Icon name="trash" className="size-3.5" />
					<span>{isPending ? 'Deleting…' : 'Delete'}</span>
				</button>
			</div>
		</Ariakit.Dialog>
	)
}
