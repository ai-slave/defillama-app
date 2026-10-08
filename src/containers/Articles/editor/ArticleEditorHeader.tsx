import * as Ariakit from '@ariakit/react'
import Link from 'next/link'
import type { Dispatch, SetStateAction } from 'react'
import { Button } from '~/ui/Button'
import { Icon as SharedIcon } from '~/ui/Icon'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { Tooltip } from '~/ui/Tooltip'
import { formatDateTime, formatRelativeTime } from '~/utils/dateFormat'
import type { LocalArticleDocument } from '../types'
import { Icon } from './ArticleEditorIcon'
import type { SavePillState } from './ArticleEditorTypes'
import { formatArticleDate } from './ArticleEditorUtils'

export const ARTICLE_EDITOR_VIEWS = ['write', 'preview'] as const
export type ArticleEditorViewMode = (typeof ARTICLE_EDITOR_VIEWS)[number]

// Below sm the label is screen-reader only, so a phone shows just the icon and the tab keeps its name.
const EDITOR_VIEW_OPTIONS: ReadonlyArray<SegmentedControlOption<ArticleEditorViewMode>> = (
	[
		{ value: 'write', icon: 'pencil', text: 'Write' },
		{ value: 'preview', icon: 'eye', text: 'Preview' }
	] as const
).map(({ value, icon, text }) => ({
	value,
	label: (
		<span className="inline-flex items-center gap-1.5">
			<Icon name={icon} className="size-3.5" />
			<span className="max-sm:sr-only">{text}</span>
		</span>
	)
}))

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
	beginSlugEdit: () => void
	cancelSlugEdit: () => void
	commitSlugEdit: () => void
	handleDeleteArticle: () => void
	handleDiscardPending: () => void
	handlePublish: () => void
	handleUnpublish: () => Promise<void>
	onOpenHistory: () => void
	onOpenMeta: () => void
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
	slugEditing
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
				isPublished ? 'border-success/25' : 'border-medium'
			}`}
		>
			<nav className="flex min-w-0 items-center gap-2.5 body-md">
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
						className="w-[24ch] rounded-sm border border-medium bg-page px-1.5 py-0.5 mono-sm text-primary"
					/>
				) : (
					<Button
						variant="ghost"
						size="sm"
						onClick={beginSlugEdit}
						aria-label={`Edit slug ${article.slug}`}
						className="group"
					>
						<span
							className={`truncate font-jetbrains tracking-tight ${
								hasPendingEdits ? 'max-w-[18ch] sm:max-w-[24ch] lg:max-w-[32ch]' : 'max-w-[24ch] sm:max-w-[32ch]'
							}`}
						>
							{article.slug}
						</span>
						<span
							aria-hidden
							className="text-tertiary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100"
						>
							✎
						</span>
					</Button>
				)}
				<span aria-hidden className="text-tertiary/40">
					·
				</span>
				{articleIsScheduled ? (
					<Tooltip
						content={`Scheduled for ${formatArticleDate(article.goLiveAt)}`}
						tabIndex={0}
						render={<span className="label-xs tracking-[0.22em] text-link uppercase" />}
					>
						draft · scheduled
					</Tooltip>
				) : (
					<span className={`label-xs tracking-[0.22em] uppercase ${isPublished ? 'text-success' : 'text-warning'}`}>
						{article.status}
					</span>
				)}
			</nav>

			{/* Wraps instead of shrinking: a published article with pending edits has more actions than a phone row fits. */}
			<div className="flex flex-wrap items-center gap-2">
				<Tooltip
					content={
						pillState === 'error'
							? 'Click to retry. Cmd/Ctrl+S also saves.'
							: pillState === 'saved' && savedExactLabel
								? `Saved ${savedExactLabel}. Cmd/Ctrl+S to save.`
								: 'Cmd/Ctrl+S to save'
					}
					render={
						<Ariakit.Button
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
							disabled={pillState === 'saving' || pillState === 'idle'}
							accessibleWhenDisabled
							onClick={() => void saveArticle()}
							className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 mono-sm tracking-tight transition-colors aria-disabled:cursor-default ${
								pillState === 'error'
									? 'border-error/40 bg-error/5 text-error hover:bg-error/10'
									: pillState === 'unsaved'
										? 'border-warning/35 bg-warning/5 text-warning hover:bg-warning/10 dark:text-warning'
										: 'border-transparent text-secondary hover:border-medium hover:bg-hover-row aria-disabled:hover:border-transparent aria-disabled:hover:bg-transparent'
							}`}
						/>
					}
				>
					<span aria-hidden className={`size-1.5 shrink-0 rounded-full ${PILL_DOT[pillState]}`} />
					{/* Narrow headers keep only the dot, so the save state stays visible without crowding the actions. */}
					<span className={`tabular-nums ${hasPendingEdits ? 'max-lg:sr-only' : 'max-sm:sr-only'}`}>
						{pillText[pillState]}
					</span>
					{pillState === 'unsaved' || pillState === 'error' ? (
						<kbd
							aria-hidden
							className="hidden rounded-sm border border-current/25 px-1 py-px label-xs tracking-wider opacity-70 lg:inline"
						>
							⌘S
						</kbd>
					) : null}
				</Tooltip>

				<SegmentedControl
					semantics="tabs"
					label="Editor mode"
					variant="default"
					size="md"
					options={EDITOR_VIEW_OPTIONS}
				/>

				{article.id ? (
					<Tooltip
						content="Revision history"
						render={
							<Button variant="secondary" size="md" square onClick={onOpenHistory} aria-label="Revision history" />
						}
					>
						<SharedIcon name="clock" className="size-4" />
					</Tooltip>
				) : null}

				{isPublished ? (
					<>
						{hasPendingEdits ? (
							<>
								<Button variant="secondary" size="md" disabled={isPublishing} onClick={handleDiscardPending}>
									Discard
								</Button>
								<Button
									variant="primary"
									size="md"
									pendingLabel={isPublishing ? 'Publishing…' : null}
									onClick={handlePublish}
								>
									Publish update
									<span aria-hidden>→</span>
								</Button>
							</>
						) : null}
						<Ariakit.MenuProvider>
							<Ariakit.MenuButton render={<Button variant="secondary" size="md" />}>
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
							<Button variant="secondary" size="md" onClick={onOpenMeta}>
								<Icon name="sliders" className="size-3.5" />
								<span>Set section</span>
							</Button>
						) : null}
						{isOwner ? (
							<Tooltip
								content="Delete draft"
								render={
									<Button
										variant="ghostDestructive"
										size="md"
										square
										onClick={handleDeleteArticle}
										aria-label="Delete draft"
									/>
								}
							>
								<Icon name="trash" className="size-4" />
							</Tooltip>
						) : null}
						<Button variant="primary" size="md" pendingLabel={isPublishing ? 'Publishing…' : null} onClick={onOpenMeta}>
							Publish
							<span aria-hidden>→</span>
						</Button>
					</>
				) : null}
			</div>
		</header>
	)
}
