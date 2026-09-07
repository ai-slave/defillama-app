import { useMutation } from '@tanstack/react-query'
import { useMemo, useRef, useState, type RefObject } from 'react'
import toast from 'react-hot-toast'
import { BasicLink } from '~/components/Link'
import { avatarColorStyle } from '~/containers/Authors/avatarColor'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { RelativeTime } from '~/ui/RelativeTime'
import { Tooltip } from '~/ui/Tooltip'
import type { Dashboard } from '../dashboardTypes'
import { dashboardUrlKey } from '../services/DashboardAPI'
import { CardLikeButton } from './CardLikeButton'
import { ConfirmationModal } from './ConfirmationModal'

interface DashboardCardProps {
	fallbackFocus?: RefObject<HTMLElement | null>
	dashboard: Dashboard
	onTagClick?: (tag: string) => void
	onDelete?: (dashboardId: string) => void | Promise<void>
	viewMode?: 'grid' | 'list'
	className?: string
}

function DashboardAuthorLink({ author }: { author: Dashboard['author'] }) {
	if (!author?.slug || !author.displayName) return null

	return (
		<BasicLink
			href={`/authors/${author.slug}`}
			className="relative z-10 mt-1 inline-flex max-w-full items-center gap-1.5 text-xs text-pro-text-label transition-colors hover:text-pro-accent"
		>
			{author.avatarUrl ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={author.avatarUrl} alt="" className="size-5 shrink-0 rounded-full object-cover" />
			) : (
				<span
					className="flex size-5 shrink-0 items-center justify-center rounded-full text-xs"
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

	const handleDeleteClick = (e: React.MouseEvent) => {
		e.stopPropagation()
		if (!onDelete) return
		returnFocus.current = e.currentTarget as HTMLElement
		deletion.reset()
		setShowDeleteConfirm(true)
	}

	const itemTypes = useMemo(() => {
		const counts = new Map<string, number>()
		for (const item of dashboard.data.items ?? []) {
			if (!item) continue

			switch (item.kind) {
				case 'chart':
					counts.set('charts', (counts.get('charts') ?? 0) + 1)
					break
				case 'multi':
					counts.set('multi-charts', (counts.get('multi-charts') ?? 0) + 1)
					break
				case 'dataset-table':
					counts.set('tables', (counts.get('tables') ?? 0) + 1)
					break
				case 'text':
					counts.set('text blocks', (counts.get('text blocks') ?? 0) + 1)
					break
				default:
					counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1)
			}
		}

		const sorted = Array.from(counts)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 3)

		const summary = sorted.map(([type, count]) => `${count} ${type}`).join(', ')

		if (counts.size > 3) {
			return `${summary} +${counts.size - 3} more`
		}

		return summary
	}, [dashboard.data.items])

	return (
		<div
			ref={cardRef}
			className={`relative isolate flex ${viewMode === 'grid' ? 'min-h-[220px]' : ''} flex-col overflow-hidden rounded-md border border-pro-cards-border bg-pro-cards-bg transition-[border-color,box-shadow,background-color] duration-200 ease-out hover:border-pro-accent/30 hover:bg-pro-info-300/5 hover:shadow-lg hover:shadow-pro-info-300/10 dark:hover:border-pro-accent/40 dark:hover:bg-pro-info-300/10 ${className ?? ''}`}
		>
			<div className="h-1.5 w-full bg-linear-to-r from-pro-accent/20 via-pro-accent/10 to-transparent" />

			<div className="flex flex-1 flex-col gap-1.5 p-3">
				<div className="flex min-w-0 items-start gap-2">
					<div className="min-w-0 flex-1">
						<h2 className="truncate text-lg leading-snug font-bold">
							{dashboard.data.dashboardName || 'Untitled Dashboard'}
						</h2>
						<DashboardAuthorLink author={dashboard.author} />
					</div>

					{viewMode !== 'grid' ? (
						<Tags dashboard={dashboard} {...(onTagClick !== undefined ? { onTagClick } : {})} />
					) : null}

					{onDelete ? (
						<div className="flex shrink-0 items-center gap-2">
							{dashboard.visibility === 'public' ? (
								<p className="flex items-center gap-1 rounded-md bg-pro-success-100 px-2 py-1.25 text-xs text-pro-success-400 dark:bg-pro-success-300/20 dark:text-pro-success-200">
									<Icon name="earth" height={12} width={12} />
									<span>Public</span>
								</p>
							) : (
								<p className="flex items-center gap-1 rounded-md bg-pro-premium-100 px-2 py-1.25 text-xs text-pro-premium-400 dark:bg-pro-premium-300/20 dark:text-pro-premium-200">
									<Icon name="key" height={12} width={12} />
									<span>Private</span>
								</p>
							)}
							<Tooltip
								content="Delete dashboard"
								render={
									<button
										type="button"
										aria-label="Delete dashboard"
										disabled={deletion.isPending}
										onClick={handleDeleteClick}
									/>
								}
								className="z-10 flex items-center justify-center gap-2 rounded-md bg-error/10 px-2 py-1.75 text-sm font-medium text-error"
							>
								{deletion.isPending ? <LoadingSpinner size={12} /> : <Icon name="trash-2" height={12} width={12} />}
							</Tooltip>
						</div>
					) : null}
				</div>

				{viewMode === 'grid' ? (
					<Tags dashboard={dashboard} {...(onTagClick !== undefined ? { onTagClick } : {})} />
				) : null}

				{dashboard.description ? (
					<p className="mt-0.5 line-clamp-2 text-sm leading-snug text-pro-text-label opacity-80">
						{dashboard.description}
					</p>
				) : null}

				<div className={`mt-auto flex flex-col gap-2.5 ${viewMode === 'grid' ? 'pt-4' : 'pt-2'}`}>
					<div className="flex flex-wrap items-center gap-2">
						{dashboard.data.items?.length ? (
							<span
								className="flex items-center gap-1.5 rounded-md bg-brand/15 px-2 py-1 text-xs font-medium text-link tabular-nums"
								title={itemTypes}
							>
								<Icon name="layers" height={12} width={12} />
								{dashboard.data.items.length} items
							</span>
						) : null}
						<span
							className="flex items-center gap-1.5 rounded-md bg-brand/15 px-2 py-1 text-xs font-medium text-link tabular-nums"
							title="Views"
						>
							<Icon name="eye" height={12} width={12} />
							{dashboard.viewCount ?? 0}
						</span>
						<CardLikeButton
							dashboardId={dashboard.id}
							{...(dashboard.liked !== undefined ? { liked: dashboard.liked } : {})}
							{...(dashboard.likeCount !== undefined ? { likeCount: dashboard.likeCount } : {})}
						/>
					</div>
					<p className="flex items-center gap-1.5 text-xs text-pro-text-form">
						<Icon name="clock" height={10} width={10} />
						<RelativeTime value={updatedAt} prefix="Updated" />
					</p>
				</div>
			</div>
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

function Tags({ dashboard, onTagClick }: { dashboard: Dashboard; onTagClick?: (tag: string) => void }) {
	if (!dashboard.tags || dashboard.tags.length === 0) return null
	return (
		<div className="flex max-w-[65%] flex-wrap items-center gap-1.5">
			{dashboard.tags.slice(0, 2).map((tag) => (
				<button
					type="button"
					key={tag}
					onClick={(e) => {
						e.stopPropagation()
						onTagClick?.(tag)
					}}
					className="z-10 max-w-[200px] truncate rounded-full border border-pro-switch-border bg-pro-cards-bg px-2.5 py-1 text-xs font-medium text-pro-text-form transition-all duration-150 hover:scale-105 hover:border-transparent hover:bg-brand hover:text-on-brand"
				>
					{tag}
				</button>
			))}
			{dashboard.tags.length > 2 ? (
				<span className="rounded-full bg-(--bg-hover) px-2 py-1 text-xs text-pro-text-label">
					+{dashboard.tags.length - 2}
				</span>
			) : null}
		</div>
	)
}
