import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useRef, useState } from 'react'
import { BasicLink } from '~/components/Link'
import { avatarColorStyle } from '~/containers/Authors/avatarColor'
import { Button } from '~/ui/Button'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { neighbourRowControl, pageContent, passFocusOnLeave } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { MenuItem, MenuSurface } from '~/ui/MenuSurface'
import { RelativeTime } from '~/ui/RelativeTime'
import { Tag, TagButton } from '~/ui/Tag'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber } from '~/utils/numberFormat'
import type { Dashboard } from '../dashboardTypes'
import { countDashboardWidgets } from '../dashboardWidgets'
import { dashboardUrlKey } from '../services/DashboardAPI'
import { ProBadge, ProMeta, proCardShellStyles } from '../ui'
import { CardLikeButton } from './CardLikeButton'
import { summarizeDashboardItemKinds } from './dashboardItemKindSummary'
import { DashboardPreview } from './DashboardPreview'
import { buildDashboardPreview } from './dashboardPreview.utils'

interface DashboardCardProps {
	dashboard: Dashboard
	onTagClick?: (tag: string) => void
	onDelete?: (dashboardId: string) => void | Promise<void>
	viewMode?: 'grid' | 'list'
	className?: string
}

// A confirmed delete closes onto the card's own control, and the list refetch removes the card after that. Focus moves
// to the neighbouring card's link (a direct child, unlike the author link); after the last card, to the list's region
// (the tab panel), else the page content.
const focusNeighbourOnLeave = passFocusOnLeave(
	(card) =>
		neighbourRowControl(card, card)?.querySelector<HTMLElement>(':scope > a') ??
		card.parentElement?.closest<HTMLElement>('[tabindex]') ??
		pageContent()
)

function DashboardCardGradientStrip() {
	return <div className="h-1.5 w-full bg-linear-to-r from-brand-muted via-brand-faint to-transparent" />
}

function DashboardAuthorLink({ author }: { author: Dashboard['author'] }) {
	if (!author?.slug || !author.displayName) return null

	return (
		<BasicLink
			href={`/authors/${author.slug}`}
			className="relative z-10 inline-flex max-w-full items-center gap-1.5 body-sm text-tertiary transition-colors hover:text-link"
		>
			{author.avatarUrl ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={author.avatarUrl} alt="" loading="lazy" className="size-4 shrink-0 rounded-full object-cover" />
			) : (
				<span
					className="flex size-4 shrink-0 items-center justify-center rounded-full body-sm"
					style={avatarColorStyle(author.slug)}
				>
					🦙
				</span>
			)}
			<span className="min-w-0 truncate">
				By <span className="font-medium">{author.displayName}</span>
			</span>
		</BasicLink>
	)
}

function DashboardCardActionsMenu({ name, onDelete }: { name: string; onDelete: (trigger: HTMLElement) => void }) {
	const triggerRef = useRef<HTMLButtonElement>(null)
	return (
		<Ariakit.MenuProvider placement="bottom-end">
			<Ariakit.MenuButton
				ref={triggerRef}
				render={<Button size="sm" square variant="secondary" />}
				aria-label={`Actions for ${name}`}
				className="absolute top-2 right-2 z-10"
				onClick={(event: React.MouseEvent) => event.stopPropagation()}
			>
				<Icon name="ellipsis" height={16} width={16} />
			</Ariakit.MenuButton>
			<MenuSurface variant="actions" gutter={6}>
				<MenuItem destructive onClick={(event) => onDelete(triggerRef.current ?? (event.currentTarget as HTMLElement))}>
					Delete…
				</MenuItem>
			</MenuSurface>
		</Ariakit.MenuProvider>
	)
}

export function DashboardCard({ dashboard, onTagClick, onDelete, viewMode = 'grid', className }: DashboardCardProps) {
	const returnFocus = useRef<HTMLElement | null>(null)
	const deletion = useMutation({
		mutationFn: async () => {
			await onDelete!(dashboard.id)
		}
	})
	const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false)
	const updatedAt = dashboard.editedAt || dashboard.updated
	const items = dashboard.data?.items
	// A team list carries server-resolved access; a member who cannot delete gets no delete control.
	const canDelete = !!onDelete && (dashboard.access ? dashboard.access.canDelete : true)
	const editedBy = dashboard.team ? dashboard.editedBy?.displayName : undefined
	const name = dashboard.data.dashboardName || 'Untitled Dashboard'

	const requestDelete = (trigger: HTMLElement) => {
		returnFocus.current = trigger
		setShowDeleteConfirm(true)
	}

	const itemTypes = useMemo(() => summarizeDashboardItemKinds(items ?? []), [items])
	const tiles = useMemo(() => dashboard.preview ?? buildDashboardPreview(items ?? []), [dashboard.preview, items])
	const widgetCount = countDashboardWidgets(items ?? [])
	const cardCountLabel = `${formatNumber(widgetCount)} ${widgetCount === 1 ? 'card' : 'cards'}`
	const viewCount = dashboard.viewCount ?? 0
	const viewCountLabel = `${formatNumber(viewCount)} ${viewCount === 1 ? 'view' : 'views'}`
	const isPrivate = dashboard.visibility !== 'public'
	const tags = dashboard.tags ?? []

	const meta = (
		<ProMeta
			items={[
				dashboard.copiedFrom ? (
					<span
						key="fork"
						className="inline-flex items-center gap-1"
						title={`Forked from ${dashboard.copiedFrom.name}`}
					>
						<Icon name="copy" height={12} width={12} />
						Fork
					</span>
				) : null,
				widgetCount > 0 ? (
					<span key="cards" className="tabular-nums" title={itemTypes}>
						{cardCountLabel}
					</span>
				) : null,
				<span key="views" className="tabular-nums">
					{viewCountLabel}
				</span>,
				<RelativeTime key="updated" value={updatedAt} prefix={editedBy ? `Edited by ${editedBy}` : 'Updated'} />
			]}
		/>
	)

	const titleRow = (
		<div className="flex min-w-0 items-start gap-2">
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<h2 className="line-clamp-1 title-lg text-primary">{name}</h2>
				<DashboardAuthorLink author={dashboard.author} />
			</div>
			{isPrivate ? (
				<ProBadge tone="neutral" icon={<Icon name="key" height={12} width={12} />}>
					Private
				</ProBadge>
			) : (
				<CardLikeButton
					dashboardId={dashboard.id}
					{...(dashboard.liked !== undefined ? { liked: dashboard.liked } : {})}
					{...(dashboard.likeCount !== undefined ? { likeCount: dashboard.likeCount } : {})}
				/>
			)}
		</div>
	)

	const tagRow =
		tags.length > 0 ? (
			<div className="flex h-6 items-center gap-1.5 overflow-hidden">
				{tags.slice(0, 2).map((tag) =>
					// Without a tag filter on the page, a tag is a label and a click opens the dashboard like the rest.
					onTagClick ? (
						<TagButton
							key={tag}
							type="button"
							onClick={(event) => {
								event.stopPropagation()
								event.preventDefault()
								onTagClick(tag)
							}}
							className="z-10 max-w-40"
						>
							<span className="truncate">{tag}</span>
						</TagButton>
					) : (
						<Tag key={tag} className="max-w-40">
							<span className="truncate">{tag}</span>
						</Tag>
					)
				)}
				{tags.length > 2 ? <Tag>+{tags.length - 2}</Tag> : null}
			</div>
		) : null

	return (
		<div
			ref={focusNeighbourOnLeave}
			className={`${proCardShellStyles} hover-wash-card group/dashboard-card relative isolate flex flex-col overflow-hidden transition-[border-color] duration-180 ease-out-quart hover:border-brand-muted ${className ?? ''}`}
		>
			{viewMode === 'grid' ? (
				<div className="relative">
					<DashboardPreview tiles={tiles} />
					{canDelete ? <DashboardCardActionsMenu name={name} onDelete={requestDelete} /> : null}
				</div>
			) : (
				<DashboardCardGradientStrip />
			)}

			{viewMode === 'grid' ? (
				<div className="flex flex-1 flex-col gap-1.5 p-3">
					{titleRow}
					<p className="line-clamp-2 h-[2lh] body-md text-secondary">{dashboard.description}</p>
					{tagRow}
					<div className="mt-auto pt-1">{meta}</div>
				</div>
			) : (
				<div className="flex flex-1 flex-wrap items-center gap-3 p-3">
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						{titleRow}
						{dashboard.description ? (
							<p className="line-clamp-1 body-md text-secondary">{dashboard.description}</p>
						) : null}
					</div>
					{tagRow}
					<div className="ml-auto shrink-0">{meta}</div>
					{canDelete ? (
						<Tooltip
							content="Delete dashboard"
							render={
								<Button
									type="button"
									size="sm"
									square
									variant="ghostDestructive"
									aria-label={`Delete ${name}`}
									onClick={(event: React.MouseEvent) => {
										event.stopPropagation()
										event.preventDefault()
										requestDelete(event.currentTarget as HTMLElement)
									}}
									className="z-10"
								/>
							}
						>
							<Icon name="trash-2" height={16} width={16} />
						</Tooltip>
					) : null}
				</div>
			)}

			<BasicLink href={`/pro/${dashboardUrlKey(dashboard)}`} className="absolute inset-0">
				<span className="sr-only">View {name}</span>
			</BasicLink>

			{showDeleteConfirm ? (
				<ConfirmActionDialog
					finalFocus={returnFocus}
					title={`Delete ${name}?`}
					description="Deleting a dashboard cannot be undone."
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					mutation={deletion}
					variables={undefined}
					onClose={() => setShowDeleteConfirm(false)}
				/>
			) : null}
		</div>
	)
}
