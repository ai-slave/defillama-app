import * as Ariakit from '@ariakit/react'
import Link from 'next/link'
import type { Dispatch, SetStateAction } from 'react'
import { Button } from '~/ui/Button'
import { DisclosureArrow } from '~/ui/ComboboxSelectTrigger'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { Keycap } from '~/ui/Keycap'
import { MenuItem, MenuSeparator, MenuSurface } from '~/ui/PopoverSurface'
import { SegmentedControl, type SegmentedControlOption } from '~/ui/SegmentedControl'
import { type Status, StatusDot } from '~/ui/StatusBadge'
import { Tooltip } from '~/ui/Tooltip'
import { formatDateTime, formatRelativeTime } from '~/utils/dateFormat'
import type { LocalArticleDocument } from '../types'
import type { SavePillState } from './ArticleEditorTypes'
import { formatArticleDate } from './ArticleEditorUtils'

export const ARTICLE_EDITOR_VIEWS = ['write', 'preview'] as const
export type ArticleEditorViewMode = (typeof ARTICLE_EDITOR_VIEWS)[number]

// Below sm the label is screen-reader only, so a phone shows just the icon and the tab keeps its name.
const EDITOR_VIEW_OPTIONS: ReadonlyArray<SegmentedControlOption<ArticleEditorViewMode>> = [
	{
		value: 'write',
		label: (
			<>
				<Icon name="pencil" className="size-3.5" />
				<span className="max-sm:sr-only">Write</span>
			</>
		)
	},
	{
		value: 'preview',
		label: (
			<>
				<Icon name="eye" className="size-3.5" />
				<span className="max-sm:sr-only">Preview</span>
			</>
		)
	}
]

const PILL_STATUS: Record<SavePillState, Status> = {
	saving: 'neutral',
	saved: 'good',
	unsaved: 'caution',
	error: 'bad',
	idle: 'neutral'
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
			className={`mb-8 flex flex-wrap items-center justify-between gap-3 border-b py-4 lg:-mx-20 lg:px-2 xl:-mx-42 xl:px-4 ${
				isPublished ? 'border-success-muted' : 'border-medium'
			}`}
		>
			{/* The slug is the one part that gives way on a narrow row: it truncates, and the crumbs and the status
			    badge keep their width. */}
			<nav className="flex min-w-0 items-center gap-2.5 body-md">
				<Link
					href="/research/admin"
					className="inline-flex shrink-0 items-center gap-1 text-tertiary transition-colors hover:text-primary"
				>
					Admin
				</Link>
				<span aria-hidden className="shrink-0 text-tertiary">
					›
				</span>
				<Link href="/research/mine" className="shrink-0 text-tertiary hover:text-primary">
					Articles
				</Link>
				<span aria-hidden className="shrink-0 text-tertiary">
					›
				</span>
				{slugEditing ? (
					<Input
						autoFocus
						aria-label="Article slug"
						placeholder="article-slug"
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
						variant="code"
						className="w-[24ch]"
					/>
				) : (
					<Button
						variant="ghost"
						size="sm"
						onClick={beginSlugEdit}
						aria-label={`Edit slug ${article.slug}`}
						truncate
						className="group"
					>
						<span
							className={`truncate mono-sm tracking-tight ${
								hasPendingEdits ? 'max-w-[18ch] sm:max-w-[24ch] lg:max-w-[32ch]' : 'max-w-[24ch] sm:max-w-[32ch]'
							}`}
						>
							{article.slug}
						</span>
						<span
							aria-hidden
							className="shrink-0 text-tertiary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 pointer-coarse:opacity-100"
						>
							✎
						</span>
					</Button>
				)}
				<span aria-hidden className="shrink-0 text-tertiary">
					·
				</span>
				{articleIsScheduled ? (
					<Tooltip
						content={`Scheduled for ${formatArticleDate(article.goLiveAt)}`}
						tabIndex={0}
						render={<span className="shrink-0 label-xs tracking-[0.22em] whitespace-nowrap text-link uppercase" />}
					>
						draft · scheduled
					</Tooltip>
				) : (
					<span
						className={`shrink-0 label-xs tracking-[0.22em] uppercase ${isPublished ? 'text-success' : 'text-warning'}`}
					>
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
									? 'border-error-muted bg-error-faint text-error hover:bg-error-tint'
									: pillState === 'unsaved'
										? 'border-warning-muted bg-warning-faint text-warning hover:bg-warning-tint'
										: 'border-transparent text-secondary hover:border-medium hover:bg-hover-row aria-disabled:hover:border-transparent aria-disabled:hover:bg-transparent'
							}`}
						/>
					}
				>
					<StatusDot status={PILL_STATUS[pillState]} pulse={pillState === 'saving'} />
					{/* Narrow headers keep only the dot, so the save state stays visible without crowding the actions. */}
					<span className={`tabular-nums ${hasPendingEdits ? 'max-lg:sr-only' : 'max-sm:sr-only'}`}>
						{pillText[pillState]}
					</span>
					{pillState === 'unsaved' || pillState === 'error' ? (
						<span aria-hidden className="hidden lg:inline-flex">
							<Keycap>⌘S</Keycap>
						</span>
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
						<Icon name="clock" className="size-4" />
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
									pendingLabel="Publishing…"
									pending={isPublishing}
									onClick={handlePublish}
								>
									Publish update
									<span aria-hidden>→</span>
								</Button>
							</>
						) : null}
						<Ariakit.MenuProvider>
							<Ariakit.MenuButton render={<Button variant="secondary" size="md" />}>
								<StatusDot status={hasPendingEdits ? 'caution' : 'good'} pulse={hasPendingEdits} />
								<span>{hasPendingEdits ? 'Live · Pending' : 'Live'}</span>
								<DisclosureArrow />
							</Ariakit.MenuButton>
							<MenuSurface variant="actions" gutter={6}>
								<MenuItem render={<Link href={articleViewHref} target="_blank" rel="noreferrer" />}>
									<span className="flex items-center gap-2">
										<Icon name="eye" className="size-3.5" />
										View live
									</span>
									<Icon name="external-link" className="ml-auto size-3 text-tertiary" />
								</MenuItem>
								<MenuItem onClick={onOpenMeta}>
									<Icon name="sliders-horizontal" className="size-3.5" />
									Edit listing
								</MenuItem>
								<MenuItem onClick={onOpenHistory}>
									<Icon name="check" className="size-3.5" />
									Revision history
								</MenuItem>
								<MenuItem onClick={handleUnpublish} disabled={isPublishing}>
									<Icon name="undo-2" className="size-3.5" />
									Move to drafts
								</MenuItem>
								{isOwner ? (
									<>
										<MenuSeparator />
										<MenuItem destructive onClick={handleDeleteArticle}>
											<Icon name="trash-2" className="size-3.5" />
											Delete
										</MenuItem>
									</>
								) : null}
							</MenuSurface>
						</Ariakit.MenuProvider>
					</>
				) : article.id ? (
					<>
						{!article.section ? (
							<Button variant="secondary" size="md" onClick={onOpenMeta}>
								<Icon name="sliders-horizontal" className="size-3.5" />
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
								<Icon name="trash-2" className="size-4" />
							</Tooltip>
						) : null}
						<Button variant="primary" size="md" pendingLabel="Publishing…" pending={isPublishing} onClick={onOpenMeta}>
							Publish
							<span aria-hidden>→</span>
						</Button>
					</>
				) : null}
			</div>
		</header>
	)
}
