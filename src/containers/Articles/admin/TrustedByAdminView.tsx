import { DndContext, type DragEndEvent, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import type * as React from 'react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { MentionSlotPreview } from '~/containers/Articles/admin/MentionSlotPreview'
import { useResearchLandingRevalidation } from '~/containers/Articles/admin/useResearchLandingRevalidation'
import {
	ArticleApiError,
	deleteSocialMention,
	deleteTrustedLogo,
	listSocialMentions,
	listTrustedLogos,
	reorderSocialMentions,
	reorderTrustedLogos,
	updateSocialMention,
	updateTrustedLogo
} from '~/containers/Articles/api'
import { BlockContent, toMentionQuote } from '~/containers/Articles/landing/ResearchSocialMediaMentions'
import { chunkMentions } from '~/containers/Articles/landing/utils'
import type { SocialMention, TrustedLogo } from '~/containers/Articles/types'
import { Icon } from '~/ui/Icon'

const VERTICAL_SORTING_MODIFIERS = [restrictToVerticalAxis, restrictToParentElement]

const SLOT_LABELS = ['small dark', 'large dark', 'light'] as const

const FULL_PREVIEW_WIDTH = 992
const FULL_PREVIEW_HEIGHT = 454
const FULL_PREVIEW_SCALE = 0.6

function linkHost(linkUrl: string): string {
	try {
		return new URL(linkUrl).hostname
	} catch {
		return linkUrl
	}
}

export function TrustedByAdminView() {
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const revalidate = useResearchLandingRevalidation()
	const [showFullPreview, setShowFullPreview] = useState(false)

	const logosQuery = useQuery<TrustedLogo[]>({
		queryKey: ['trusted-by-logos'],
		queryFn: () => listTrustedLogos(authorizedFetch),
		retry: false
	})

	const mentionsQuery = useQuery<SocialMention[]>({
		queryKey: ['trusted-by-mentions'],
		queryFn: () => listSocialMentions(authorizedFetch),
		retry: false
	})

	const reorderLogosMutation = useMutation({
		mutationFn: (ids: string[]) => reorderTrustedLogos(ids, authorizedFetch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['trusted-by-logos'] })
			revalidate()
		},
		onError: (err) => {
			toast.error(err instanceof ArticleApiError ? err.message : 'Failed to reorder logos')
		}
	})

	const toggleLogoMutation = useMutation({
		mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
			updateTrustedLogo(id, { enabled }, authorizedFetch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['trusted-by-logos'] })
			revalidate()
		},
		onError: (err) => {
			toast.error(err instanceof ArticleApiError ? err.message : 'Failed to update logo')
		}
	})

	const deleteLogoMutation = useMutation({
		mutationFn: (id: string) => deleteTrustedLogo(id, authorizedFetch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['trusted-by-logos'] })
			revalidate()
			toast.success('Logo deleted')
		},
		onError: (err) => {
			toast.error(err instanceof ArticleApiError ? err.message : 'Failed to delete logo')
		}
	})

	const reorderMentionsMutation = useMutation({
		mutationFn: (ids: string[]) => reorderSocialMentions(ids, authorizedFetch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['trusted-by-mentions'] })
			revalidate()
		},
		onError: (err) => {
			toast.error(err instanceof ArticleApiError ? err.message : 'Failed to reorder mentions')
		}
	})

	const toggleMentionMutation = useMutation({
		mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
			updateSocialMention(id, { enabled }, authorizedFetch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['trusted-by-mentions'] })
			revalidate()
		},
		onError: (err) => {
			toast.error(err instanceof ArticleApiError ? err.message : 'Failed to update mention')
		}
	})

	const deleteMentionMutation = useMutation({
		mutationFn: (id: string) => deleteSocialMention(id, authorizedFetch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['trusted-by-mentions'] })
			revalidate()
			toast.success('Mention deleted')
		},
		onError: (err) => {
			toast.error(err instanceof ArticleApiError ? err.message : 'Failed to delete mention')
		}
	})

	const logoSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	)
	const mentionSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
	)

	const logos = logosQuery.data ?? []
	const mentions = mentionsQuery.data ?? []
	const enabledMentions = mentions.filter((mention) => mention.enabled)

	const handleLogoDragEnd = (event: DragEndEvent) => {
		const { active, over } = event
		if (!over || active.id === over.id || reorderLogosMutation.isPending) return
		const oldIndex = logos.findIndex((logo) => logo.id === active.id)
		const newIndex = logos.findIndex((logo) => logo.id === over.id)
		if (oldIndex === -1 || newIndex === -1) return
		const reordered = arrayMove(logos, oldIndex, newIndex)
		reorderLogosMutation.mutate(reordered.map((logo) => logo.id))
	}

	const handleMentionDragEnd = (event: DragEndEvent) => {
		const { active, over } = event
		if (!over || active.id === over.id || reorderMentionsMutation.isPending) return
		const oldIndex = mentions.findIndex((mention) => mention.id === active.id)
		const newIndex = mentions.findIndex((mention) => mention.id === over.id)
		if (oldIndex === -1 || newIndex === -1) return
		const reordered = arrayMove(mentions, oldIndex, newIndex)
		reorderMentionsMutation.mutate(reordered.map((mention) => mention.id))
	}

	let enabledMentionIndex = -1

	return (
		<div className="mx-auto grid w-full max-w-5xl gap-6 px-1 pb-16">
			<header className="pt-2 pb-2">
				<Link
					href="/research/admin"
					className="inline-flex items-center gap-1 text-xs text-tertiary transition-colors hover:text-primary"
				>
					<span aria-hidden>←</span> Admin
				</Link>
				<h1 className="mt-2 text-3xl font-semibold tracking-tight text-primary">Trusted By</h1>
				<p className="mt-1 text-sm text-secondary">
					Manage the logos and social media mentions shown in the Trusted By section on /research.
				</p>
			</header>

			<section className="grid gap-3">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<h2 className="text-lg font-semibold text-primary">Logos</h2>
					<Link
						href="/research/admin/trusted-by/logos/new"
						className="inline-flex min-h-9 items-center bg-link px-3 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
					>
						+ Add logo
					</Link>
				</div>

				{logosQuery.isLoading ? (
					<div className="py-10 text-center text-sm text-tertiary">Loading…</div>
				) : logosQuery.error ? (
					<div className="rounded-md border border-error/30 bg-error/5 p-6">
						<p className="text-sm text-secondary">
							{logosQuery.error instanceof ArticleApiError ? logosQuery.error.message : 'Failed to load logos'}
						</p>
					</div>
				) : logos.length === 0 ? (
					<div className="rounded-md border border-dashed border-medium bg-surface p-10 text-center">
						<p className="text-sm text-secondary">No logos yet.</p>
					</div>
				) : (
					<DndContext sensors={logoSensors} onDragEnd={handleLogoDragEnd} modifiers={VERTICAL_SORTING_MODIFIERS}>
						<SortableContext items={logos.map((logo) => logo.id)} strategy={verticalListSortingStrategy}>
							<ul className="grid divide-y divide-(--border-medium) overflow-hidden rounded-md border border-medium bg-surface">
								{logos.map((logo) => (
									<SortableLogoRow
										key={logo.id}
										logo={logo}
										disabled={reorderLogosMutation.isPending}
										onToggle={(enabled) => toggleLogoMutation.mutate({ id: logo.id, enabled })}
										togglePending={toggleLogoMutation.isPending}
										onDelete={() => {
											if (window.confirm('Delete this logo? This cannot be undone.')) {
												deleteLogoMutation.mutate(logo.id)
											}
										}}
										deletePending={deleteLogoMutation.isPending}
									/>
								))}
							</ul>
						</SortableContext>
					</DndContext>
				)}
				<p className="text-xs text-tertiary">Drag to reorder. Order is reflected on /research after save.</p>
			</section>

			<section className="grid gap-3">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<h2 className="text-lg font-semibold text-primary">Mentions</h2>
					<Link
						href="/research/admin/trusted-by/mentions/new"
						className="inline-flex min-h-9 items-center bg-link px-3 text-sm font-medium text-on-brand transition-opacity hover:opacity-90"
					>
						+ Add mention
					</Link>
				</div>

				{mentionsQuery.isLoading ? (
					<div className="py-10 text-center text-sm text-tertiary">Loading…</div>
				) : mentionsQuery.error ? (
					<div className="rounded-md border border-error/30 bg-error/5 p-6">
						<p className="text-sm text-secondary">
							{mentionsQuery.error instanceof ArticleApiError ? mentionsQuery.error.message : 'Failed to load mentions'}
						</p>
					</div>
				) : mentions.length === 0 ? (
					<div className="rounded-md border border-dashed border-medium bg-surface p-10 text-center">
						<p className="text-sm text-secondary">No mentions yet.</p>
					</div>
				) : (
					<DndContext sensors={mentionSensors} onDragEnd={handleMentionDragEnd} modifiers={VERTICAL_SORTING_MODIFIERS}>
						<SortableContext items={mentions.map((mention) => mention.id)} strategy={verticalListSortingStrategy}>
							<ul className="grid divide-y divide-(--border-medium) overflow-hidden rounded-md border border-medium bg-surface">
								{mentions.map((mention) => {
									if (mention.enabled) enabledMentionIndex += 1
									const enabledIndex = mention.enabled ? enabledMentionIndex : -1
									const isSlideStart = mention.enabled && enabledIndex % 3 === 0
									const slideNumber = mention.enabled ? Math.floor(enabledIndex / 3) + 1 : null

									return (
										<SlideBoundary key={`${mention.id}-boundary`} show={isSlideStart} slideNumber={slideNumber}>
											<SortableMentionRow
												mention={mention}
												enabledIndex={enabledIndex}
												disabled={reorderMentionsMutation.isPending}
												onToggle={(enabled) => toggleMentionMutation.mutate({ id: mention.id, enabled })}
												togglePending={toggleMentionMutation.isPending}
												onDelete={() => {
													if (window.confirm('Delete this mention? This cannot be undone.')) {
														deleteMentionMutation.mutate(mention.id)
													}
												}}
												deletePending={deleteMentionMutation.isPending}
											/>
										</SlideBoundary>
									)
								})}
							</ul>
						</SortableContext>
					</DndContext>
				)}
				<p className="text-xs text-tertiary">Drag to reorder. Order is reflected on /research after save.</p>
			</section>

			{enabledMentions.length > 0 ? (
				<section className="grid gap-3">
					<div className="flex flex-wrap items-end justify-between gap-3">
						<h2 className="text-lg font-semibold text-primary">Slide preview</h2>
						<button
							type="button"
							onClick={() => setShowFullPreview((prev) => !prev)}
							className="inline-flex min-h-9 items-center border border-medium bg-surface px-3 text-sm font-medium text-primary transition-colors hover:border-link/40"
						>
							{showFullPreview ? 'Show quote cards only' : 'Load full preview with X posts'}
						</button>
					</div>
					<div className="grid gap-3">
						{chunkMentions(enabledMentions).map((block, blockIndex) => (
							<div key={block[0].id} className="grid gap-2 rounded-md border border-medium bg-surface p-4">
								<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Slide {blockIndex + 1}</span>
								{showFullPreview ? (
									<div
										style={{
											width: FULL_PREVIEW_WIDTH * FULL_PREVIEW_SCALE,
											height: FULL_PREVIEW_HEIGHT * FULL_PREVIEW_SCALE
										}}
										className="overflow-hidden"
									>
										<div
											style={{ width: FULL_PREVIEW_WIDTH, transform: `scale(${FULL_PREVIEW_SCALE})` }}
											className="pointer-events-none origin-top-left"
										>
											<BlockContent block={block.map(toMentionQuote)} isEven={blockIndex % 2 === 1} />
										</div>
									</div>
								) : (
									<div className="flex flex-wrap items-start gap-3">
										{block.map((mention, slotIndex) => (
											<MentionSlotPreview
												key={mention.id}
												quote={toMentionQuote(mention)}
												slotIndex={slotIndex}
												scale={0.5}
											/>
										))}
									</div>
								)}
							</div>
						))}
					</div>
					<p className="text-xs text-tertiary">
						{showFullPreview
							? 'Full slides as rendered on /research, including X post embeds. Even slides are mirrored, like in the carousel.'
							: 'Quote cards as rendered on /research. X post embeds are not shown here.'}
					</p>
				</section>
			) : null}
		</div>
	)
}

function SlideBoundary({
	show,
	slideNumber,
	children
}: {
	show: boolean
	slideNumber: number | null
	children: React.ReactNode
}) {
	if (!show) return <>{children}</>
	return (
		<>
			<li className="bg-page/60 px-4 py-1.5">
				<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Slide {slideNumber}</span>
			</li>
			{children}
		</>
	)
}

function SortableLogoRow({
	logo,
	disabled,
	onToggle,
	togglePending,
	onDelete,
	deletePending
}: {
	logo: TrustedLogo
	disabled: boolean
	onToggle: (enabled: boolean) => void
	togglePending: boolean
	onDelete: () => void
	deletePending: boolean
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: logo.id,
		disabled
	})

	const style: React.CSSProperties = {
		transform: CSS.Translate.toString(transform),
		transition
	}

	return (
		<li
			ref={setNodeRef}
			style={style}
			data-dragging={isDragging}
			className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 p-4 ${logo.enabled ? '' : 'opacity-50'}`}
		>
			<button
				type="button"
				disabled={disabled}
				className={`flex size-8 shrink-0 touch-none items-center justify-center rounded-md text-tertiary hover:bg-research-wash focus-visible:bg-research-wash disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-research-wash-strong dark:focus-visible:bg-research-wash-strong ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
				aria-label={`Drag ${logo.name}`}
				{...attributes}
				{...listeners}
			>
				<Icon name="menu" className="size-4" />
			</button>

			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src={logo.imageUrl} alt="" className="h-8 shrink-0 object-contain" />

			<div className="grid min-w-0 gap-0.5">
				<p className="truncate text-sm font-medium text-primary">{logo.name}</p>
				<p className="truncate text-xs text-tertiary">{linkHost(logo.linkUrl)}</p>
			</div>

			<div className="flex flex-wrap items-center gap-2 justify-self-end">
				<label className="flex items-center gap-1.5 text-xs text-secondary">
					<input
						type="checkbox"
						checked={logo.enabled}
						onChange={(e) => onToggle(e.target.checked)}
						disabled={togglePending}
						className="size-4 accent-link"
					/>
					Enabled
				</label>
				<Link
					href={`/research/admin/trusted-by/logos/${logo.id}`}
					className="rounded-md border border-medium px-3 py-1.5 text-xs text-secondary transition-colors hover:border-link/40 hover:text-primary"
				>
					Edit
				</Link>
				<button
					type="button"
					onClick={onDelete}
					disabled={deletePending}
					className="rounded-md px-3 py-1.5 text-xs text-error transition-colors hover:bg-error/10 disabled:opacity-50"
				>
					Delete
				</button>
			</div>
		</li>
	)
}

function SortableMentionRow({
	mention,
	enabledIndex,
	disabled,
	onToggle,
	togglePending,
	onDelete,
	deletePending
}: {
	mention: SocialMention
	enabledIndex: number
	disabled: boolean
	onToggle: (enabled: boolean) => void
	togglePending: boolean
	onDelete: () => void
	deletePending: boolean
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: mention.id,
		disabled
	})

	const style: React.CSSProperties = {
		transform: CSS.Translate.toString(transform),
		transition
	}

	const slotLabel = mention.enabled ? SLOT_LABELS[enabledIndex % 3] : null

	return (
		<li
			ref={setNodeRef}
			style={style}
			data-dragging={isDragging}
			className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-3 p-4 ${mention.enabled ? '' : 'opacity-50'}`}
		>
			<button
				type="button"
				disabled={disabled}
				className={`flex size-8 shrink-0 touch-none items-center justify-center rounded-md text-tertiary hover:bg-research-wash focus-visible:bg-research-wash disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-research-wash-strong dark:focus-visible:bg-research-wash-strong ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
				aria-label="Drag mention"
				{...attributes}
				{...listeners}
			>
				<Icon name="menu" className="size-4" />
			</button>

			{slotLabel ? (
				<span className="inline-flex shrink-0 items-center rounded-full bg-research-tint px-2 py-0.5 label-xs tracking-[0.18em] text-link uppercase">
					{slotLabel}
				</span>
			) : (
				<span className="size-2" />
			)}

			<div className="grid min-w-0 gap-0.5">
				<p className="line-clamp-1 text-sm text-primary">
					{mention.quote || <span className="text-tertiary italic">no quote</span>}
				</p>
				<p className="truncate text-xs text-tertiary">
					{mention.username ? `@${mention.username}` : null}
					{mention.username && mention.xPostId ? ' · ' : null}
					{mention.xPostId}
				</p>
			</div>

			<div className="flex flex-wrap items-center gap-2 justify-self-end">
				<label className="flex items-center gap-1.5 text-xs text-secondary">
					<input
						type="checkbox"
						checked={mention.enabled}
						onChange={(e) => onToggle(e.target.checked)}
						disabled={togglePending}
						className="size-4 accent-link"
					/>
					Enabled
				</label>
				<Link
					href={`/research/admin/trusted-by/mentions/${mention.id}`}
					className="rounded-md border border-medium px-3 py-1.5 text-xs text-secondary transition-colors hover:border-link/40 hover:text-primary"
				>
					Edit
				</Link>
				<button
					type="button"
					onClick={onDelete}
					disabled={deletePending}
					className="rounded-md px-3 py-1.5 text-xs text-error transition-colors hover:bg-error/10 disabled:opacity-50"
				>
					Delete
				</button>
			</div>
		</li>
	)
}
