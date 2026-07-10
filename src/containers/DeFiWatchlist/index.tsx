import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { lazy, startTransition, Suspense, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'
import { DialogForm } from '~/components/DialogForm'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { LocalLoader } from '~/components/Loaders'
import { Menu } from '~/components/Menu'
import { formatPercentChangeText } from '~/components/PercentChange'
import { SelectWithCombobox } from '~/components/Select/SelectWithCombobox'
import { TokenLogo } from '~/components/TokenLogo'
import type { IChainOverviewData } from '~/containers/ChainOverview/types'
import { useGroupAndFormatChains } from '~/containers/ChainsByCategory'
import { ChainsByCategoryTable } from '~/containers/ChainsByCategory/Table'
import { applyProtocolTvlSettings } from '~/containers/ProtocolLists/utils'
import { ChainProtocolsTable } from '~/containers/ProtocolRankings/Table'
import { useAuthContext } from '~/containers/Subscription/auth'
import { setSignupSource } from '~/containers/Subscription/signupSource'
import { WatchListTabs } from '~/containers/Yields/views/WatchlistView'
import { DEFAULT_PORTFOLIO_NAME, useLocalStorageSettingsManager } from '~/contexts/LocalStorage'
import { useBookmarks } from '~/hooks/useBookmarks'
import { useEmailNotifications, type NotificationSettings } from '~/hooks/useEmailNotifications'
import { useIsClient } from '~/hooks/useIsClient'
import { Button, buttonStyles } from '~/ui/Button'
import { Card } from '~/ui/Card'
import { DialogCloseButton, DialogHeading, dialogSurfaceStyles } from '~/ui/Dialog'
import { PanelLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { mapAPIMetricToUI, mapUIMetricToAPI } from '~/utils/notificationMetrics'
import { parseNumberQueryParam } from '~/utils/routerQuery'
import type { IChainsByCategoryData } from '../ChainsByCategory/types'
import { chainMetrics, protocolMetrics } from './constants'

const SubscribeProModal = lazy(() =>
	import('~/components/SubscribeCards/SubscribeProCard').then((m) => ({ default: m.SubscribeProModal }))
)

export function DefiWatchlistContainer({
	protocols,
	chains
}: {
	protocols: IChainOverviewData['protocols']
	chains: IChainsByCategoryData['chains']
}) {
	const [extraTvlsEnabled] = useLocalStorageSettingsManager('tvl')

	const { selectedPortfolio, savedProtocols, addProtocol, removeProtocol, isLoadingWatchlist } = useBookmarks('defi')

	const { savedProtocols: savedChains, addProtocol: addChain, removeProtocol: removeChain } = useBookmarks('chains')

	const { protocolOptions, savedProtocolsList, selectedProtocolNames } = useMemo(() => {
		return {
			protocolOptions: protocols?.map((c) => ({ key: c.name, name: c.name })) ?? [],
			savedProtocolsList:
				protocols?.filter(
					(c) => savedProtocols.has(c.name) || c.childProtocols?.some((cp) => savedProtocols.has(cp.name))
				) ?? [],
			selectedProtocolNames: Array.from(savedProtocols)
		}
	}, [protocols, savedProtocols])

	const router = useRouter()

	const minTvl = parseNumberQueryParam(router.query.minTvl)
	const maxTvl = parseNumberQueryParam(router.query.maxTvl)

	const protocolsTableData = useMemo(() => {
		return applyProtocolTvlSettings({ protocols: savedProtocolsList, extraTvlsEnabled, minTvl, maxTvl })
	}, [savedProtocolsList, extraTvlsEnabled, minTvl, maxTvl])

	const handleProtocolSelection = (selectedValues: string[]) => {
		const currentSet = new Set(selectedProtocolNames)
		const newSet = new Set(selectedValues)

		const toAdd = selectedValues.filter((name) => !currentSet.has(name))
		const toRemove = selectedProtocolNames.filter((name) => !newSet.has(name))

		for (const name of toAdd) addProtocol(name)
		for (const name of toRemove) removeProtocol(name)
	}

	const { chainOptions, savedChainsList, selectedChainNames } = useMemo(() => {
		return {
			chainOptions: chains?.map((c) => ({ key: c.name, name: c.name })) ?? [],
			savedChainsList: chains?.filter((c) => savedChains.has(c.name)) ?? [],
			selectedChainNames: Array.from(savedChains)
		}
	}, [chains, savedChains])

	const { chainsTableData } = useGroupAndFormatChains({ chains: savedChainsList, category: 'All', hideGroupBy: true })

	const handleChainSelection = (selectedValues: string[]) => {
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
				<PanelLoadingStatus>
					<LocalLoader />
				</PanelLoadingStatus>
			</>
		)
	}

	return (
		<>
			<WatchListTabs />
			<div className="flex flex-col gap-2">
				<PortfolioSelection />
				<PortfolioNotifications
					selectedPortfolio={selectedPortfolio}
					filteredProtocols={protocolsTableData as any}
					filteredChains={chainsTableData}
				/>
				{protocolsTableData.length > 0 ? <TopMovers protocols={protocolsTableData} /> : null}
				<Card padding="none">
					<div className="flex flex-wrap items-center gap-2 p-2">
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
					</div>
					{protocolsTableData.length ? (
						<ChainProtocolsTable protocols={protocolsTableData} useStickyHeader={false} borderless />
					) : (
						<SurfaceBodyStatus variant="empty" className="p-2" contentClassName="flex flex-col items-center">
							<Icon name="bookmark" height={32} width={32} className="mb-3" />
							<p className="body-sm text-tertiary">No protocols in your watchlist</p>
							<p className="mt-1 body-sm text-tertiary">Use the selector above to add protocols</p>
						</SurfaceBodyStatus>
					)}
				</Card>

				<Card padding="none">
					<div className="flex flex-wrap items-center gap-2 p-2">
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
					</div>
					{chainsTableData.length ? (
						<ChainsByCategoryTable data={chainsTableData} useStickyHeader={false} borderless showByGroup={false} />
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

const EMPTY_ARRAY: any[] = []
const smallActionButtonClassName = buttonStyles({ size: 'md' })
const portfolioActionButtonClassName = buttonStyles({ size: 'md' })
const smallToneActionButtonBaseClassName =
	'flex min-h-8 shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-3 py-1.5 label-sm disabled:cursor-not-allowed disabled:opacity-60'
const destructiveActionButtonClassName = `${smallToneActionButtonBaseClassName} border-data-down text-data-down hover:bg-hover-row focus-visible:bg-hover-row`
const positiveActionButtonClassName = `${smallToneActionButtonBaseClassName} border-data-up text-data-up hover:bg-hover-row focus-visible:bg-hover-row`
const portfolioDestructiveActionButtonClassName =
	'flex min-h-8 shrink-0 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-lg border border-data-down px-3 py-1.5 label-sm text-data-down hover:bg-hover-row focus-visible:bg-hover-row disabled:cursor-not-allowed disabled:opacity-60'

function PortfolioNotifications({
	selectedPortfolio,
	filteredProtocols = EMPTY_ARRAY,
	filteredChains = EMPTY_ARRAY
}: {
	selectedPortfolio: string
	filteredProtocols?: any[]
	filteredChains?: any[]
}) {
	const dialogStore = Ariakit.useDialogStore()
	const isClient = useIsClient()
	const { loaders, isAuthenticated, hasActiveSubscription } = useAuthContext()
	const {
		preferences,
		isLoading,
		savePreferences,
		isSaving,
		updateStatus,
		isUpdatingStatus,
		deletePreferences,
		isDeleting
	} = useEmailNotifications(selectedPortfolio)
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
			protocolMetrics: [] as string[],
			chainMetrics: [] as string[]
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

	const handleFormSubmit = async () => {
		const buildAndSavePreferences = async () => {
			const values = formStore.getState().values
			const selectedProtocolMetrics = values.protocolMetrics
			const selectedChainMetrics = values.chainMetrics

			const settings: NotificationSettings = {}

			if (selectedProtocolMetrics.length > 0 && filteredProtocols.length > 0) {
				const mappedProtocolMetrics = selectedProtocolMetrics.map(mapUIMetricToAPI)
				const protocolsMap: NotificationSettings['protocols'] = {}
				let protocolCount = 0
				for (let i = 0; i < filteredProtocols.length; i++) {
					const identifier = filteredProtocols[i].slug
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
				for (let i = 0; i < filteredChains.length; i++) {
					if (!filteredChains[i].name) continue
					chainsMap[filteredChains[i].name] = mappedChainMetrics
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

			await savePreferences({
				portfolioName: selectedPortfolio,
				settings,
				frequency: 'weekly'
			})

			dialogStore.hide()
		}
		await buildAndSavePreferences().catch(() => {
			// Error toast handled by mutation's onError
		})
	}

	const handleDisableNotifications = () => {
		void updateStatus({ portfolioName: selectedPortfolio, active: false }).then(() => {
			dialogStore.hide()
		})
	}

	const handleDeleteNotifications = () => {
		void deletePreferences({ portfolioName: selectedPortfolio }).then(() => {
			dialogStore.hide()
		})
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
									onClick={handleDisableNotifications}
									disabled={loaders.userLoading || isUpdatingStatus}
									className={smallActionButtonClassName}
									title="Temporarily disable notifications"
								>
									<Icon name="pause" height={16} width={16} />
									<span>{isUpdatingStatus ? 'Disabling...' : 'Disable'}</span>
								</button>
							) : null}
							{!preferences.active ? (
								<button
									onClick={() => {
										void updateStatus({ portfolioName: selectedPortfolio, active: true })
									}}
									disabled={loaders.userLoading || isUpdatingStatus}
									className={positiveActionButtonClassName}
									title="Re-enable notifications"
								>
									<Icon name="check-circle" height={16} width={16} />
									<span>{isUpdatingStatus ? 'Enabling...' : 'Enable'}</span>
								</button>
							) : null}
							<button
								onClick={handleDeleteNotifications}
								disabled={loaders.userLoading || isDeleting}
								className={destructiveActionButtonClassName}
								title="Permanently delete notification preferences"
							>
								<Icon name="trash-2" height={16} width={16} />
								<span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
							</button>
						</>
					) : null}
				</div>
			</Card>
			{shouldRenderModal ? (
				<Suspense fallback={<></>}>
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
					<DialogCloseButton className="-mr-1 ml-auto" />
				</div>

				<Ariakit.Form
					store={formStore}
					onSubmit={(e) => {
						e.preventDefault()
						void handleFormSubmit()
					}}
					className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
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
											disabled={isUpdatingStatus}
											className={smallActionButtonClassName}
										>
											<Icon name="pause" height={16} width={16} />
											<span>{isUpdatingStatus ? 'Disabling...' : 'Disable'}</span>
										</button>
									) : null}
									<button
										type="button"
										onClick={handleDeleteNotifications}
										disabled={isDeleting}
										className={destructiveActionButtonClassName}
									>
										<Icon name="trash-2" height={16} width={16} />
										<span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
									</button>
								</>
							) : (
								<div className="body-sm text-secondary">Configure notification settings for your portfolio</div>
							)}
						</div>
						<div className="flex gap-2">
							<Ariakit.DialogDismiss render={<Button type="button" size="md" />}>Cancel</Ariakit.DialogDismiss>
							<Ariakit.FormSubmit disabled={isSaving} render={<Button type="submit" variant="primary" size="md" />}>
								{isSaving ? 'Saving...' : preferences ? 'Update Settings' : 'Enable Notifications'}
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
		deleteNotificationPreferences({ portfolioName: selectedPortfolio })
			.catch(() => {})
			.finally(() => {
				removePortfolio(selectedPortfolio)
				setSelectedChainPortfolio(DEFAULT_PORTFOLIO_NAME)
			})
	}

	return (
		<Card padding="none">
			<div className="flex flex-wrap items-center gap-2 p-2">
				<h1 className="mr-auto heading-xs">Portfolio</h1>
				<Menu
					name={selectedPortfolio.length > 100 ? selectedPortfolio.substring(0, 100) + '...' : selectedPortfolio}
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
			</div>
		</Card>
	)
}

type TopMoversProps = {
	protocols: IChainOverviewData['protocols']
}

function TopMovers({ protocols }: TopMoversProps) {
	const [showPositive, setShowPositive] = useState(true)
	const [showNegative, setShowNegative] = useState(true)
	const [selectedChains, setSelectedChains] = useState<string[]>([])
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
		const movers: Record<string, Array<{ name: string; slug?: string; change: number; chains: string[] }>> = {}

		for (const period of periods) {
			const changeKey = `change${period}`
			let candidates = protocols
				.filter((p) => p.tvlChange?.[changeKey] != null && p.tvlChange[changeKey] != null)
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
			<div className="flex flex-wrap items-center gap-2 p-2">
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
			</div>

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
