import * as Ariakit from '@ariakit/react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { lazy, startTransition, Suspense, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { setSignupSource } from '~/auth/signupSource'
import { DialogForm } from '~/components/DialogForm'
import { BasicLink } from '~/components/Link'
import { Menu } from '~/components/Menu'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TokenLogo } from '~/components/TokenLogo'
import { useGroupAndFormatChains } from '~/containers/ChainsByCategory'
import { ChainsByCategoryTable } from '~/containers/ChainsByCategory/Table'
import { applyProtocolTvlSettings } from '~/containers/ProtocolLists/utils'
import { ChainProtocolsTable } from '~/containers/ProtocolRankings/Table'
import type { IProtocol } from '~/containers/ProtocolRankings/types'
import { WatchListTabs } from '~/containers/Yields/views/WatchlistView'
import { DEFAULT_PORTFOLIO_NAME, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useBookmarks } from '~/hooks/useBookmarks'
import { useEmailNotifications, type NotificationSettings } from '~/hooks/useEmailNotifications'
import { useIsClient } from '~/hooks/useIsClient'
import { Button, buttonStyles } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { formatPercentChangeText } from '~/ui/PercentChange'
import { PanelLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { TableToolbar } from '~/ui/Toolbar'
import { mapAPIMetricToUI, mapUIMetricToAPI } from '~/utils/notificationMetrics'
import { parseNumberQueryParam } from '~/utils/routerQuery'
import type { IChainsByCategoryData } from '../ChainsByCategory/types'
import { chainMetrics, protocolMetrics } from './constants'

const SubscribeProModal = lazy(() =>
	import('~/containers/Subscription/shared/SubscribeCards/SubscribeProCard').then((m) => ({
		default: m.SubscribeProModal
	}))
)

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

	const { protocolOptions, selectedProtocolNames, watchedNames } = useMemo(() => {
		const selected = Array.from(savedProtocols)
		return {
			protocolOptions: protocolNames.map((name) => ({ key: name, name })),
			selectedProtocolNames: selected,
			// Stable query key: the same saved set always resolves to the same request.
			watchedNames: [...selected].sort()
		}
	}, [protocolNames, savedProtocols])

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

	const { chainOptions, selectedChainNames, watchedChainNames } = useMemo(() => {
		const selected = Array.from(savedChains)
		return {
			chainOptions: chainNames.map((name) => ({ key: name, name })),
			selectedChainNames: selected,
			watchedChainNames: [...selected].sort()
		}
	}, [chainNames, savedChains])

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

	const { chainsTableData } = useGroupAndFormatChains({ chains: savedChainsList, category: 'All', hideGroupBy: true })

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
				{protocolsTableData.length > 0 ? <TopMovers protocols={protocolsTableData} /> : null}
				<Card padding="none">
					<TableToolbar>
						<div className="mr-auto">
							<h2 className="heading-xs">Protocols</h2>
							<p className="body-xs text-secondary">
								Select or deselect protocols for the "{selectedPortfolio}" portfolio
							</p>
						</div>
						<SelectWithCombobox
							allValues={protocolOptions}
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
						<SurfaceBodyStatus variant="empty" className="p-2" contentClassName="flex flex-col items-center">
							<Icon name="bookmark" height={32} width={32} className="mb-3" />
							<p className="body-sm text-tertiary">No protocols in your watchlist</p>
							<p className="mt-1 body-sm text-tertiary">Use the selector above to add protocols</p>
						</SurfaceBodyStatus>
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
							allValues={chainOptions}
							selectedValues={selectedChainNames}
							setSelectedValues={handleChainSelection}
							label={selectedChainNames.length > 0 ? 'Chains' : 'Add chains'}
							labelType="smol"
							variant="filter"
							size="md"
						/>
					</TableToolbar>
					{chainsTableData.length > 0 ? (
						<ChainsByCategoryTable data={chainsTableData} useStickyHeader={false} borderless showByGroup={false} />
					) : isLoadingChainRows && watchedChainNames.length > 0 ? (
						<PanelLoadingStatus />
					) : (
						<SurfaceBodyStatus variant="empty" className="p-2" contentClassName="flex flex-col items-center">
							<Icon name="map" height={32} width={32} className="mb-3" />
							<p className="body-sm text-tertiary">No chains in your watchlist</p>
							<p className="mt-1 body-sm text-tertiary">Use the selector above to add chains</p>
						</SurfaceBodyStatus>
					)}
				</Card>
			</div>
		</>
	)
}

const EMPTY_ARRAY: Array<any> = []
const smallActionButtonClassName = buttonStyles({ size: 'md' })
const portfolioActionButtonClassName = buttonStyles({ size: 'md' })
const smallToneActionButtonBaseClassName =
	'flex min-h-8 shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-3 py-1.5 label-sm disabled:cursor-not-allowed disabled:opacity-60'
const destructiveActionButtonClassName = `${smallToneActionButtonBaseClassName} border-data-down text-data-down hover:bg-hover-row focus-visible:bg-hover-row`
const positiveActionButtonClassName = `${smallToneActionButtonBaseClassName} border-data-up text-data-up hover:bg-hover-row focus-visible:bg-hover-row`
const portfolioDestructiveActionButtonClassName =
	'flex min-h-8 shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-data-down px-3 py-1.5 label-sm text-data-down hover:bg-hover-row focus-visible:bg-hover-row disabled:cursor-not-allowed disabled:opacity-60'

export function PortfolioNotifications({
	selectedPortfolio,
	filteredProtocols = EMPTY_ARRAY,
	filteredChains = EMPTY_ARRAY
}: {
	selectedPortfolio: string
	filteredProtocols?: Array<any>
	filteredChains?: Array<any>
}) {
	const dialogStore = Ariakit.useDialogStore()
	const isClient = useIsClient()
	const { loaders, isAuthenticated, hasActiveSubscription } = useAuthContext()
	const { preferences, isLoading, savePreferences, updateStatus, deletePreferences } =
		useEmailNotifications(selectedPortfolio)
	const isChangingPreferences = savePreferences.isPending || updateStatus.isPending || deletePreferences.isPending
	const [shouldRenderModal, setShouldRenderModal] = useState(false)
	const subscribeModalStore = Ariakit.useDialogStore({ open: shouldRenderModal, setOpen: setShouldRenderModal })

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

	const formStore = Ariakit.useFormStore({
		defaultValues: {
			protocolMetrics: [] as Array<string>,
			chainMetrics: [] as Array<string>
		}
	})

	const handleNotificationsButtonClick = () => {
		if (!isClient || loaders.userLoading) return

		if (filteredProtocols.length === 0 && filteredChains.length === 0) {
			toast.error('Please add protocols or chains to your watchlist first')
			return
		}

		if (!isAuthenticated || !hasActiveSubscription) {
			setSignupSource('watchlist')
			subscribeModalStore.show()
		} else {
			dialogStore.toggle()

			if (preferences?.settings) {
				// Load protocol metrics
				if (preferences.settings.protocols) {
					const allProtocolEntries = Object.entries(preferences.settings.protocols)
					if (allProtocolEntries.length > 0) {
						const [_protocolId, firstMetrics] = allProtocolEntries[0]

						if (Array.isArray(firstMetrics)) {
							const uiMetrics = firstMetrics.map(mapAPIMetricToUI)
							formStore.setValue('protocolMetrics', uiMetrics)
						}
					}
				} else {
					formStore.setValue('protocolMetrics', [])
				}

				// Load chain metrics
				if (preferences.settings.chains) {
					const allChainEntries = Object.entries(preferences.settings.chains)
					if (allChainEntries.length > 0) {
						const [_chainName, firstMetrics] = allChainEntries[0]

						if (Array.isArray(firstMetrics)) {
							const uiMetrics = firstMetrics.map(mapAPIMetricToUI)
							formStore.setValue('chainMetrics', uiMetrics)
						}
					}
				} else {
					formStore.setValue('chainMetrics', [])
				}
			} else {
				formStore.setValue('protocolMetrics', [])
				formStore.setValue('chainMetrics', [])
			}
		}
	}

	const handleFormSubmit = () => {
		if (isChangingPreferences) return
		const values = formStore.getState().values
		const selectedProtocolMetrics = values.protocolMetrics
		const selectedChainMetrics = values.chainMetrics

		const settings: NotificationSettings = {}

		if (selectedProtocolMetrics.length > 0 && filteredProtocols.length > 0) {
			const mappedProtocolMetrics = selectedProtocolMetrics.map(mapUIMetricToAPI)
			const protocolsMap: NotificationSettings['protocols'] = {}
			let protocolCount = 0
			for (const protocol of filteredProtocols) {
				const identifier = protocol.slug
				if (!identifier) continue
				protocolsMap[identifier] = mappedProtocolMetrics
				protocolCount++
			}
			if (protocolCount > 0) {
				settings.protocols = protocolsMap
			}
		}

		if (selectedChainMetrics.length > 0 && filteredChains.length > 0) {
			const mappedChainMetrics = selectedChainMetrics.map(mapUIMetricToAPI)
			const chainsMap: NotificationSettings['chains'] = {}
			let chainCount = 0
			for (const chain of filteredChains) {
				if (!chain.name) continue
				chainsMap[chain.name] = mappedChainMetrics
				chainCount++
			}
			if (chainCount > 0) {
				settings.chains = chainsMap
			}
		}

		const hasProtocols = settings.protocols != null
		const hasChains = settings.chains != null
		if (!hasProtocols && !hasChains) {
			toast.error('Unable to save: no valid settings configured')
			return
		}

		savePreferences.mutate(
			{
				portfolioName: selectedPortfolio,
				settings,
				frequency: 'weekly'
			},
			{ onSuccess: () => dialogStore.hide() }
		)
	}

	const handleDisableNotifications = () => {
		if (isChangingPreferences) return
		updateStatus.mutate({ portfolioName: selectedPortfolio, active: false }, { onSuccess: () => dialogStore.hide() })
	}

	const handleDeleteNotifications = () => {
		if (isChangingPreferences) return
		deletePreferences.mutate({ portfolioName: selectedPortfolio }, { onSuccess: () => dialogStore.hide() })
	}

	return (
		<Ariakit.DialogProvider store={dialogStore}>
			<Card padding="sm">
				<div className="mb-2">
					<h2 className="mb-0.5 heading-xs">Email Notifications</h2>
					<p className="body-sm text-secondary">
						{preferences ? (
							preferences.active ? (
								<span className="flex items-center gap-2">
									<Icon name="check-circle" height={14} width={14} className="text-data-up" />
									<span>
										Weekly email notifications are <strong className="text-data-up">active</strong> for "
										{selectedPortfolio}" portfolio
									</span>
								</span>
							) : (
								<span className="flex items-center gap-2">
									<Icon name="pause" height={14} width={14} className="text-secondary" />
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
				</div>

				{preferences?.settings ? (
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

				<div className="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onClick={handleNotificationsButtonClick}
						disabled={loaders.userLoading || isLoading}
						className={smallActionButtonClassName}
					>
						<Icon name="mail" height={16} width={16} />
						<span>{preferences ? 'Update settings' : 'Set up notifications'}</span>
					</button>

					{preferences ? (
						<>
							{preferences.active ? (
								<button
									type="button"
									onClick={handleDisableNotifications}
									disabled={loaders.userLoading || isChangingPreferences}
									className={smallActionButtonClassName}
									title="Temporarily disable notifications"
								>
									<Icon name="pause" height={16} width={16} />
									<span>{updateStatus.isPending ? 'Disabling...' : 'Disable'}</span>
								</button>
							) : null}
							{!preferences.active ? (
								<button
									type="button"
									onClick={() => {
										updateStatus.mutate({ portfolioName: selectedPortfolio, active: true })
									}}
									disabled={loaders.userLoading || isChangingPreferences}
									className={positiveActionButtonClassName}
									title="Re-enable notifications"
								>
									<Icon name="check-circle" height={16} width={16} />
									<span>{updateStatus.isPending ? 'Enabling...' : 'Enable'}</span>
								</button>
							) : null}
							<button
								type="button"
								onClick={handleDeleteNotifications}
								disabled={loaders.userLoading || isChangingPreferences}
								className={destructiveActionButtonClassName}
								title="Permanently delete notification preferences"
							>
								<Icon name="trash-2" height={16} width={16} />
								<span>{deletePreferences.isPending ? 'Deleting...' : 'Delete'}</span>
							</button>
						</>
					) : null}
				</div>
			</Card>
			{shouldRenderModal ? (
				<Suspense fallback={null}>
					<SubscribeProModal dialogStore={subscribeModalStore} />
				</Suspense>
			) : null}

			<Ariakit.Dialog
				store={dialogStore}
				className={`${dialogSurfaceStyles} [--dialog-width:672px]`}
				unmountOnHide
				portal
			>
				<div className="flex items-start gap-3 border-b border-subtle px-4 py-3">
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<DialogHeading>Email Notification Settings</DialogHeading>
							{preferences ? (
								preferences.active ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated-2 px-2 py-0.5 label-xs text-data-up">
										<Icon name="check" height={12} width={12} />
										Active
									</span>
								) : (
									<span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated-2 px-2 py-0.5 label-xs text-secondary">
										<Icon name="pause" height={12} width={12} />
										Disabled
									</span>
								)
							) : null}
						</div>
						<p className="mt-1 body-sm text-secondary">
							Configure weekly email alerts for "{selectedPortfolio}" portfolio
						</p>
					</div>
					<DialogCloseButton className="ml-auto" />
				</div>

				<Ariakit.Form
					store={formStore}
					onSubmit={(e) => {
						e.preventDefault()
						handleFormSubmit()
					}}
					className="min-h-0 flex-auto overflow-y-auto overscroll-contain"
				>
					<div className="border-b border-subtle px-4 py-3">
						<h3 className="mb-2 label-md text-primary">Protocol Metrics</h3>
						{filteredProtocols.length > 0 ? (
							<>
								<p className="mb-3 body-sm text-secondary">
									Select which metrics you want to receive notifications for your {filteredProtocols.length} watchlisted
									protocol{filteredProtocols.length === 1 ? '' : 's'}.
								</p>
								<div className="flex max-h-60 flex-wrap gap-3 overflow-y-auto">
									{protocolMetrics.map((metric) => (
										<label key={metric.key} className="flex cursor-pointer items-center gap-2">
											<Ariakit.FormCheckbox
												name="protocolMetrics"
												value={metric.key}
												className="size-3.5 rounded-[4px] border border-strong accent-brand"
											/>
											<span className="body-sm text-primary">{metric.name}</span>
										</label>
									))}
								</div>
							</>
						) : (
							<div className="py-6 text-center">
								<Icon name="bookmark" height={24} width={24} className="mx-auto mb-2 text-tertiary" />
								<p className="body-sm text-tertiary">No protocols in your watchlist</p>
								<p className="mt-1 body-sm text-tertiary">Add protocols to your watchlist to set up notifications</p>
							</div>
						)}
					</div>

					<div className="px-4 py-3">
						<h3 className="mb-2 label-md text-primary">Chain Metrics</h3>
						{filteredChains.length > 0 ? (
							<>
								<p className="mb-3 body-sm text-secondary">
									Select which metrics you want to receive notifications for your {filteredChains.length} watchlisted
									chain{filteredChains.length === 1 ? '' : 's'}.
								</p>
								<div className="flex max-h-60 flex-wrap gap-3 overflow-y-auto">
									{chainMetrics.map((metric) => (
										<label key={metric.key} className="flex cursor-pointer items-center gap-2">
											<Ariakit.FormCheckbox
												name="chainMetrics"
												value={metric.key}
												className="size-3.5 rounded-[4px] border border-strong accent-brand"
											/>
											<span className="body-sm text-primary">{metric.name}</span>
										</label>
									))}
								</div>
							</>
						) : (
							<div className="py-6 text-center">
								<Icon name="map" height={24} width={24} className="mx-auto mb-2 text-tertiary" />
								<p className="body-sm text-tertiary">No chains in your watchlist</p>
								<p className="mt-1 body-sm text-tertiary">Add chains to your watchlist to set up notifications</p>
							</div>
						)}
					</div>

					<div className="flex flex-wrap items-center justify-between gap-2 border-t border-subtle bg-overlay px-4 py-3">
						<div className="flex items-center gap-2">
							{preferences ? (
								<>
									{preferences.active ? (
										<button
											type="button"
											onClick={handleDisableNotifications}
											disabled={isChangingPreferences}
											className={smallActionButtonClassName}
										>
											<Icon name="pause" height={16} width={16} />
											<span>{updateStatus.isPending ? 'Disabling...' : 'Disable'}</span>
										</button>
									) : null}
									<button
										type="button"
										onClick={handleDeleteNotifications}
										disabled={isChangingPreferences}
										className={destructiveActionButtonClassName}
									>
										<Icon name="trash-2" height={16} width={16} />
										<span>{deletePreferences.isPending ? 'Deleting...' : 'Delete'}</span>
									</button>
								</>
							) : (
								<div className="body-sm text-secondary">Configure notification settings for your portfolio</div>
							)}
						</div>
						<div className="flex gap-2">
							<Ariakit.DialogDismiss render={<Button type="button" size="md" />}>Cancel</Ariakit.DialogDismiss>
							<Ariakit.FormSubmit
								disabled={isChangingPreferences}
								render={<Button type="submit" variant="primary" size="md" />}
							>
								{savePreferences.isPending ? 'Saving...' : preferences ? 'Update Settings' : 'Enable Notifications'}
							</Ariakit.FormSubmit>
						</div>
					</div>
				</Ariakit.Form>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}

function PortfolioSelection() {
	const [open, setOpen] = useState(false)

	const { portfolios, selectedPortfolio, addPortfolio, removePortfolio, setSelectedPortfolio } = useBookmarks('defi')
	const { setSelectedPortfolio: setSelectedChainPortfolio } = useBookmarks('chains')
	const { deletePreferences: deleteNotificationPreferences } = useEmailNotifications(null)

	const handleSelectPortfolio = (portfolio: string) => {
		setSelectedPortfolio(portfolio)
		setSelectedChainPortfolio(portfolio)
	}

	const handleAddPortfolio = (name: string) => {
		addPortfolio(name)
		setSelectedChainPortfolio(name)
	}

	const handleRemovePortfolio = () => {
		deleteNotificationPreferences
			.mutateAsync({ portfolioName: selectedPortfolio })
			.catch(() => {})
			.finally(() => {
				removePortfolio(selectedPortfolio)
				setSelectedChainPortfolio(DEFAULT_PORTFOLIO_NAME)
			})
	}

	return (
		<Card padding="none">
			<TableToolbar>
				<h1 className="mr-auto heading-xs">Portfolio</h1>
				<Menu
					name={selectedPortfolio.length > 100 ? `${selectedPortfolio.substring(0, 100)}...` : selectedPortfolio}
					key={`${selectedPortfolio}-${portfolios.length}`}
					options={portfolios}
					onItemClick={(value) => handleSelectPortfolio(value)}
					className={`${portfolioActionButtonClassName} min-w-[100px] justify-between`}
				/>
				<DialogForm
					title="New Portfolio"
					description="Enter the name of your new portfolio"
					open={open}
					setOpen={setOpen}
					onSubmit={handleAddPortfolio}
				/>
				<Button type="button" onClick={() => setOpen(true)} size="md" title="Create new portfolio">
					<Icon name="folder-plus" height={16} width={16} />
					<span>New</span>
				</Button>
				{selectedPortfolio !== DEFAULT_PORTFOLIO_NAME ? (
					<button
						type="button"
						onClick={handleRemovePortfolio}
						className={portfolioDestructiveActionButtonClassName}
						title="Delete current portfolio"
					>
						<Icon name="trash-2" height={16} width={16} />
						<span>Delete</span>
					</button>
				) : null}
			</TableToolbar>
		</Card>
	)
}

type TopMoversProps = {
	protocols: Array<IProtocol>
}

function TopMovers({ protocols }: TopMoversProps) {
	const [showPositive, setShowPositive] = useState(true)
	const [showNegative, setShowNegative] = useState(true)
	const [selectedChains, setSelectedChains] = useState<Array<string>>([])
	const selectedChainsSet = useMemo(() => new Set(selectedChains), [selectedChains])

	const availableChains = useMemo(() => {
		const chainSet = new Set<string>()
		for (const protocol of protocols) {
			if (protocol.chains) {
				for (const chain of protocol.chains) chainSet.add(chain)
			}
		}
		return Array.from(chainSet).sort()
	}, [protocols])

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

			if (selectedChainsSet.size > 0) {
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
	}, [protocols, showPositive, showNegative, selectedChainsSet])

	const chainOptions = useMemo(() => {
		return availableChains.map((chain) => ({
			key: chain,
			name: chain
		}))
	}, [availableChains])

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
						allValues={chainOptions}
						selectedValues={selectedChains}
						setSelectedValues={setSelectedChains}
						label={
							selectedChains.length > 0
								? `${selectedChains.length} chain${selectedChains.length === 1 ? '' : 's'}`
								: 'All chains'
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
										<span
											className={`shrink-0 label-sm ${
												mover.change > 0 ? 'text-data-up' : mover.change < 0 ? 'text-data-down' : 'text-secondary'
											}`}
										>
											{formatPercentChangeText(mover.change)}
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
