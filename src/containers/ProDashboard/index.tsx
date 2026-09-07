import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { BasicLink } from '~/components/Link'
import { getMyDashboardAuthorProfile } from '~/containers/Authors/api'
import { avatarColorStyle } from '~/containers/Authors/avatarColor'
import { hasCustomizedAuthorProfile } from '~/containers/Authors/profileDefaults'
import type { PublicDashboardAuthor } from '~/containers/Authors/types'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import { Tooltip } from '~/ui/Tooltip'
import { formatNumber } from '~/utils/numberFormat'
import { AppMetadataProvider } from './AppMetadataContext'
import { ChartGrid } from './components/ChartGrid'
import { CopyDashboardLinkButton } from './components/CopyDashboardLinkButton'
import { CustomTimePeriodPicker } from './components/CustomTimePeriodPicker'
import { EmptyState } from './components/EmptyState'
import { LikeDashboardButton } from './components/LikeDashboardButton'
import {
	getInitialSqlRefreshProgress,
	getSqlRefreshProgress,
	refreshAllSqlCharts,
	subscribeSqlRefreshProgress
} from './components/SqlChart/sqlRefreshBus'
import type { UnifiedTableFocusSection } from './components/UnifiedTable/types'
import type { DashboardItemConfig } from './dashboardItemConfig'
import type { TimePeriod } from './dashboardTypes'
import { useFreeTierStatus } from './hooks/useFreeTierStatus'
import {
	useDashboardMode,
	useProDashboardCatalog,
	useProDashboardDashboard,
	useProDashboardItemsState,
	useProDashboardPermissions,
	useProDashboardTime,
	useProDashboardUI
} from './ProDashboardAPIContext'
import type { SqlChartConfig } from './types'

const DemoPreview = lazy(() => import('./components/DemoPreview').then((m) => ({ default: m.DemoPreview })))

import { DashboardPaywallModal, type PaywallReason } from './components/DashboardPaywallModal'
const AddChartModal = lazy(() =>
	import('./components/AddChartModal/AddChartModal').then((m) => ({ default: m.AddChartModal }))
)
const SqlChartModal = lazy(() =>
	import('./components/SqlChart/SqlChartModal').then((m) => ({ default: m.SqlChartModal }))
)
const CreateDashboardPicker = lazy(() =>
	import('./components/CreateDashboardPicker').then((m) => ({ default: m.CreateDashboardPicker }))
)
const DashboardSettingsModal = lazy(() =>
	import('./components/DashboardSettingsModal').then((m) => ({ default: m.DashboardSettingsModal }))
)
const GenerateDashboardModal = lazy(() =>
	import('./components/GenerateDashboardModal').then((m) => ({ default: m.GenerateDashboardModal }))
)
const AIGenerationHistory = lazy(() =>
	import('./components/AIGenerationHistory').then((m) => ({ default: m.AIGenerationHistory }))
)
const Rating = lazy(() => import('./components/Rating').then((m) => ({ default: m.Rating })))

function DashboardAuthorByline({ author }: { author?: PublicDashboardAuthor }) {
	if (!author) return null
	return (
		<BasicLink
			href={`/authors/${author.slug}`}
			className="mt-3 inline-flex items-center gap-2 text-sm text-pro-text-secondary hover:text-link"
		>
			{author.avatarUrl ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={author.avatarUrl} alt="" className="size-6 rounded-full object-cover" />
			) : (
				<span
					className="flex size-6 items-center justify-center rounded-full text-sm"
					style={avatarColorStyle(author.slug)}
				>
					🦙
				</span>
			)}
			<span>
				By <span className="font-medium">{author.displayName}</span>
			</span>
		</BasicLink>
	)
}

function AuthorProfileSetupNotice() {
	const [dismissed, setDismissed] = useState(false)
	if (dismissed) return null

	return (
		<div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-link/20 bg-pro-link-button-bg px-3 py-2.5 text-sm">
			<div className="flex min-w-0 items-start gap-2">
				<Icon name="users" className="mt-0.5 size-4 shrink-0 text-link" />
				<div className="min-w-0">
					<p className="font-medium text-pro-text-primary">Set up your dashboard author profile</p>
					<p className="mt-0.5 text-xs leading-5 text-pro-text-secondary">
						Add your name, avatar, and links so visitors can see who built this dashboard.
					</p>
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<BasicLink
					href="/account?tab=profile"
					className="rounded-md bg-link px-3 py-1.5 text-xs font-medium text-on-brand"
				>
					Open settings
				</BasicLink>
				<button
					type="button"
					onClick={() => setDismissed(true)}
					aria-label="Dismiss profile setup notice"
					className="flex size-7 items-center justify-center rounded-md text-pro-text-tertiary transition-colors hover:bg-pro-cards-bg hover:text-pro-text-primary"
				>
					<Icon name="x" className="size-3.5" />
				</button>
			</div>
		</div>
	)
}

function ProDashboardContent() {
	const [showAddModal, setShowAddModal] = useState<boolean>(false)
	const [editModalState, setEditModalState] = useState<{
		item: DashboardItemConfig | null
		focusSection?: UnifiedTableFocusSection
	}>({ item: null })
	const [sqlModalState, setSqlModalState] = useState<{ open: boolean; item: SqlChartConfig | null }>({
		open: false,
		item: null
	})
	const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false)
	const { authorizedFetch, isAuthenticated, hasActiveSubscription, user } = useAuthContext()
	const { canCreateDashboard } = useFreeTierStatus()
	const [paywallState, setPaywallState] = useState<{ open: boolean; reason: PaywallReason }>({
		open: false,
		reason: 'pro-feature'
	})
	const paywallDialogStore = Ariakit.useDialogStore({
		open: paywallState.open,
		setOpen: (open) => setPaywallState((prev) => ({ ...prev, open }))
	})
	const showPaywall = (reason: PaywallReason) => {
		setSignupSource('pro-dashboard')
		setPaywallState({ open: true, reason })
	}
	const router = useRouter()
	const mode = useDashboardMode()
	const { items } = useProDashboardItemsState()
	const { protocolsLoading } = useProDashboardCatalog()
	const { timePeriod, customTimePeriod, setTimePeriod, setCustomTimePeriod } = useProDashboardTime()
	const { isReadOnly } = useProDashboardPermissions()
	const sqlRefreshProgress = useSyncExternalStore(
		subscribeSqlRefreshProgress,
		getSqlRefreshProgress,
		getInitialSqlRefreshProgress
	)
	const sqlRefreshActive = sqlRefreshProgress.active > 0
	const prevSqlRefreshActiveRef = useRef(0)
	useEffect(() => {
		const prevActive = prevSqlRefreshActiveRef.current
		prevSqlRefreshActiveRef.current = sqlRefreshProgress.active
		if (prevActive > 0 && sqlRefreshProgress.active === 0 && sqlRefreshProgress.bulk) {
			if (sqlRefreshProgress.failed > 0) {
				toast.error(`${sqlRefreshProgress.failed} of ${sqlRefreshProgress.total} SQL widgets failed to refresh`)
			} else {
				toast.success('All SQL widgets refreshed')
			}
		}
	}, [sqlRefreshProgress])
	const guardNavigationWhileRefreshing = sqlRefreshActive && !isReadOnly
	useEffect(() => {
		if (!guardNavigationWhileRefreshing) return
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault()
			event.returnValue = ''
		}
		const handleRouteChangeStart = () => {
			if (window.confirm('SQL widgets are still refreshing. Leave anyway?')) return
			router.events.emit('routeChangeError')
			throw new Error('Route change aborted: SQL refresh in progress')
		}
		window.addEventListener('beforeunload', handleBeforeUnload)
		router.events.on('routeChangeStart', handleRouteChangeStart)
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload)
			router.events.off('routeChangeStart', handleRouteChangeStart)
		}
	}, [guardNavigationWhileRefreshing, router])
	const {
		dashboardName,
		setDashboardName,
		dashboardId,
		saveDashboard,
		copyDashboard,
		dashboardVisibility,
		dashboardTags,
		dashboardDescription,
		currentDashboard,
		setDashboardVisibility,
		setDashboardTags,
		setDashboardDescription,
		handleCreateDashboard,
		handleGenerateDashboard,
		handleIterateDashboard,
		getCurrentRatingSession,
		submitRating,
		skipRating,
		dismissRating,
		undoAIGeneration,
		canUndo,
		deleteDashboard
	} = useProDashboardDashboard()
	const {
		createDashboardDialogStore,
		showGenerateDashboardModal,
		setShowGenerateDashboardModal,
		showIterateDashboardModal,
		setShowIterateDashboardModal
	} = useProDashboardUI()
	const isDashboardOwner = isAuthenticated && !!currentDashboard?.user && currentDashboard.user === user?.id
	const { data: authorProfile, isSuccess: authorProfileLoaded } = useQuery({
		queryKey: ['dashboard-author-profile', user?.id],
		queryFn: () => getMyDashboardAuthorProfile(authorizedFetch),
		enabled: isDashboardOwner && !!user?.id,
		retry: false,
		refetchOnWindowFocus: false
	})

	const timePeriods: Array<{ value: TimePeriod; label: string }> = [
		{ value: '30d', label: '30d' },
		{ value: '90d', label: '90d' },
		{ value: '365d', label: '365d' },
		{ value: 'ytd', label: 'YTD' },
		{ value: '3y', label: '3Y' },
		{ value: 'all', label: 'All' }
	]

	const hasChartItems = items?.some(
		(item) =>
			item?.kind === 'chart' ||
			item?.kind === 'multi' ||
			item?.kind === 'builder' ||
			item?.kind === 'yields' ||
			item?.kind === 'stablecoins' ||
			item?.kind === 'stablecoin-asset' ||
			item?.kind === 'advanced-tvl' ||
			item?.kind === 'advanced-borrowed' ||
			item?.kind === 'income-statement' ||
			item?.kind === 'unlocks-schedule' ||
			item?.kind === 'unlocks-pie' ||
			item?.kind === 'llamaai-chart'
	)

	const currentRatingSession = getCurrentRatingSession()
	const shouldShowAuthorProfileSetup =
		isDashboardOwner && authorProfileLoaded && !!authorProfile && !hasCustomizedAuthorProfile(authorProfile)

	const openAddModal = () => {
		setShowAddModal(true)
	}

	const handleEditItemModal = (item: DashboardItemConfig, focusSection?: UnifiedTableFocusSection) => {
		if (item.kind === 'sql') {
			setSqlModalState({ open: true, item })
			return
		}
		setEditModalState({ item, ...(focusSection === undefined ? {} : { focusSection }) })
		setShowAddModal(true)
	}

	const openSqlModal = () => {
		setShowAddModal(false)
		setEditModalState({ item: null })
		setSqlModalState({ open: true, item: null })
	}

	if (!isAuthenticated && !hasActiveSubscription && dashboardVisibility !== 'public') {
		return (
			<Suspense
				fallback={
					<div className="flex flex-1 flex-col items-center justify-center gap-1 rounded-md border border-pro-cards-border bg-pro-cards-bg p-1" />
				}
			>
				<DemoPreview />
			</Suspense>
		)
	}

	return (
		<div className="flex flex-1 flex-col gap-2 pro-dashboard p-2 lg:px-0">
			<BasicLink href="/pro" className="mr-auto mb-2 flex items-center gap-2 text-pro-text-label hover:text-link">
				<Icon name="arrow-left" height={16} width={16} />
				Back to Dashboards
			</BasicLink>

			<div className="overflow-hidden rounded-md border border-pro-cards-border bg-pro-cards-bg">
				<div className="grid gap-5 px-4 py-4 md:px-5 md:py-5 xl:grid-cols-[minmax(0,1fr)_minmax(280px,480px)] xl:items-start">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
							<h1 className="text-[clamp(1.375rem,1.1rem+0.7vw,2rem)] leading-tight font-semibold text-pro-text-primary">
								{dashboardName}
							</h1>
							{dashboardVisibility === 'public' ? (
								<p className="inline-flex items-center gap-1.5 rounded-md border border-pro-success-400/20 bg-pro-success-100 px-2 py-1 text-xs font-medium text-pro-success-400 dark:bg-pro-success-300/12 dark:text-pro-success-200">
									<span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
									Public
								</p>
							) : (
								<p className="inline-flex items-center gap-1.5 rounded-md border border-pro-premium-400/20 bg-pro-premium-100 px-2 py-1 text-xs font-medium text-pro-premium-400 dark:bg-pro-premium-300/12 dark:text-pro-premium-200">
									<Icon name="key" height={12} width={12} />
									Private
								</p>
							)}
							{currentDashboard?.aiGenerated && Object.keys(currentDashboard.aiGenerated).length > 0 ? (
								<p className="inline-flex items-center gap-1.5 rounded-md border border-pro-info-400/20 bg-pro-info-100 px-2 py-1 text-xs font-medium text-pro-info-400 dark:bg-pro-info-300/12 dark:text-pro-info-200">
									<Icon name="sparkles" height={13} width={13} />
									AI Generated
								</p>
							) : null}
						</div>
						<DashboardAuthorByline {...(currentDashboard?.author ? { author: currentDashboard.author } : {})} />
						{shouldShowAuthorProfileSetup ? <AuthorProfileSetupNotice /> : null}
						{dashboardDescription ? (
							<p className="mt-2 max-w-3xl text-sm leading-6 text-pro-text-form">{dashboardDescription}</p>
						) : null}
						{dashboardTags.length > 0 ? (
							<ul aria-label="Dashboard tags" className="mt-4 flex flex-wrap gap-1.5">
								{dashboardTags.map((tag) => (
									<li
										key={tag}
										className="rounded-md border border-pro-cards-border bg-surface-elevated-1/50 px-2 py-1 text-xs text-pro-text-label"
									>
										{tag}
									</li>
								))}
							</ul>
						) : null}
					</div>
					<div className="flex min-w-0 flex-col gap-3 xl:items-end">
						<div className="flex flex-wrap items-center gap-2 xl:justify-end">
							{isAuthenticated ? (
								<>
									{mode === 'view' && dashboardId && currentDashboard?.user === user?.id ? (
										<button
											type="button"
											onClick={() => {
												void router.push(`/pro/${currentDashboard?.slug ?? dashboardId}/edit`)
											}}
											className="flex items-center gap-1 rounded-md pro-btn-ai px-3 py-1.5 text-sm"
										>
											<Icon name="pencil" height={16} width={16} />
											<span>Edit</span>
										</button>
									) : null}
									{mode === 'edit' && dashboardId ? (
										<button
											type="button"
											onClick={() => {
												void router.push(`/pro/${currentDashboard?.slug ?? dashboardId}`)
											}}
											disabled={sqlRefreshActive}
											title={sqlRefreshActive ? 'Wait for SQL widgets to finish refreshing' : undefined}
											className="flex items-center gap-1 rounded-md pro-btn-ai px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
										>
											{sqlRefreshActive ? <LoadingSpinner size={16} /> : <Icon name="check" height={16} width={16} />}
											<span>Done</span>
										</button>
									) : null}
									{isReadOnly ? (
										<button
											type="button"
											onClick={() => {
												if (canCreateDashboard) {
													void copyDashboard()
												} else {
													showPaywall('dashboard-limit')
												}
											}}
											className="flex items-center gap-1 rounded-md pro-btn-primary-outline px-3 py-1.5 text-sm"
										>
											<Icon name="copy" height={16} width={16} />
											<span>Copy Dashboard</span>
										</button>
									) : null}
									<button
										type="button"
										onClick={() => {
											if (canCreateDashboard) {
												createDashboardDialogStore.show()
											} else {
												showPaywall('dashboard-limit')
											}
										}}
										className="flex items-center gap-1 rounded-md pro-btn-ai-outline px-3 py-1.5 text-sm"
									>
										<Icon name="plus" height={16} width={16} />
										<span>New Dashboard</span>
									</button>
								</>
							) : null}
						</div>
						<div className="flex flex-wrap items-center gap-1.5 xl:justify-end">
							<Tooltip
								content="Views"
								render={<p />}
								className="inline-flex items-center gap-1.5 rounded-md border border-pro-cards-border bg-surface-elevated-1/45 px-2.5 py-1.5 text-xs font-medium text-pro-text-label"
							>
								<Icon name="eye" height={14} width={14} />
								<span className="tabular-nums">{formatNumber(currentDashboard?.viewCount ?? 0)}</span>
								<span className="sr-only">Views</span>
							</Tooltip>
							{currentDashboard && dashboardId ? (
								<>
									<LikeDashboardButton
										currentDashboard={currentDashboard}
										dashboardVisibility={dashboardVisibility}
										dashboardId={dashboardId}
									/>
									<CopyDashboardLinkButton
										dashboardVisibility={dashboardVisibility}
										dashboardId={dashboardId}
										{...(currentDashboard.slug ? { dashboardSlug: currentDashboard.slug } : {})}
									/>
								</>
							) : null}
						</div>
					</div>
				</div>
			</div>

			{currentDashboard?.aiGenerated ? <AIGenerationHistory aiGenerated={currentDashboard.aiGenerated} /> : null}

			{currentRatingSession && !isReadOnly ? (
				<Suspense fallback={<></>}>
					<Rating
						sessionId={currentRatingSession.sessionId}
						mode={currentRatingSession.mode}
						variant="banner"
						prompt={currentRatingSession.prompt}
						onRate={submitRating}
						onSkip={skipRating}
						onDismiss={dismissRating}
					/>
				</Suspense>
			) : null}

			{hasChartItems || mode === 'edit' ? (
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					<Tooltip
						content={!hasChartItems ? 'Add chart items to enable time period selection' : null}
						placement="bottom"
					>
						<div className="order-2 flex gap-0 overflow-x-auto md:order-1">
							{timePeriods.map((period) => (
								<button
									type="button"
									key={period.value}
									className={`-ml-px flex-1 rounded-none border px-3 py-1.5 text-sm font-medium transition-colors duration-200 first:ml-0 first:rounded-l-md md:flex-initial md:px-4 md:py-2 ${
										timePeriod === period.value
											? 'pro-border pro-btn-primary'
											: 'pro-border pro-hover-bg text-pro-text-secondary hover:text-pro-text-primary'
									} ${!hasChartItems ? 'cursor-not-allowed opacity-50' : ''}`}
									onClick={() => hasChartItems && setTimePeriod(period.value)}
									disabled={!hasChartItems}
								>
									{period.label}
								</button>
							))}
							<CustomTimePeriodPicker
								isActive={timePeriod === 'custom'}
								customPeriod={customTimePeriod}
								onApply={(period) => setCustomTimePeriod(period)}
								onClear={() => setTimePeriod('365d')}
								disabled={!hasChartItems}
							/>
						</div>
					</Tooltip>
					<div className="order-3 flex items-center gap-2">
						{dashboardId && items.some((item) => item.kind === 'sql') ? (
							<button
								type="button"
								className="flex items-center gap-2 rounded-md border pro-border pro-hover-bg px-3 py-2 text-sm whitespace-nowrap text-pro-text-secondary transition-colors hover:text-pro-text-primary disabled:cursor-not-allowed disabled:opacity-60 md:px-4 md:text-base"
								onClick={() => refreshAllSqlCharts()}
								disabled={sqlRefreshActive}
								title="Re-run every SQL chart and table on this dashboard and update the results for everyone."
							>
								{sqlRefreshActive ? <LoadingSpinner size={16} /> : <Icon name="repeat" height={16} width={16} />}
								{sqlRefreshActive
									? `Refreshing ${sqlRefreshProgress.total - sqlRefreshProgress.active}/${sqlRefreshProgress.total}…`
									: 'Refresh all SQL'}
							</button>
						) : null}
						{!isReadOnly && dashboardId ? (
							<button
								type="button"
								onClick={() => setShowSettingsModal(true)}
								className="hidden rounded-md pro-glass pro-hover-bg p-2 transition-colors md:flex"
								title="Dashboard Settings"
							>
								<Icon name="settings" height={20} width={20} className="text-pro-text-primary" />
							</button>
						) : null}
						{!isReadOnly && items.length > 0 ? (
							<button
								type="button"
								className="hidden animate-pro-glow items-center gap-2 rounded-md pro-btn-primary-outline px-4 py-2 text-base whitespace-nowrap md:flex"
								onClick={() => {
									if (hasActiveSubscription) {
										setShowIterateDashboardModal(true)
									} else {
										showPaywall('llamaai')
									}
								}}
								title="Edit with LlamaAI"
							>
								<Icon name="sparkles" height={16} width={16} />
								Edit with LlamaAI
							</button>
						) : null}
						{!isReadOnly && canUndo ? (
							<button
								type="button"
								className="hidden items-center gap-2 rounded-md border pro-border pro-hover-bg px-4 py-2 text-base whitespace-nowrap text-pro-text-secondary transition-colors hover:text-pro-text-primary md:flex"
								onClick={() => {
									void undoAIGeneration()
								}}
								title="Undo AI changes"
							>
								<Icon name="arrow-left" height={16} width={16} />
								Undo
							</button>
						) : null}

						{!isReadOnly ? (
							<button
								type="button"
								className="hidden items-center gap-2 rounded-md pro-btn-primary px-4 py-2 text-base whitespace-nowrap md:flex"
								onClick={openAddModal}
								disabled={isReadOnly}
							>
								<Icon name="plus" height={16} width={16} />
								Add Item
							</button>
						) : null}
					</div>
				</div>
			) : null}

			{items.length > 0 ? <ChartGrid onAddChartClick={openAddModal} onEditItem={handleEditItemModal} /> : null}

			<Suspense fallback={<></>}>
				{showAddModal ? (
					<AddChartModal
						key={editModalState.item?.id ?? 'new-dashboard-item'}
						isOpen
						onClose={() => {
							setShowAddModal(false)
							setEditModalState({ item: null })
						}}
						editItem={editModalState.item}
						initialUnifiedFocusSection={editModalState.focusSection}
						onOpenSqlModal={openSqlModal}
					/>
				) : null}
			</Suspense>

			<Suspense fallback={<></>}>
				{sqlModalState.open ? (
					<SqlChartModal
						key={sqlModalState.item?.id ?? 'new-sql-item'}
						editItem={sqlModalState.item}
						onClose={() => setSqlModalState({ open: false, item: null })}
					/>
				) : null}
			</Suspense>

			{!protocolsLoading && items.length === 0 ? (
				<EmptyState
					onAddChart={openAddModal}
					onGenerateWithAI={
						hasActiveSubscription ? () => setShowIterateDashboardModal(true) : () => showPaywall('llamaai')
					}
					isReadOnly={isReadOnly}
				/>
			) : null}

			<Suspense fallback={<></>}>
				<DashboardSettingsModal
					isOpen={showSettingsModal}
					onClose={() => setShowSettingsModal(false)}
					dashboardName={dashboardName}
					visibility={dashboardVisibility}
					tags={dashboardTags}
					description={dashboardDescription}
					dashboardId={dashboardId}
					onDashboardNameChange={setDashboardName}
					onVisibilityChange={setDashboardVisibility}
					onTagsChange={setDashboardTags}
					onDescriptionChange={setDashboardDescription}
					onSave={saveDashboard}
					onDelete={deleteDashboard}
				/>
			</Suspense>

			<Suspense fallback={<></>}>
				<CreateDashboardPicker dialogStore={createDashboardDialogStore} onCreate={handleCreateDashboard} />
			</Suspense>

			<Suspense fallback={<></>}>
				<GenerateDashboardModal
					isOpen={showGenerateDashboardModal}
					onClose={() => setShowGenerateDashboardModal(false)}
					onGenerate={(prompt) => {
						void handleGenerateDashboard(prompt)
					}}
				/>
			</Suspense>

			<Suspense fallback={<></>}>
				<GenerateDashboardModal
					isOpen={showIterateDashboardModal}
					onClose={() => setShowIterateDashboardModal(false)}
					mode="iterate"
					existingDashboard={{
						dashboardName,
						visibility: dashboardVisibility,
						tags: dashboardTags,
						description: dashboardDescription,
						items,
						...(currentDashboard?.aiGenerated ? { aiGenerated: currentDashboard.aiGenerated } : {})
					}}
					onGenerate={(prompt) => {
						void handleIterateDashboard(prompt)
					}}
				/>
			</Suspense>

			{paywallState.open ? (
				<DashboardPaywallModal dialogStore={paywallDialogStore} reason={paywallState.reason} />
			) : null}
		</div>
	)
}

export default function ProDashboard() {
	return (
		<AppMetadataProvider>
			<ProDashboardContent />
		</AppMetadataProvider>
	)
}
