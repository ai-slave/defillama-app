import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useMemo, useRef, useState, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { BasicLink } from '~/components/Link'
import { avatarColorStyle } from '~/containers/Authors/avatarColor'
import { Icon } from '~/ui/Icon'
import {
	menuSurfaceStyles,
	popoverMenuItemStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import { RelativeTime } from '~/ui/RelativeTime'
import { formatNumber } from '~/utils/numberFormat'
import type { Dashboard } from '../dashboardTypes'
import { countDashboardWidgets } from '../dashboardWidgets'
import { dashboardUrlKey } from '../services/DashboardAPI'
import { ProBadge, ProChip, ProMeta, proCardShellStyles, ProButton } from '../ui'
import { CardLikeButton } from './CardLikeButton'
import { ConfirmationModal } from './ConfirmationModal'
import { summarizeDashboardItemKinds } from './dashboardItemKindSummary'
import { DashboardPreview } from './DashboardPreview'
import { buildDashboardPreview } from './dashboardPreview.utils'

interface DashboardCardProps {
	fallbackFocus?: RefObject<HTMLElement | null>
	dashboard: Dashboard
	onTagClick?: (tag: string) => void
	onDelete?: (dashboardId: string) => void | Promise<void>
	viewMode?: 'grid' | 'list'
	className?: string
}

function DashboardCardGradientStrip() {
	return <div className="h-1.5 w-full bg-linear-to-r from-pro-accent/20 via-pro-accent/10 to-transparent" />
}

function DashboardAuthorLink({ author }: { author: Dashboard['author'] }) {
	if (!author?.slug || !author.displayName) return null

	return (
		<BasicLink
			href={`/authors/${author.slug}`}
			className="relative z-10 inline-flex max-w-full items-center gap-1.5 text-xs text-pro-text-tertiary transition-colors hover:text-pro-accent"
		>
			{author.avatarUrl ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={author.avatarUrl} alt="" loading="lazy" className="size-4 shrink-0 rounded-full object-cover" />
			) : (
				<span
					className="flex size-4 shrink-0 items-center justify-center rounded-full text-xs"
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

function DashboardCardActionsMenu({
	onDelete,
	disabled
}: {
	onDelete: (trigger: HTMLElement) => void
	disabled: boolean
}) {
	const triggerRef = useRef<HTMLButtonElement>(null)
	return (
		<Ariakit.MenuProvider placement="bottom-end">
			<Ariakit.MenuButton
				ref={triggerRef}
				render={<ProButton size="sm" square variant="secondary" />}
				aria-label="Dashboard card actions"
				disabled={disabled}
				className="absolute top-2 right-2 z-10"
				onClick={(event: React.MouseEvent) => event.stopPropagation()}
			>
				<Icon name="ellipsis" height={16} width={16} />
			</Ariakit.MenuButton>
			<Ariakit.Menu
				portal
				unmountOnHide
				gutter={6}
				className={menuSurfaceStyles}
				wrapperProps={{ className: popoverMobileWrapperClassName }}
			>
				<Ariakit.PopoverDismiss aria-label="Close menu" className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>
				<Ariakit.MenuItem
					className={`${popoverMenuItemStyles} text-error`}
					onClick={(event) => onDelete(triggerRef.current ?? (event.currentTarget as HTMLElement))}
				>
					Delete…
				</Ariakit.MenuItem>
			</Ariakit.Menu>
		</Ariakit.MenuProvider>
	)
}

export function DashboardCard({
	fallbackFocus,
	dashboard,
	onTagClick,
	onDelete,
	viewMode = 'grid',
	className
}: DashboardCardProps) {
	const returnFocus = useRef<HTMLElement | null>(null)
	const cardRef = useRef<HTMLDivElement>(null)
	const deletion = useMutation({
		mutationFn: async () => {
			await onDelete!(dashboard.id)
		},
		onError: (error) => {
			if (!cardRef.current?.isConnected) toast.error(error.message)
		}
	})
	const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false)
	const updatedAt = dashboard.editedAt || dashboard.updated
	const items = dashboard.data?.items
	// A team list carries server-resolved access; a member who cannot delete gets no delete control.
	const canDelete = !!onDelete && (dashboard.access ? dashboard.access.canDelete : true)
	const editedBy = dashboard.team ? dashboard.editedBy?.displayName : undefined

	const requestDelete = (trigger: HTMLElement) => {
		returnFocus.current = trigger
		deletion.reset()
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
				<h2 className="line-clamp-1 text-base leading-snug font-semibold text-pro-text-primary">
					{dashboard.data.dashboardName || 'Untitled Dashboard'}
				</h2>
				<DashboardAuthorLink author={dashboard.author} />
			</div>
			{isPrivate ? (
				<ProBadge tone="premium" icon={<Icon name="key" height={12} width={12} />}>
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
				{tags.slice(0, 2).map((tag) => (
					<ProChip
						key={tag}
						as="button"
						type="button"
						onClick={(event: React.MouseEvent) => {
							event.stopPropagation()
							event.preventDefault()
							onTagClick?.(tag)
						}}
						className="z-10 max-w-40 truncate"
					>
						{tag}
					</ProChip>
				))}
				{tags.length > 2 ? <ProChip>+{tags.length - 2}</ProChip> : null}
			</div>
		) : null

	return (
		<div
			ref={cardRef}
			className={`${proCardShellStyles} group/dashboard-card relative isolate flex flex-col overflow-hidden transition-[border-color,box-shadow,transform] duration-180 ease-out-quart hover:-translate-y-0.5 hover:border-pro-accent/40 hover:shadow-overlay-sm ${className ?? ''}`}
		>
			{viewMode === 'grid' ? (
				<div className="relative">
					<DashboardPreview tiles={tiles} />
					{canDelete ? <DashboardCardActionsMenu onDelete={requestDelete} disabled={deletion.isPending} /> : null}
				</div>
			) : (
				<DashboardCardGradientStrip />
			)}

			{viewMode === 'grid' ? (
				<div className="flex flex-1 flex-col gap-1.5 p-3">
					{titleRow}
					<p className="line-clamp-2 h-10 text-sm leading-5 text-pro-text-secondary">{dashboard.description}</p>
					{tagRow}
					<div className="mt-auto pt-1">{meta}</div>
				</div>
			) : (
				<div className="flex flex-1 flex-wrap items-center gap-3 p-3">
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						{titleRow}
						{dashboard.description ? (
							<p className="line-clamp-1 text-sm text-pro-text-secondary">{dashboard.description}</p>
						) : null}
					</div>
					{tagRow}
					<div className="ml-auto shrink-0">{meta}</div>
					{canDelete ? (
						<ProButton
							type="button"
							size="sm"
							square
							variant="ghost"
							aria-label="Delete dashboard"
							disabled={deletion.isPending}
							onClick={(event: React.MouseEvent) => {
								event.stopPropagation()
								event.preventDefault()
								requestDelete(event.currentTarget as HTMLElement)
							}}
							className="z-10"
						>
							<Icon name="trash-2" height={14} width={14} />
						</ProButton>
					) : null}
				</div>
			)}

			<BasicLink href={`/pro/${dashboardUrlKey(dashboard)}`} className="absolute inset-0">
				<span className="sr-only">View dashboard</span>
			</BasicLink>

			<ConfirmationModal
				finalFocus={returnFocus}
				fallbackFocus={fallbackFocus}
				isOpen={showDeleteConfirm}
				onClose={() => setShowDeleteConfirm(false)}
				onConfirm={() => deletion.mutate(undefined, { onSuccess: () => setShowDeleteConfirm(false) })}
				closeOnConfirm={false}
				pending={deletion.isPending}
				pendingText="Deleting…"
				error={deletion.error?.message}
				title={`Delete ${dashboard.data.dashboardName || 'dashboard'}?`}
				message="Are you sure you want to delete this dashboard? This action cannot be undone."
				confirmText="Delete"
				cancelText="Cancel"
			/>
		</div>
	)
}
