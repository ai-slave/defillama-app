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
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
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
import { Button, StableLabel } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { neighbourRowControl } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { EmptyState, InlineStatus, PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { queryReadFailed, queryRefreshFailed } from '~/utils/query'

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
	// The neighbour row's Delete is read when the confirm opens: once the delete succeeds, the refetched list has dropped the row.
	const [deleteTarget, setDeleteTarget] = useState<{
		kind: 'logo' | 'mention'
		id: string
		name: string
		neighbour: HTMLElement | null | undefined
	} | null>(null)
	const returnFocusRef = useRef<HTMLElement | null>(null)
	const addLogoRef = useRef<HTMLAnchorElement>(null)
	const addMentionRef = useRef<HTMLAnchorElement>(null)
	const confirmDelete = (target: { kind: 'logo' | 'mention'; id: string; name: string }, control: HTMLElement) => {
		returnFocusRef.current = null
		setDeleteTarget({ ...target, neighbour: neighbourRowControl(control.closest('li')!, control) })
	}
	const { authorizedFetch } = useAuthContext()
	const queryClient = useQueryClient()
	const revalidate = useResearchLandingRevalidation()
	const [showFullPreview, setShowFullPreview] = useState(false)

	const logosQuery = useQuery<Array<TrustedLogo>>({
		queryKey: ['trusted-by-logos'],
		queryFn: () => listTrustedLogos(authorizedFetch),
		retry: false
	})

	const mentionsQuery = useQuery<Array<SocialMention>>({
		queryKey: ['trusted-by-mentions'],
		queryFn: () => listSocialMentions(authorizedFetch),
		retry: false
	})

	const reorderLogosMutation = useMutation({
		mutationFn: (ids: Array<string>) => reorderTrustedLogos(ids, authorizedFetch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['trusted-by-logos'] })
			revalidate()
		},
		onError: (err) => {
			toast.error(err instanceof ArticleApiError ? err.message : "Couldn't reorder logos.")
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
			toast.error(err instanceof ArticleApiError ? err.message : "Couldn't update the logo.")
		}
	})

	const deleteLogoMutation = useMutation({
		mutationFn: (id: string) => deleteTrustedLogo(id, authorizedFetch),
		onSuccess: () => {
			revalidate()
			return queryClient.invalidateQueries({ queryKey: ['trusted-by-logos'] })
		}
	})

	const reorderMentionsMutation = useMutation({
		mutationFn: (ids: Array<string>) => reorderSocialMentions(ids, authorizedFetch),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['trusted-by-mentions'] })
			revalidate()
		},
		onError: (err) => {
			toast.error(err instanceof ArticleApiError ? err.message : "Couldn't reorder mentions.")
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
			toast.error(err instanceof ArticleApiError ? err.message : "Couldn't update the mention.")
		}
	})

	const deleteMentionMutation = useMutation({
		mutationFn: (id: string) => deleteSocialMention(id, authorizedFetch),
		onSuccess: () => {
			revalidate()
			return queryClient.invalidateQueries({ queryKey: ['trusted-by-mentions'] })
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

	// Slides group enabled mentions in threes, so each enabled mention needs its position among enabled ones.
	const enabledIndexById = new Map<string, number>()
	for (const mention of mentions) {
		if (mention.enabled) enabledIndexById.set(mention.id, enabledIndexById.size)
	}

	return (
		<div className="mx-auto grid w-full max-w-5xl gap-6 px-1 pb-16">
			{deleteTarget ? (
				<ConfirmActionDialog
					key={`${deleteTarget.kind}-${deleteTarget.id}`}
					title={`Delete ${deleteTarget.name}?`}
					description={`This removes the ${deleteTarget.kind} from research pages. This cannot be undone.`}
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					mutation={deleteTarget.kind === 'logo' ? deleteLogoMutation : deleteMentionMutation}
					variables={deleteTarget.id}
					finalFocus={returnFocusRef}
					onClose={() => setDeleteTarget(null)}
					onSuccess={() => {
						returnFocusRef.current =
							deleteTarget.neighbour ?? (deleteTarget.kind === 'logo' ? addLogoRef.current : addMentionRef.current)
					}}
				/>
			) : null}
			<header className="pt-2 pb-2">
				<Link
					href="/research/admin"
					className="inline-flex items-center gap-1 body-sm text-tertiary transition-colors hover:text-primary"
				>
					<span aria-hidden>←</span> Admin
				</Link>
				<h1 className="mt-2 heading-lg tracking-tight text-primary">Trusted By</h1>
				<p className="mt-1 body-md text-secondary">
					Manage the logos and social media mentions shown in the Trusted By section on /research.
				</p>
			</header>

			<section className="grid gap-3">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<h2 className="heading-xs text-primary">Logos</h2>
					<Button
						ref={addLogoRef}
						as={BasicLink}
						variant="secondary"
						size="md"
						href="/research/admin/trusted-by/logos/new"
					>
						<Icon name="plus" className="size-3.5" />
						Add logo
					</Button>
				</div>

				{queryRefreshFailed(logosQuery) ? (
					<InlineStatus variant="error" retry={logosQuery}>
						Couldn&apos;t refresh logos. It may not show your latest change.
					</InlineStatus>
				) : null}
				{queryReadFailed(logosQuery) ? (
					<PanelStatus variant="error" retry={logosQuery} className="min-h-32">
						Couldn&apos;t load logos.
						{logosQuery.error instanceof ArticleApiError ? ` ${logosQuery.error.message}` : null}
					</PanelStatus>
				) : logosQuery.isLoading ? (
					<PanelLoadingStatus label="Loading logos" className="min-h-32" />
				) : logos.length === 0 ? (
					<EmptyState size="md" title="No logos yet" framed />
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
										onDelete={(control) => confirmDelete({ kind: 'logo', id: logo.id, name: logo.name }, control)}
										deletePending={deleteLogoMutation.isPending}
									/>
								))}
							</ul>
						</SortableContext>
					</DndContext>
				)}
				<p className="body-sm text-tertiary">Drag to reorder. Order is reflected on /research after save.</p>
			</section>

			<section className="grid gap-3">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<h2 className="heading-xs text-primary">Mentions</h2>
					<Button
						ref={addMentionRef}
						as={BasicLink}
						variant="secondary"
						size="md"
						href="/research/admin/trusted-by/mentions/new"
					>
						<Icon name="plus" className="size-3.5" />
						Add mention
					</Button>
				</div>

				{queryRefreshFailed(mentionsQuery) ? (
					<InlineStatus variant="error" retry={mentionsQuery}>
						Couldn&apos;t refresh mentions. It may not show your latest change.
					</InlineStatus>
				) : null}
				{queryReadFailed(mentionsQuery) ? (
					<PanelStatus variant="error" retry={mentionsQuery} className="min-h-32">
						Couldn&apos;t load mentions.
						{mentionsQuery.error instanceof ArticleApiError ? ` ${mentionsQuery.error.message}` : null}
					</PanelStatus>
				) : mentionsQuery.isLoading ? (
					<PanelLoadingStatus label="Loading mentions" className="min-h-32" />
				) : mentions.length === 0 ? (
					<EmptyState size="md" title="No mentions yet" framed />
				) : (
					<DndContext sensors={mentionSensors} onDragEnd={handleMentionDragEnd} modifiers={VERTICAL_SORTING_MODIFIERS}>
						<SortableContext items={mentions.map((mention) => mention.id)} strategy={verticalListSortingStrategy}>
							<ul className="grid divide-y divide-(--border-medium) overflow-hidden rounded-md border border-medium bg-surface">
								{mentions.map((mention) => {
									const enabledIndex = enabledIndexById.get(mention.id) ?? -1
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
												onDelete={(control) =>
													confirmDelete(
														{
															kind: 'mention',
															id: mention.id,
															name: mention.username || mention.xPostId || 'this mention'
														},
														control
													)
												}
												deletePending={deleteMentionMutation.isPending}
											/>
										</SlideBoundary>
									)
								})}
							</ul>
						</SortableContext>
					</DndContext>
				)}
				<p className="body-sm text-tertiary">Drag to reorder. Order is reflected on /research after save.</p>
			</section>

			{enabledMentions.length > 0 ? (
				<section className="grid min-w-0 gap-3">
					<div className="flex flex-wrap items-end justify-between gap-3">
						<h2 className="heading-xs text-primary">Slide preview</h2>
						<Button variant="secondary" size="md" onClick={() => setShowFullPreview((prev) => !prev)}>
							<StableLabel
								labels={['Load full preview with X posts', 'Show quote cards only']}
								current={showFullPreview ? 'Show quote cards only' : 'Load full preview with X posts'}
							/>
						</Button>
					</div>
					<div className="grid gap-3">
						{chunkMentions(enabledMentions).map((block, blockIndex) => (
							<div key={block[0].id} className="grid min-w-0 gap-2 rounded-md border border-medium bg-surface p-4">
								<span className="label-xs tracking-[0.18em] text-tertiary uppercase">Slide {blockIndex + 1}</span>
								{showFullPreview ? (
									<div
										className="min-w-0 overflow-x-auto"
										role="region"
										aria-label={`Slide ${blockIndex + 1} preview`}
										// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users must be able to scroll this fixed-width preview.
										tabIndex={0}
									>
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
					<p className="body-sm text-tertiary">
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
			<li className="bg-page px-4 py-1.5">
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
	onDelete: (control: HTMLElement) => void
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
			className={`grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 p-4 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] ${logo.enabled ? '' : 'opacity-50'}`}
		>
			<Tooltip
				content="Drag to reorder"
				render={
					<Button
						variant="ghost"
						size="sm"
						square
						disabled={disabled}
						accessibleWhenDisabled
						className="touch-none"
						aria-label={`Drag ${logo.name}`}
						{...attributes}
						{...listeners}
					/>
				}
			>
				<Icon name="menu" className="size-4 text-tertiary" />
			</Tooltip>

			{/* eslint-disable-next-line @next/next/no-img-element */}
			<img src={logo.imageUrl} alt="" className="h-8 shrink-0 object-contain" />

			<div className="grid min-w-0 gap-0.5">
				<p className="truncate label-md text-primary">{logo.name}</p>
				<p className="truncate body-sm text-tertiary">{linkHost(logo.linkUrl)}</p>
			</div>

			<div className="col-span-full flex flex-wrap items-center gap-2 justify-self-end sm:col-auto">
				<Checkbox
					variant="inline-sm"
					checked={logo.enabled}
					onChange={(e) => onToggle(e.target.checked)}
					isLoading={togglePending}
				>
					Enabled
				</Checkbox>
				<Button as={BasicLink} variant="secondary" size="sm" href={`/research/admin/trusted-by/logos/${logo.id}`}>
					Edit
				</Button>
				<Button
					variant="destructive"
					size="sm"
					onClick={(event) => onDelete(event.currentTarget)}
					aria-label={`Delete ${logo.name}`}
					disabled={deletePending}
				>
					Delete
				</Button>
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
	onDelete: (control: HTMLElement) => void
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
			className={`grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 p-4 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] ${mention.enabled ? '' : 'opacity-50'}`}
		>
			<Tooltip
				content="Drag to reorder"
				render={
					<Button
						variant="ghost"
						size="sm"
						square
						disabled={disabled}
						accessibleWhenDisabled
						className="touch-none"
						aria-label="Drag mention"
						{...attributes}
						{...listeners}
					/>
				}
			>
				<Icon name="menu" className="size-4 text-tertiary" />
			</Tooltip>

			{slotLabel ? (
				<span className="inline-flex shrink-0 items-center rounded-full bg-brand-muted px-2 py-0.5 label-xs tracking-[0.18em] text-link uppercase">
					{slotLabel}
				</span>
			) : (
				<span className="size-2" />
			)}

			<div className="grid min-w-0 gap-0.5">
				<p className="line-clamp-1 body-md text-primary">
					{mention.quote || <span className="text-tertiary italic">no quote</span>}
				</p>
				<p className="truncate body-sm text-tertiary">
					{mention.username ? `@${mention.username}` : null}
					{mention.username && mention.xPostId ? ' · ' : null}
					{mention.xPostId}
				</p>
			</div>

			<div className="col-span-full flex flex-wrap items-center gap-2 justify-self-end sm:col-auto">
				<Checkbox
					variant="inline-sm"
					checked={mention.enabled}
					onChange={(e) => onToggle(e.target.checked)}
					isLoading={togglePending}
				>
					Enabled
				</Checkbox>
				<Button as={BasicLink} variant="secondary" size="sm" href={`/research/admin/trusted-by/mentions/${mention.id}`}>
					Edit
				</Button>
				<Button
					variant="destructive"
					size="sm"
					onClick={(event) => onDelete(event.currentTarget)}
					aria-label={`Delete mention ${mention.username || mention.xPostId || ''}`}
					disabled={deletePending}
				>
					Delete
				</Button>
			</div>
		</li>
	)
}
