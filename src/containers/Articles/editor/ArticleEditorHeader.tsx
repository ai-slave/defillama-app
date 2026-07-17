import * as Ariakit from '@ariakit/react'
import Link from 'next/link'
import type { Dispatch, SetStateAction } from 'react'
import { Icon as SharedIcon } from '~/components/Icon'
import type { LocalArticleDocument } from '../types'
import { Icon } from './ArticleEditorIcon'
import type { SavePillState } from './ArticleEditorTypes'
import { formatArticleDate } from './ArticleEditorUtils'

export type ArticleEditorViewMode = 'write' | 'preview'

type ArticleEditorHeaderProps = {
	article: LocalArticleDocument
	articleIsScheduled: boolean
	articleViewHref: string
	deletePending: boolean
	hasPendingEdits: boolean
	isDiscarding: boolean
	isOwner: boolean
	isPublished: boolean
	isPublishing: boolean
	pillDot: string
	pillLabel: string
	pillState: SavePillState
	savedLabel: string | null
	slugDraft: string
	slugEditing: boolean
	viewMode: ArticleEditorViewMode
	beginSlugEdit: () => void
	cancelSlugEdit: () => void
	commitSlugEdit: () => void
	handleDeleteArticle: () => void
	handleDiscardPending: () => void
	handlePublish: () => Promise<boolean>
	handleUnpublish: () => Promise<void>
	onOpenHistory: () => void
	onOpenMeta: () => void
	onViewModeChange: (mode: ArticleEditorViewMode) => void
	saveArticle: () => Promise<void>
	setSlugDraft: Dispatch<SetStateAction<string>>
}

export function ArticleEditorHeader({
	article,
	articleIsScheduled,
	articleViewHref,
	beginSlugEdit,
	cancelSlugEdit,
	commitSlugEdit,
	deletePending,
	handleDeleteArticle,
	handleDiscardPending,
	handlePublish,
	handleUnpublish,
	hasPendingEdits,
	isDiscarding,
	isOwner,
	isPublished,
	isPublishing,
	onOpenHistory,
	onOpenMeta,
	pillDot,
	pillLabel,
	pillState,
	saveArticle,
	savedLabel,
	setSlugDraft,
	slugDraft,
	slugEditing,
	viewMode,
	onViewModeChange
}: ArticleEditorHeaderProps) {
	return (
		<header
			className={`mb-8 flex flex-wrap items-center justify-between gap-3 border-b py-4 lg:-mx-20 lg:px-2 xl:-mx-[170px] xl:px-4 ${
				isPublished ? 'border-emerald-500/25' : 'border-medium'
			}`}
		>
			<nav className="flex min-w-0 items-center gap-2.5 text-sm">
				<Link
					href="/research/admin"
					className="inline-flex items-center gap-1 text-tertiary transition-colors hover:text-primary"
				>
					Admin
				</Link>
				<span aria-hidden className="text-tertiary/50">
					›
				</span>
				<Link href="/research/mine" className="text-tertiary hover:text-primary">
					Articles
				</Link>
				<span aria-hidden className="text-tertiary/50">
					›
				</span>
				{slugEditing ? (
					<input
						autoFocus
						value={slugDraft}
						onChange={(event) => setSlugDraft(event.target.value)}
						onBlur={commitSlugEdit}
						onKeyDown={(event) => {
							if (event.key === 'Enter') {
								event.preventDefault()
								commitSlugEdit()
							}
							if (event.key === 'Escape') {
								event.preventDefault()
								cancelSlugEdit()
							}
						}}
						className="w-[24ch] rounded-sm border border-link/40 bg-page px-1.5 py-0.5 font-jetbrains text-xs text-primary focus:border-link focus:outline-hidden"
					/>
				) : (
					<button
						type="button"
						onClick={beginSlugEdit}
						title="Click to edit slug"
						className={`group flex ${
							hasPendingEdits ? 'max-w-[18ch] sm:max-w-[24ch] lg:max-w-[32ch]' : 'max-w-[24ch] sm:max-w-[32ch]'
						} items-center gap-1 truncate rounded-sm px-1 py-0.5 font-jetbrains text-xs tracking-tight text-secondary hover:bg-research-link-hover-bg hover:text-primary`}
					>
						<span className="truncate">{article.slug}</span>
						<span aria-hidden className="text-tertiary opacity-0 transition-opacity group-hover:opacity-100">
							✎
						</span>
					</button>
				)}
				<span aria-hidden className="text-tertiary/40">
					·
				</span>
				<span
					className={`font-jetbrains text-[10px] font-medium tracking-[0.22em] uppercase ${
						isPublished ? 'text-success' : articleIsScheduled ? 'text-link' : 'text-warning'
					}`}
					title={articleIsScheduled ? `Scheduled for ${formatArticleDate(article.goLiveAt)}` : undefined}
				>
					{articleIsScheduled ? 'draft · scheduled' : article.status}
				</span>
			</nav>

			<div className="flex items-center gap-2">
				<button
					type="button"
					aria-live="polite"
					aria-label={
						pillState === 'error'
							? 'Save failed — retry'
							: pillState === 'unsaved'
								? 'Save now'
								: pillState === 'saving'
									? 'Saving'
									: pillState === 'saved'
										? `Saved ${savedLabel ?? ''} — save again`
										: 'Save'
					}
					title={pillState === 'error' ? 'Click to retry. Cmd/Ctrl+S also saves.' : 'Cmd/Ctrl+S to save'}
					disabled={pillState === 'saving' || pillState === 'idle'}
					onClick={() => void saveArticle()}
					className={`hidden items-center gap-2 rounded-md border px-2.5 py-1.5 font-jetbrains text-[11px] tracking-tight transition-colors disabled:cursor-default ${
						hasPendingEdits ? 'lg:flex' : 'sm:flex'
					} ${
						pillState === 'error'
							? 'border-error/40 bg-error/5 text-error hover:bg-error/10'
							: pillState === 'unsaved'
								? 'border-warning/35 bg-warning/5 text-warning hover:bg-warning/10 dark:text-warning'
								: 'border-transparent text-secondary hover:border-medium hover:bg-research-link-hover-bg disabled:hover:border-transparent disabled:hover:bg-transparent'
					}`}
				>
					<span aria-hidden className={`size-1.5 rounded-full ${pillDot}`} />
					<span className="tabular-nums">
						{pillState === 'error' ? 'Save failed · Retry' : pillState === 'unsaved' ? 'Save' : pillLabel}
					</span>
					{pillState === 'unsaved' || pillState === 'error' ? (
						<kbd
							aria-hidden
							className="hidden rounded-sm border border-current/25 px-1 py-px font-jetbrains text-[9px] tracking-wider opacity-70 lg:inline"
						>
							⌘S
						</kbd>
					) : null}
				</button>

				<div
					role="group"
					aria-label="Editor mode"
					className="flex h-9 items-center rounded-md border border-medium bg-surface p-0.5"
				>
					{(
						[
							{ mode: 'write', label: 'Write', icon: 'pencil' },
							{ mode: 'preview', label: 'Preview', icon: 'eye' }
						] as const
					).map((item) => {
						const active = viewMode === item.mode
						return (
							<button
								key={item.mode}
								type="button"
								aria-pressed={active}
								title={item.label}
								onClick={() => onViewModeChange(item.mode)}
								className={`flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors ${
									active
										? 'bg-research-link-button-bg text-link'
										: 'text-tertiary hover:bg-research-link-hover-bg hover:text-primary'
								}`}
							>
								<Icon name={item.icon} className="size-3.5" />
								<span className="hidden sm:inline">{item.label}</span>
							</button>
						)
					})}
				</div>

				{article.id ? (
					<button
						type="button"
						onClick={onOpenHistory}
						title="Revision history"
						className="flex size-9 items-center justify-center rounded-md border border-medium bg-surface text-secondary transition-colors hover:border-link/40 hover:text-primary"
					>
						<SharedIcon name="clock" className="size-4" />
					</button>
				) : null}

				{isPublished ? (
					<>
						{hasPendingEdits ? (
							<>
								<button
									type="button"
									disabled={isPublishing || isDiscarding}
									onClick={handleDiscardPending}
									className="flex h-9 items-center gap-1.5 rounded-md border border-medium bg-surface px-3 text-xs font-medium text-secondary transition-colors hover:border-error/50 hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
								>
									{isDiscarding ? 'Discarding…' : 'Discard'}
								</button>
								<button
									type="button"
									disabled={isPublishing || isDiscarding}
									onClick={async () => {
										await handlePublish()
									}}
									className="flex h-9 items-center gap-1.5 rounded-md bg-success px-3.5 text-xs font-medium text-on-brand shadow-publish transition-all hover:bg-success hover:shadow-publish-hover disabled:cursor-not-allowed disabled:opacity-50"
								>
									<span>{isPublishing ? 'Publishing…' : 'Publish update'}</span>
									<span aria-hidden>→</span>
								</button>
							</>
						) : null}
						<Ariakit.MenuProvider>
							<Ariakit.MenuButton className="flex h-9 items-center gap-1.5 rounded-md border border-medium bg-surface px-3 text-xs font-medium text-primary transition-colors hover:border-link/40">
								<span
									aria-hidden
									className={`size-1.5 rounded-full ${hasPendingEdits ? 'animate-pulse bg-warning' : 'bg-success'}`}
								/>
								<span>{hasPendingEdits ? 'Live · Pending' : 'Live'}</span>
								<span aria-hidden className="text-tertiary">
									▾
								</span>
							</Ariakit.MenuButton>
							<Ariakit.Menu
								gutter={6}
								className="z-50 grid min-w-[180px] gap-0.5 rounded-md border border-medium bg-surface p-1 shadow-xl"
							>
								<Ariakit.MenuItem
									render={
										<Link
											href={articleViewHref}
											target="_blank"
											rel="noreferrer"
											className="flex items-center justify-between rounded-sm px-2.5 py-1.5 text-xs text-secondary data-[active-item]:bg-research-link-button-bg data-[active-item]:text-link"
										/>
									}
								>
									<span className="flex items-center gap-2">
										<Icon name="eye" className="size-3.5" />
										View live
									</span>
									<Icon name="external" className="size-3 text-tertiary" />
								</Ariakit.MenuItem>
								<Ariakit.MenuItem
									onClick={onOpenMeta}
									className="flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-secondary data-[active-item]:bg-research-link-button-bg data-[active-item]:text-link"
								>
									<Icon name="sliders" className="size-3.5" />
									Edit listing
								</Ariakit.MenuItem>
								<Ariakit.MenuItem
									onClick={onOpenHistory}
									className="flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-secondary data-[active-item]:bg-research-link-button-bg data-[active-item]:text-link"
								>
									<Icon name="check" className="size-3.5" />
									Revision history
								</Ariakit.MenuItem>
								<Ariakit.MenuItem
									onClick={handleUnpublish}
									disabled={isPublishing}
									className="flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-secondary data-[active-item]:bg-research-link-button-bg data-[active-item]:text-link"
								>
									<Icon name="undo" className="size-3.5" />
									Move to drafts
								</Ariakit.MenuItem>
								{isOwner ? (
									<>
										<span aria-hidden className="my-1 h-px bg-border-medium" />
										<Ariakit.MenuItem
											onClick={handleDeleteArticle}
											className="flex items-center gap-2 rounded-sm px-2.5 py-1.5 text-xs text-error data-[active-item]:bg-error/10"
										>
											<Icon name="trash" className="size-3.5" />
											Delete
										</Ariakit.MenuItem>
									</>
								) : null}
							</Ariakit.Menu>
						</Ariakit.MenuProvider>
					</>
				) : article.id ? (
					<>
						{!article.section ? (
							<button
								type="button"
								onClick={onOpenMeta}
								title="Set a section"
								className="flex h-9 items-center gap-1.5 rounded-md border border-dashed border-medium bg-transparent px-3 text-xs font-medium text-tertiary transition-colors hover:border-link/40 hover:text-secondary"
							>
								<Icon name="sliders" className="size-3.5" />
								<span>Set section</span>
							</button>
						) : null}
						{isOwner ? (
							<button
								type="button"
								aria-label="Delete draft"
								title="Delete draft"
								disabled={deletePending}
								onClick={handleDeleteArticle}
								className="flex size-9 items-center justify-center rounded-md border border-medium bg-surface text-tertiary transition-colors hover:border-error/40 hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
							>
								<Icon name="trash" className="size-3.5" />
							</button>
						) : null}
						<button
							type="button"
							disabled={isPublishing}
							onClick={onOpenMeta}
							className="flex h-9 items-center gap-1.5 rounded-md bg-success px-3.5 text-xs font-medium text-on-brand shadow-publish transition-all hover:bg-success hover:shadow-publish-hover disabled:cursor-not-allowed disabled:opacity-50"
						>
							<span>Publish</span>
							<span aria-hidden>→</span>
						</button>
					</>
				) : null}
			</div>
		</header>
	)
}
