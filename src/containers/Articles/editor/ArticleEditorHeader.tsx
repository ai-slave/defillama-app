import * as Ariakit from '@ariakit/react'
import Link from 'next/link'
import type { Dispatch, SetStateAction } from 'react'
import { Icon as SharedIcon } from '~/ui/Icon'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { formatDateTime, formatRelativeTime } from '~/utils/dateFormat'
import type { LocalArticleDocument } from '../types'
import { Icon } from './ArticleEditorIcon'
import type { SavePillState } from './ArticleEditorTypes'
import { formatArticleDate } from './ArticleEditorUtils'

export type ArticleEditorViewMode = 'write' | 'preview'

const PILL_DOT: Record<SavePillState, string> = {
	saving: 'bg-secondary animate-pulse',
	saved: 'bg-success',
	unsaved: 'bg-warning',
	error: 'bg-error',
	idle: 'bg-tertiary/50'
}

type ArticleEditorHeaderProps = {
	article: LocalArticleDocument
	articleIsScheduled: boolean
	/** The editor's clock, which also decides `articleIsScheduled`. */
	nowSec: number
	articleViewHref: string
	hasPendingEdits: boolean
	isOwner: boolean
	isPublished: boolean
	isPublishing: boolean
	pillState: SavePillState
	savedAt: string | null
	slugDraft: string
	slugEditing: boolean
	viewMode: ArticleEditorViewMode
	beginSlugEdit: () => void
	cancelSlugEdit: () => void
	commitSlugEdit: () => void
	handleDeleteArticle: () => void
	handleDiscardPending: () => void
	handlePublish: () => void
	handleUnpublish: () => Promise<void>
	onOpenHistory: () => void
	onOpenMeta: () => void
	onViewModeChange: (mode: ArticleEditorViewMode) => void
	saveArticle: () => Promise<boolean>
	setSlugDraft: Dispatch<SetStateAction<string>>
}

export function ArticleEditorHeader({
	article,
	articleIsScheduled,
	nowSec,
	articleViewHref,
	beginSlugEdit,
	cancelSlugEdit,
	commitSlugEdit,
	handleDeleteArticle,
	handleDiscardPending,
	handlePublish,
	handleUnpublish,
	hasPendingEdits,
	isOwner,
	isPublished,
	isPublishing,
	onOpenHistory,
	onOpenMeta,
	pillState,
	saveArticle,
	savedAt,
	setSlugDraft,
	slugDraft,
	slugEditing,
	viewMode,
	onViewModeChange
}: ArticleEditorHeaderProps) {
	const savedLabel = savedAt ? formatRelativeTime(savedAt, { now: new Date(nowSec * 1000) }) : null
	const savedExactLabel = savedAt ? formatDateTime(savedAt, { timeZone: 'local' }) : null
	const pillText: Record<SavePillState, string> = {
		saving: 'Saving…',
		saved: savedLabel ? `Saved ${savedLabel}` : 'Saved',
		unsaved: 'Save',
		error: 'Save failed · Retry',
		idle: 'Ready'
	}
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
						} items-center gap-1 truncate rounded-sm px-1 py-0.5 font-jetbrains text-xs tracking-tight text-secondary hover:bg-research-tint-hover hover:text-primary`}
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
					className={`font-jetbrains text-[10px] tracking-[0.22em] uppercase ${isPublished ? 'text-success' : articleIsScheduled ? 'text-link' : 'text-warning'}`}
					title={articleIsScheduled ? `Scheduled for ${formatArticleDate(article.goLiveAt)}` : undefined}
				>
					{articleIsScheduled ? 'draft · scheduled' : article.status}
				</span>
			</nav>

			{/* Wraps instead of shrinking: a published article with pending edits has more actions than a phone row fits. */}
			<div className="flex flex-wrap items-center gap-2">
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
					title={
						pillState === 'error'
							? 'Click to retry. Cmd/Ctrl+S also saves.'
							: pillState === 'saved' && savedExactLabel
								? `Saved ${savedExactLabel}. Cmd/Ctrl+S to save.`
								: 'Cmd/Ctrl+S to save'
					}
					disabled={pillState === 'saving' || pillState === 'idle'}
					onClick={() => void saveArticle()}
					className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-jetbrains text-[11px] tracking-tight transition-colors disabled:cursor-default ${
						pillState === 'error'
							? 'border-error/40 bg-error/5 text-error hover:bg-error/10'
							: pillState === 'unsaved'
								? 'border-warning/35 bg-warning/5 text-warning hover:bg-warning/10 dark:text-warning'
								: 'border-transparent text-secondary hover:border-medium hover:bg-research-tint-hover disabled:hover:border-transparent disabled:hover:bg-transparent'
					}`}
				>
					<span aria-hidden className={`size-1.5 shrink-0 rounded-full ${PILL_DOT[pillState]}`} />
					{/* Narrow headers keep only the dot, so the save state stays visible without crowding the actions. */}
					<span className={`tabular-nums ${hasPendingEdits ? 'max-lg:sr-only' : 'max-sm:sr-only'}`}>
						{pillText[pillState]}
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
								aria-label={item.label}
								title={item.label}
								onClick={() => onViewModeChange(item.mode)}
								className={`flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors ${
									active
										? 'bg-research-tint text-link'
										: 'text-tertiary hover:bg-research-tint-hover hover:text-primary'
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
						aria-label="Revision history"
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
									disabled={isPublishing}
									onClick={handleDiscardPending}
									className="flex h-9 items-center gap-1.5 rounded-md border border-medium bg-surface px-3 text-xs font-medium text-secondary transition-colors hover:border-error/50 hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
								>
									Discard
								</button>
								<button
									type="button"
									disabled={isPublishing}
									onClick={handlePublish}
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
							<MenuSurface variant="actions" gutter={6}>
								<MenuItem
									render={<Link href={articleViewHref} target="_blank" rel="noreferrer" />}
									className="justify-between"
								>
									<span className="flex items-center gap-2">
										<Icon name="eye" className="size-3.5" />
										View live
									</span>
									<Icon name="external" className="size-3 text-tertiary" />
								</MenuItem>
								<MenuItem onClick={onOpenMeta}>
									<Icon name="sliders" className="size-3.5" />
									Edit listing
								</MenuItem>
								<MenuItem onClick={onOpenHistory}>
									<Icon name="check" className="size-3.5" />
									Revision history
								</MenuItem>
								<MenuItem onClick={handleUnpublish} disabled={isPublishing}>
									<Icon name="undo" className="size-3.5" />
									Move to drafts
								</MenuItem>
								{isOwner ? (
									<MenuItem destructive onClick={handleDeleteArticle} className="border-t border-subtle">
										<Icon name="trash" className="size-3.5" />
										Delete
									</MenuItem>
								) : null}
							</MenuSurface>
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
