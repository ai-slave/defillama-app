import * as Ariakit from '@ariakit/react'
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { startTransition, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { BasicLink } from '~/components/Link'
import { Menu } from '~/components/Menu'
import { NewPortfolioDialog } from '~/components/NewPortfolioDialog'
import { useLocalSelection } from '~/components/Select/localSelection'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TokenLogo } from '~/components/TokenLogo'
import { useGroupAndFormatChains } from '~/containers/ChainsByCategory'
import { ChainsByCategoryTable } from '~/containers/ChainsByCategory/Table'
import { applyProtocolTvlSettings } from '~/containers/ProtocolLists/utils'
import { ChainProtocolsTable } from '~/containers/ProtocolRankings/Table'
import type { IProtocol } from '~/containers/ProtocolRankings/types'
import { LazySubscribeProModal } from '~/containers/Subscription/shared/SubscribeCards/LazySubscribeProModal'
import { WatchListTabs } from '~/containers/Yields/views/WatchlistView'
import { DEFAULT_PORTFOLIO_NAME, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useBookmarks } from '~/hooks/useBookmarks'
import { useEmailNotifications, type MetricType, type NotificationSettings } from '~/hooks/useEmailNotifications'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { Change } from '~/ui/Change'
import { Checkbox } from '~/ui/Checkbox'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Dialog, DialogBody, DialogFooter, DialogHeader, useOpeningKey, DialogCancelButton } from '~/ui/Dialog'
import { FieldGroup } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { EmptyState, InlineStatus, PanelLoadingStatus } from '~/ui/Status'
import { TableToolbar } from '~/ui/Toolbar'
import { httpErrorMessage } from '~/utils/async'
import { mapAPIMetricToUI, mapUIMetricToAPI } from '~/utils/notificationMetrics'
import { parseNumberQueryParam } from '~/utils/routerQuery'
import type { IChainsByCategoryData } from '../ChainsByCategory/types'
import { chainMetrics, protocolMetrics } from './constants'

const EMPTY_SAVED_PROTOCOLS: Array<IProtocol> = []
const EMPTY_SAVED_CHAINS: IChainsByCategoryData['chains'] = []

async function fetchWatchedRows<Row>(url: string, names: Array<string>): Promise<Array<Row>> {
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ names })
	})
	if (!response.ok) throw new Error(`Failed to load watchlist rows (${response.status})`)
	const payload = (await response.json()) as { rows: Array<Row> }
	return payload.rows
}

export function DefiWatchlistContainer({
	protocolOptions: protocolNames,
	chainOptions: chainNames
}: {
	/** Parent protocol names for the add-protocol picker; rows are fetched per saved name. */
	protocolOptions: Array<string>
	/** Chain names for the add-chain picker; rows are fetched per saved name. */
	chainOptions: Array<string>
}) {
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')

	const { selectedPortfolio, savedProtocols, addProtocol, removeProtocol, isLoadingWatchlist } = useBookmarks('defi')

	const { savedProtocols: savedChains, addProtocol: addChain, removeProtocol: removeChain } = useBookmarks('chains')

	const { selectedProtocolNames, watchedNames } = useMemo(() => {
		const selected = Array.from(savedProtocols)
		return {
			selectedProtocolNames: selected,
			// Stable query key: the same saved set always resolves to the same request.
			watchedNames: [...selected].sort()
		}
	}, [savedProtocols])

	const { data: protocolRowsData, isLoading: isLoadingProtocolRows } = useQuery({
		queryKey: ['watchlist-protocol-rows', watchedNames],
		queryFn: () => fetchWatchedRows<IProtocol>('/api/dynamic/protocol-rankings/rows', watchedNames),
		enabled: !isLoadingWatchlist && watchedNames.length > 0,
		staleTime: 5 * 60 * 1000,
		placeholderData: keepPreviousData
	})
	// An emptied watchlist disables the query, and keepPreviousData would keep
	// the deleted rows on screen forever - the empty set is decided locally.
	const savedProtocolsList =
		watchedNames.length > 0 ? (protocolRowsData ?? EMPTY_SAVED_PROTOCOLS) : EMPTY_SAVED_PROTOCOLS

	const router = useRouter()

	const minTvl = parseNumberQueryParam(router.query.minTvl)
	const maxTvl = parseNumberQueryParam(router.query.maxTvl)

	const protocolsTableData = useMemo(() => {
		return applyProtocolTvlSettings({ protocols: savedProtocolsList, extraTvlsEnabled, minTvl, maxTvl })
	}, [savedProtocolsList, extraTvlsEnabled, minTvl, maxTvl])

	const handleProtocolSelection = (selectedValues: Array<string>) => {
		const currentSet = new Set(selectedProtocolNames)
		const newSet = new Set(selectedValues)

		const toAdd = selectedValues.filter((name) => !currentSet.has(name))
		const toRemove = selectedProtocolNames.filter((name) => !newSet.has(name))

		for (const name of toAdd) addProtocol(name)
		for (const name of toRemove) removeProtocol(name)
	}

	const { selectedChainNames, watchedChainNames } = useMemo(() => {
		const selected = Array.from(savedChains)
		return {
			selectedChainNames: selected,
			watchedChainNames: [...selected].sort()
		}
	}, [savedChains])

	const { data: chainRowsData, isLoading: isLoadingChainRows } = useQuery({
		queryKey: ['watchlist-chain-rows', watchedChainNames],
		queryFn: () =>
			fetchWatchedRows<IChainsByCategoryData['chains'][number]>(
				'/api/dynamic/chains-by-category/rows',
				watchedChainNames
			),
		enabled: !isLoadingWatchlist && watchedChainNames.length > 0,
		staleTime: 5 * 60 * 1000,
		placeholderData: keepPreviousData
	})
	const savedChainsList = watchedChainNames.length > 0 ? (chainRowsData ?? EMPTY_SAVED_CHAINS) : EMPTY_SAVED_CHAINS

	const { chainsTableData, tvlQuickPicks } = useGroupAndFormatChains({
		chains: savedChainsList,
		category: 'All',
		hideGroupBy: true
	})

	const handleChainSelection = (selectedValues: Array<string>) => {
		const currentSet = new Set(selectedChainNames)
		const newSet = new Set(selectedValues)
		const toAdd = selectedValues.filter((name) => !currentSet.has(name))
		const toRemove = selectedChainNames.filter((name) => !newSet.has(name))
		for (const name of toAdd) addChain(name)
		for (const name of toRemove) removeChain(name)
	}

	if (isLoadingWatchlist) {
		return (
			<>
				<WatchListTabs />
				<PanelLoadingStatus />
			</>
		)
	}

	return (
		<>
			<WatchListTabs />
			<div className="flex flex-col gap-2">
				<PortfolioSelection />
				<PortfolioNotifications
					key={selectedPortfolio}
					selectedPortfolio={selectedPortfolio}
					filteredProtocols={protocolsTableData as any}
					filteredChains={chainsTableData}
				/>
				{protocolsTableData.length > 0 ? (
					<TopMovers protocols={protocolsTableData} portfolio={selectedPortfolio} />
				) : null}
				<Card padding="none">
					<TableToolbar>
						<div className="mr-auto">
							<h2 className="heading-xs">Protocols</h2>
							<p className="body-xs text-secondary">
								Select or deselect protocols for the "{selectedPortfolio}" portfolio
							</p>
						</div>
						<SelectWithCombobox
							allValues={protocolNames}
							selectedValues={selectedProtocolNames}
							setSelectedValues={handleProtocolSelection}
							label={selectedProtocolNames.length > 0 ? 'Protocols' : 'Add protocols'}
							labelType="smol"
							variant="filter"
							size="md"
						/>
					</TableToolbar>
					{protocolsTableData.length > 0 ? (
						<ChainProtocolsTable protocols={protocolsTableData} useStickyHeader={false} borderless />
					) : isLoadingProtocolRows && watchedNames.length > 0 ? (
						<PanelLoadingStatus />
					) : (
						<EmptyState size="md" icon="bookmark" title="No protocols in your watchlist" className="min-h-[360px]">
							Use the selector above to add protocols.
						</EmptyState>
					)}
				</Card>

				<Card padding="none">
					<TableToolbar>
						<div className="mr-auto">
							<h2 className="heading-xs">Chains</h2>
							<p className="body-xs text-secondary">
								Select or deselect chains for the "{selectedPortfolio}" portfolio
							</p>
						</div>
						<SelectWithCombobox
							allValues={chainNames}
							selectedValues={selectedChainNames}
							setSelectedValues={handleChainSelection}
							label={selectedChainNames.length > 0 ? 'Chains' : 'Add chains'}
							labelType="smol"
							variant="filter"
							size="md"
						/>
					</TableToolbar>
					{chainsTableData.length > 0 ? (
						<ChainsByCategoryTable
							data={chainsTableData}
							useStickyHeader={false}
							borderless
							showByGroup={false}
							tvlQuickPicks={tvlQuickPicks}
						/>
					) : isLoadingChainRows && watchedChainNames.length > 0 ? (
						<PanelLoadingStatus />
					) : (
						<EmptyState size="md" icon="map" title="No chains in your watchlist" className="min-h-[360px]">
							Use the selector above to add chains.
						</EmptyState>
					)}
				</Card>
			</div>
		</>
	)
}

const EMPTY_ARRAY: Array<any> = []

export function PortfolioNotifications({
	selectedPortfolio,
	filteredProtocols = EMPTY_ARRAY,
	filteredChains = EMPTY_ARRAY
}: {
	selectedPortfolio: string
	filteredProtocols?: Array<any>
	filteredChains?: Array<any>
}) {
	const [settingsOpen, setSettingsOpen] = useState(false)
	const [confirmingDelete, setConfirmingDelete] = useState(false)
	// Delete and Enable leave with the preferences, so a successful delete closes onto the setup button.
	const settingsButtonRef = useRef<HTMLButtonElement>(null)
	const settingsOpening = useOpeningKey(settingsOpen)
	const isClient = useIsClient()
	const { loaders, isAuthenticated, hasActiveSubscription } = useAuthContext()
	const { preferences, isLoading, isFetching, readFailed, refetch, savePreferences, updateStatus, deletePreferences } =
		useEmailNotifications(selectedPortfolio)
	const isChangingPreferences = savePreferences.isPending || updateStatus.isPending || deletePreferences.isPending
	const subscribeModalStore = Ariakit.useDialogStore()
	const hasWatchlist = filteredProtocols.length > 0 || filteredChains.length > 0

	const { protocolsCount, protocolsFirstMetrics, chainsCount, chainsFirstMetrics } = useMemo(() => {
		const protocols = preferences?.settings?.protocols
		const chains = preferences?.settings?.chains
		let protocolsCount = 0
		let protocolsFirstMetrics = ''
		let chainsCount = 0
		let chainsFirstMetrics = ''

		for (const protocolId in protocols ?? {}) {
			protocolsCount++
			if (protocolsCount === 1) {
				protocolsFirstMetrics = protocols[protocolId]?.map(mapAPIMetricToUI).join(', ') ?? ''
			}
		}

		for (const chainId in chains ?? {}) {
			chainsCount++
			if (chainsCount === 1) {
				chainsFirstMetrics = chains[chainId]?.map(mapAPIMetricToUI).join(', ') ?? ''
			}
		}

		return {
			protocolsCount,
			protocolsFirstMetrics,
			chainsCount,
			chainsFirstMetrics
		}
	}, [preferences?.settings?.protocols, preferences?.settings?.chains])

	const handleNotificationsButtonClick = () => {
		if (!isClient || loaders.userLoading) return
		if (!isAuthenticated || !hasActiveSubscription) {
			setSignupSource('watchlist')
			subscribeModalStore.show()
			return
		}
		setSettingsOpen(true)
	}

	// Page actions: the card shows the new status, and a toast says what happened or why it failed.
	const setActive = (active: boolean) => {
		if (isChangingPreferences) return
		// The toasts hang on the promise, not on mutate's callbacks, so they still show after the reader leaves the page.
		updateStatus.mutateAsync({ portfolioName: selectedPortfolio, active }).then(
			() => toast.success(active ? 'Notification preferences enabled' : 'Notification preferences disabled'),
			(statusError) => toast.error(httpErrorMessage(statusError, 'Failed to update notification status'))
		)
	}

	return (
		<>
			<Card padding="sm">
				<div className="mb-2">
					<h2 className="mb-0.5 heading-xs">Email Notifications</h2>
					{/* A failed read is unknown, not "none": offering setup would POST over the saved preferences. */}
					{readFailed ? (
						<InlineStatus variant="error" retry={{ refetch, isFetching }}>
							Couldn&apos;t load the email notifications for the &quot;{selectedPortfolio}&quot; portfolio
							{selectedPortfolio === DEFAULT_PORTFOLIO_NAME
								? ", so they can't be changed yet."
								: ", so they can't be changed and the portfolio can't be deleted yet."}
						</InlineStatus>
					) : (
						<p className="body-sm text-secondary">
							{preferences ? (
								preferences.active ? (
									<span className="flex items-start gap-2">
										<span className="flex h-lh shrink-0 items-center">
											<Icon name="check-circle" height={14} width={14} className="text-success" />
										</span>
										<span>
											Weekly email notifications are <strong className="text-success">active</strong> for "
											{selectedPortfolio}" portfolio
										</span>
									</span>
								) : (
									<span className="flex items-start gap-2">
										<span className="flex h-lh shrink-0 items-center">
											<Icon name="pause" height={14} width={14} className="text-secondary" />
										</span>
										<span>
											Weekly email notifications are <strong className="text-secondary">disabled</strong> for "
											{selectedPortfolio}" portfolio
										</span>
									</span>
								)
							) : (
								<span>Set up weekly email notifications for the "{selectedPortfolio}" portfolio</span>
							)}
						</p>
					)}
				</div>

				{readFailed ? null : preferences?.settings ? (
					<div className="mb-3 rounded-lg bg-surface-elevated-1 p-3">
						<div className="space-y-1 body-xs text-secondary">
							{protocolsCount > 0 ? (
								<p>
									<span className="font-medium">Tracking {protocolsCount} protocol(s)</span>
									{' - '}
									<span>{protocolsFirstMetrics}</span>
								</p>
							) : null}
							{chainsCount > 0 ? (
								<p>
									<span className="font-medium">Tracking {chainsCount} chain(s)</span>
									{' - '}
									<span>{chainsFirstMetrics}</span>
								</p>
							) : null}
							<div className="mt-1 text-tertiary">
								<Icon name="calendar" height={12} width={12} className="mr-1 inline" />
								Delivered weekly to your email
							</div>
						</div>
					</div>
				) : null}

				{readFailed ? null : (
					<div className="flex flex-wrap items-center gap-2">
						<Button
							ref={settingsButtonRef}
							size="md"
							type="button"
							onClick={handleNotificationsButtonClick}
							disabled={loaders.userLoading || isLoading || !hasWatchlist}
						>
							<Icon name="mail" height={16} width={16} />
							<span>{preferences ? 'Update settings' : 'Set up notifications'}</span>
						</Button>

						{preferences ? (
							<>
								<Button
									size="md"
									type="button"
									onClick={() => setActive(!preferences.active)}
									disabled={loaders.userLoading || isChangingPreferences}
									pendingLabel="Updating…"
									pending={updateStatus.isPending}
								>
									<Icon name={preferences.active ? 'pause' : 'check-circle'} height={16} width={16} />
									<span>{preferences.active ? 'Disable' : 'Enable'}</span>
								</Button>
								<Button
									variant="destructive"
									size="md"
									type="button"
									onClick={() => setConfirmingDelete(true)}
									disabled={loaders.userLoading || isChangingPreferences}
								>
									<Icon name="trash-2" height={16} width={16} />
									<span>Delete</span>
								</Button>
							</>
						) : null}
						{hasWatchlist ? null : (
							<p className="body-sm text-tertiary">
								Add protocols or chains to your watchlist to set up notifications.
							</p>
						)}
					</div>
				)}
			</Card>
			<LazySubscribeProModal dialogStore={subscribeModalStore} />
			{confirmingDelete ? (
				<ConfirmActionDialog
					finalFocus={settingsButtonRef}
					title="Delete email notifications?"
					description={`Weekly emails for the "${selectedPortfolio}" portfolio stop, and its notification settings are removed.`}
					confirmLabel="Delete"
					pendingLabel="Deleting…"
					mutation={deletePreferences}
					variables={{ portfolioName: selectedPortfolio }}
					onClose={() => setConfirmingDelete(false)}
					successMessage="Notification preferences deleted"
				/>
			) : null}
			<Dialog
				size="md"
				open={settingsOpen}
				onClose={() => setSettingsOpen(false)}
				pending={savePreferences.isPending}
				unmountOnHide
				portal
			>
				<NotificationSettingsForm
					key={settingsOpening}
					selectedPortfolio={selectedPortfolio}
					savedSettings={preferences?.settings}
					filteredProtocols={filteredProtocols}
					filteredChains={filteredChains}
					save={savePreferences}
					onSaved={() => {
						setSettingsOpen(false)
						toast.success('Notification preferences saved')
					}}
				/>
			</Dialog>
		</>
	)
}

/** The metrics saved for the first protocol and chain stand for all of them: the form applies one choice to every
    watchlisted protocol and one to every chain. */
function savedMetrics(entries: Record<string, Array<MetricType>> | undefined): Array<string> {
	for (const key in entries ?? {}) return entries![key]!.map(mapAPIMetricToUI)
	return []
}

/** One choice of metrics for every watchlisted protocol and one for every chain. A side with no picks, or no
    entities with an id, is left out, so the server keeps no empty map. */
export function buildNotificationSettings(
	protocolPicks: Array<string>,
	protocolSlugs: Array<string | undefined>,
	chainPicks: Array<string>,
	chainNames: Array<string | undefined>
): NotificationSettings {
	const settings: NotificationSettings = {}
	const protocols = metricsByEntity(protocolPicks, protocolSlugs)
	if (protocols) settings.protocols = protocols
	const chains = metricsByEntity(chainPicks, chainNames)
	if (chains) settings.chains = chains
	return settings
}

function metricsByEntity(picks: Array<string>, ids: Array<string | undefined>) {
	if (picks.length === 0) return null
	const metrics = picks.map(mapUIMetricToAPI)
	const map: Record<string, Array<MetricType>> = {}
	let count = 0
	for (const id of ids) {
		if (!id) continue
		map[id] = metrics
		count++
	}
	return count > 0 ? map : null
}

function NotificationSettingsForm({
	selectedPortfolio,
	savedSettings,
	filteredProtocols,
	filteredChains,
	save,
	onSaved
}: {
	selectedPortfolio: string
	savedSettings: NotificationSettings | undefined
	filteredProtocols: Array<any>
	filteredChains: Array<any>
	save: ReturnType<typeof useEmailNotifications>['savePreferences']
	onSaved: () => void
}) {
	const [protocolPicks, setProtocolPicks] = useState(() => savedMetrics(savedSettings?.protocols))
	const [chainPicks, setChainPicks] = useState(() => savedMetrics(savedSettings?.chains))
	const [submitted, setSubmitted] = useState(false)
	// The last save failure, kept while a retry runs: the mutation clears its own error when the retry starts.
	const [failure, setFailure] = useState<string | null>(null)

	const settings = buildNotificationSettings(
		protocolPicks,
		filteredProtocols.map((protocol) => protocol.slug),
		chainPicks,
		filteredChains.map((chain) => chain.name)
	)
	const isEmpty = settings.protocols == null && settings.chains == null
	// The pick spans both groups, so the error sits under the last group that has anything to pick.
	const emptyError = submitted && isEmpty ? 'Choose at least one protocol or chain metric.' : null

	return (
		<form
			noValidate
			className="flex min-h-0 flex-auto flex-col"
			onSubmit={(event) => {
				event.preventDefault()
				if (save.isPending) return
				if (isEmpty) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
				const form = event.currentTarget
				// The dialog locks while saving, but leaving the page unmounts it; then only a toast can tell.
				save.mutateAsync({ portfolioName: selectedPortfolio, settings, frequency: 'weekly' }).then(onSaved, (error) => {
					const message = httpErrorMessage(error, 'Failed to save notification preferences')
					if (form.isConnected) setFailure(message)
					else toast.error(message)
				})
			}}
		>
			<DialogHeader
				title="Email notification settings"
				subtitle={`Weekly emails for the "${selectedPortfolio}" portfolio`}
			/>
			<DialogBody>
				<MetricChoices
					title="Protocol metrics"
					count={filteredProtocols.length}
					noun="protocol"
					metrics={protocolMetrics}
					picked={protocolPicks}
					onChange={setProtocolPicks}
					disabled={save.isPending}
					error={filteredChains.length === 0 ? emptyError : null}
				/>
				<MetricChoices
					title="Chain metrics"
					count={filteredChains.length}
					noun="chain"
					metrics={chainMetrics}
					picked={chainPicks}
					onChange={setChainPicks}
					disabled={save.isPending}
					error={filteredChains.length > 0 ? emptyError : null}
				/>
				{failure ? <InlineStatus variant="error">{failure}</InlineStatus> : null}
			</DialogBody>
			<DialogFooter dismiss={<DialogCancelButton />}>
				<Button type="submit" variant="primary" size="md" pendingLabel="Saving…" pending={save.isPending}>
					{savedSettings ? 'Update settings' : 'Enable notifications'}
				</Button>
			</DialogFooter>
		</form>
	)
}

function MetricChoices({
	title,
	count,
	noun,
	metrics,
	picked,
	onChange,
	disabled,
	error
}: {
	title: string
	count: number
	noun: string
	metrics: ReadonlyArray<{ key: string; name: string }>
	picked: Array<string>
	onChange: (picked: Array<string>) => void
	disabled: boolean
	error: string | null
}) {
	return (
		<FieldGroup label={title} error={error}>
			{count > 0 ? (
				<>
					<p className="body-sm text-secondary">
						Pick the metrics to email for your {count} watchlisted {noun}
						{count === 1 ? '' : 's'}.
					</p>
					<div className="flex flex-wrap gap-x-4 gap-y-2">
						{metrics.map((metric) => (
							<Checkbox
								key={metric.key}
								variant="inline"
								disabled={disabled}
								checked={picked.includes(metric.key)}
								onChange={(event) =>
									onChange(
										event.target.checked ? picked.concat(metric.key) : picked.filter((key) => key !== metric.key)
									)
								}
							>
								{metric.name}
							</Checkbox>
						))}
					</div>
				</>
			) : (
				<p className="body-sm text-tertiary">
					No {noun}s in your watchlist. Add {noun}s to your watchlist to email their metrics.
				</p>
			)}
		</FieldGroup>
	)
}

function PortfolioSelection() {
	const [open, setOpen] = useState(false)
	// Fixed when Delete opens: the delete removes the portfolio before its confirmation closes, and the confirmation
	// must not turn into the next portfolio's.
	const [deleting, setDeleting] = useState<{ portfolio: string; notifications: boolean } | null>(null)
	const newButtonRef = useRef<HTMLButtonElement>(null)
	// A cancel returns to Delete. A delete removes it with the portfolio, so the delete points this at New, since the
	// default portfolio it falls back to has no Delete.
	const deleteFinalFocusRef = useRef<HTMLElement | null>(null)

	const { portfolios, selectedPortfolio, addPortfolio, removePortfolio, setSelectedPortfolio } = useBookmarks('defi')
	const { setSelectedPortfolio: setSelectedChainPortfolio } = useBookmarks('chains')
	const { hasActiveSubscription, loaders } = useAuthContext()
	const {
		preferences: notificationPreferences,
		isLoading: isLoadingNotificationPreferences,
		readFailed: notificationPreferencesFailed,
		deletePreferences: deleteNotificationPreferences
	} = useEmailNotifications(selectedPortfolio)

	const handleSelectPortfolio = (portfolio: string) => {
		setSelectedPortfolio(portfolio)
		setSelectedChainPortfolio(portfolio)
	}

	const handleAddPortfolio = (name: string) => {
		addPortfolio(name)
		setSelectedChainPortfolio(name)
	}

	const removePortfolioNamed = (portfolio: string) => {
		removePortfolio(portfolio)
		setSelectedChainPortfolio(DEFAULT_PORTFOLIO_NAME)
	}
	// The portfolio leaves with its notifications as one accepted action, so the removal sits in the mutation's own
	// callback, which also runs once the page has unmounted.
	const deletePortfolioWithNotifications = useMutation<void, Error, { portfolioName: string }>({
		mutationFn: (variables) => deleteNotificationPreferences.mutateAsync(variables),
		onSuccess: (_data, { portfolioName }) => removePortfolioNamed(portfolioName)
	})

	// Only portfolios with saved notifications have server preferences, and the server refuses to delete them without
	// an active subscription (its email job skips those accounts too). A failed subscription read is not a lapse:
	// userLoading stays on until a read succeeds, and the server decides instead.
	const deletesNotifications = notificationPreferences != null && (hasActiveSubscription || loaders.userLoading)

	return (
		<Card padding="none">
			<TableToolbar>
				<h1 className="mr-auto heading-xs">Portfolio</h1>
				<Menu
					name={selectedPortfolio.length > 100 ? `${selectedPortfolio.substring(0, 100)}...` : selectedPortfolio}
					key={`${selectedPortfolio}-${portfolios.length}`}
					options={portfolios}
					onItemClick={(value) => handleSelectPortfolio(value)}
					className="min-w-[100px]"
				/>
				<NewPortfolioDialog open={open} setOpen={setOpen} portfolios={portfolios} onCreate={handleAddPortfolio} />
				<Button ref={newButtonRef} type="button" onClick={() => setOpen(true)} size="md">
					<Icon name="folder-plus" height={16} width={16} />
					<span>New</span>
				</Button>
				{selectedPortfolio !== DEFAULT_PORTFOLIO_NAME ? (
					<Button
						variant="destructive"
						size="md"
						type="button"
						onClick={() => {
							deleteFinalFocusRef.current = null
							setDeleting({ portfolio: selectedPortfolio, notifications: deletesNotifications })
						}}
						// A failed read is unknown, not "no notifications": deleting locally could leave their emails running.
						// The notifications card below says so and offers the retry.
						disabled={
							loaders.subscriptionInitialCheck || isLoadingNotificationPreferences || notificationPreferencesFailed
						}
					>
						<Icon name="trash-2" height={16} width={16} />
						<span>Delete</span>
					</Button>
				) : null}
			</TableToolbar>
			{/* Outside the Delete button: it leaves with the portfolio while the dialog closes. Focus then lands on New,
			    since the default portfolio has no Delete. */}
			{deleting ? (
				deleting.notifications ? (
					// Keeps the portfolio until the server delete succeeds: once it is gone, nothing in the UI can stop
					// its emails.
					<ConfirmActionDialog
						finalFocus={deleteFinalFocusRef}
						title="Delete portfolio?"
						description={`"${deleting.portfolio}", everything saved in it and its weekly email notifications are removed. This cannot be undone.`}
						confirmLabel="Delete"
						pendingLabel="Deleting…"
						mutation={deletePortfolioWithNotifications}
						variables={{ portfolioName: deleting.portfolio }}
						onClose={() => setDeleting(null)}
						onSuccess={() => {
							deleteFinalFocusRef.current = newButtonRef.current
						}}
						successMessage="Notification preferences deleted"
					/>
				) : (
					<ConfirmDialog
						open
						onClose={() => setDeleting(null)}
						finalFocus={deleteFinalFocusRef}
						title="Delete portfolio?"
						description={`"${deleting.portfolio}" and everything saved in it are removed. This cannot be undone.`}
						confirmLabel="Delete"
						error={null}
						onConfirm={() => {
							setDeleting(null)
							deleteFinalFocusRef.current = newButtonRef.current
							removePortfolioNamed(deleting.portfolio)
						}}
					/>
				)
			) : null}
		</Card>
	)
}

type TopMoversProps = {
	protocols: Array<IProtocol>
	portfolio: string
}

function TopMovers({ protocols, portfolio }: TopMoversProps) {
	const [showPositive, setShowPositive] = useState(true)
	const [showNegative, setShowNegative] = useState(true)
	const availableChains = useMemo(() => {
		const chainSet = new Set<string>()
		for (const protocol of protocols) {
			if (protocol.chains) {
				for (const chain of protocol.chains) chainSet.add(chain)
			}
		}
		return Array.from(chainSet).sort()
	}, [protocols])
	// Every chain is selected by default; the filter applies once the user narrows it, and a new portfolio starts over.
	const {
		activeSeries: selectedChains,
		selectedCharts: selectedChainsSet,
		setSelectedSeries: setSelectedChains,
		isDefaultSelection: showsAllChains
	} = useLocalSelection({ scope: portfolio, availableSeries: availableChains, allowEmptySelection: true })

	const topMovers = useMemo(() => {
		const periods = ['1d', '7d', '1m']
		const movers: Record<string, Array<{ name: string; slug?: string; change: number; chains: Array<string> }>> = {}

		for (const period of periods) {
			const changeKey = `change${period}`
			let candidates = protocols
				.filter((p) => p.tvlChange?.[changeKey] != null)
				.map((p) => ({
					name: p.name,
					slug: p.slug,
					change: p.tvlChange?.[changeKey] as number,
					chains: p.chains || []
				}))

			if (!showsAllChains) {
				candidates = candidates.filter((protocolEntry) => {
					for (const chain of protocolEntry.chains) {
						if (selectedChainsSet.has(chain)) return true
					}
					return false
				})
			}

			if (!showPositive && !showNegative) {
				candidates = []
			} else if (showPositive && !showNegative) {
				candidates = candidates.filter((p) => p.change > 0)
			} else if (!showPositive && showNegative) {
				candidates = candidates.filter((p) => p.change < 0)
			}

			candidates.sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
			movers[period] = candidates.slice(0, 3)
		}

		return movers
	}, [protocols, showPositive, showNegative, selectedChainsSet, showsAllChains])

	return (
		<Card padding="none">
			<TableToolbar>
				<h2 className="mr-auto heading-xs">Top Movers</h2>

				<label className="flex cursor-pointer items-center gap-1.5">
					<input
						type="checkbox"
						checked={showPositive}
						onChange={(e) => startTransition(() => setShowPositive(e.target.checked))}
						className="size-3.5 rounded-[4px] border border-strong accent-data-up"
					/>
					<span className="label-sm text-data-up">Positive</span>
				</label>
				<label className="flex cursor-pointer items-center gap-1.5">
					<input
						type="checkbox"
						checked={showNegative}
						onChange={(e) => startTransition(() => setShowNegative(e.target.checked))}
						className="size-3.5 rounded-[4px] border border-strong accent-data-down"
					/>
					<span className="label-sm text-data-down">Negative</span>
				</label>

				{availableChains.length > 0 ? (
					<SelectWithCombobox
						allValues={availableChains}
						selectedValues={selectedChains}
						setSelectedValues={setSelectedChains}
						label={
							showsAllChains ? 'All chains' : `${selectedChains.length} chain${selectedChains.length === 1 ? '' : 's'}`
						}
						labelType="smol"
						variant="filter"
						size="md"
					/>
				) : null}
			</TableToolbar>

			<div className="grid grid-cols-1 gap-4 p-3 pt-1 sm:grid-cols-3">
				{(['1d', '7d', '1m'] as const).map((period) => (
					<div key={period}>
						<span className="mb-1.5 block label-xs text-secondary uppercase">
							{period === '1d' ? '24 Hours' : period === '7d' ? '7 Days' : '30 Days'}
						</span>

						{topMovers[period].length > 0 ? (
							<div className="flex flex-col">
								{topMovers[period].map((mover) => (
									<div
										key={mover.name}
										className="flex items-center justify-between gap-3 border-b border-subtle py-2 last:border-b-0"
									>
										<span className="flex min-w-0 items-center gap-2">
											{mover.slug ? (
												<TokenLogo name={mover.slug} kind="token" alt={`Logo of ${mover.name}`} size={20} />
											) : (
												<TokenLogo src={undefined} alt={`Logo of ${mover.name}`} size={20} />
											)}
											{mover.slug ? (
												<BasicLink
													href={`/protocol/${mover.slug}`}
													className="truncate label-sm text-primary hover:underline"
												>
													{mover.name}
												</BasicLink>
											) : (
												<span className="truncate label-sm text-primary">{mover.name}</span>
											)}
										</span>
										<span className="shrink-0 label-sm text-secondary">
											<Change value={mover.change} />
										</span>
									</div>
								))}
							</div>
						) : (
							<p className="py-3 text-center body-sm text-tertiary">No movers</p>
						)}
					</div>
				))}
			</div>
		</Card>
	)
}
