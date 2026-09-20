import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import { fetchCoinPrices } from '~/api/pricing'
import { applyLogoFallback } from '~/components/TokenLogo/applyLogoFallback'
import { TokenSearchDialog } from '~/containers/TokenSearch/TokenSearchDialog'
import { buttonStyles } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { searchFieldIconStyles, searchFieldInputStyles } from '~/ui/Input'
import { menuSurfaceStyles, popoverRowWithBorderStyles, popoverMobileWrapperClassName } from '~/ui/Popover'
import { LoadingIndicator } from '~/ui/Status'
import { geckoTokenIconUrl } from '~/utils/icons'
import { formatRatio, formatUsd } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import { computeComparison } from './comparison'
import type { CompareTokenProtocol } from './types'

const EMPTY_SELECTED_COINS: Record<string, IResponseCGTokenRankingsDatasetItem> = {}

type CompareType = { label: string; value: string }

const compareTypes: Array<CompareType> = [
	{ label: 'Mcap', value: 'mcap' },
	{ label: 'FDV', value: 'fdv' },
	{ label: 'TVL', value: 'tvl' },
	{ label: 'Volume', value: 'volume' },
	{ label: 'Revenue', value: 'revenue' },
	{ label: 'Fees', value: 'fees' }
]

export function CompareTokens({
	coinsData,
	protocols
}: {
	coinsData: Array<IResponseCGTokenRankingsDatasetItem>
	protocols: Array<CompareTokenProtocol>
}) {
	const router = useRouter()
	const [isModalOpen, setIsModalOpen] = useState(0)
	const coinParam = router.query?.coin
	const typeParam = router.query?.type

	const coinsDataById = useMemo(
		() => new Map<string, IResponseCGTokenRankingsDatasetItem>(coinsData.map((c) => [c.id, c])),
		[coinsData]
	)
	const { protocolsByGeckoId, protocolsByName } = useMemo(() => {
		const protocolsByGeckoId = new Map<string, CompareTokenProtocol>()
		const protocolsByName = new Map<string, CompareTokenProtocol>()
		for (const protocol of protocols) {
			if (protocol.geckoId) protocolsByGeckoId.set(protocol.geckoId, protocol)
			protocolsByName.set(protocol.name, protocol)
		}
		return { protocolsByGeckoId, protocolsByName }
	}, [protocols])

	const { selectedCoins, coins, compareType } = useMemo(() => {
		const queryCoins = coinParam ?? []

		const coins = Array.isArray(queryCoins) ? queryCoins : [queryCoins]

		const compareType = compareTypes.find((type) => type.value === (typeParam ?? 'fdv')) ?? {
			label: 'FDV',
			value: 'fdv'
		}
		return {
			selectedCoins: coins.map((coin) => coinsDataById.get(coin)),
			coins,
			compareType
		}
	}, [coinParam, typeParam, coinsDataById])

	const { data: priceData = null } = useQuery({
		queryKey: ['compare-tokens', 'prices', ...coins],
		queryFn: coins.length === 2 ? () => fetchCoinPrices(coins.map((c) => `coingecko:${c}`)) : () => null,
		staleTime: 60 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 0
	})

	const comparison = useMemo(() => {
		if (priceData == null || coins.length !== 2) return null
		const coinPrices: [number, number] = [
			priceData[`coingecko:${coins[0]}`]?.price ?? NaN,
			priceData[`coingecko:${coins[1]}`]?.price ?? NaN
		]
		return computeComparison(compareType, selectedCoins, coinPrices, protocolsByGeckoId, protocolsByName)
	}, [priceData, coins, compareType, selectedCoins, protocolsByGeckoId, protocolsByName])

	const dialogStore = Ariakit.useDialogStore()

	return (
		<>
			<h1 className="relative mx-auto mt-2 w-full max-w-sm text-center heading-sm lg:-left-[116px]">Compare Tokens</h1>
			<div className="relative mx-auto flex w-full max-w-sm flex-col items-center gap-2 lg:-left-[116px]">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center">
					<div className="relative w-full sm:max-w-[280px]">
						{selectedCoins[0] != null ? (
							<img
								alt=""
								src={geckoTokenIconUrl(selectedCoins[0].id)}
								height={16}
								width={16}
								loading="lazy"
								onError={(e) => applyLogoFallback(e.currentTarget)}
								className="absolute top-0 bottom-0 left-3 my-auto inline-block aspect-square shrink-0 rounded-full bg-surface-elevated-2 object-cover"
							/>
						) : (
							<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						)}
						<input
							value={selectedCoins[0]?.name ?? ''}
							onClick={() => {
								setIsModalOpen(1)
								dialogStore.toggle()
							}}
							readOnly
							placeholder="Search coins..."
							className={searchFieldInputStyles}
						/>
					</div>
					<button
						type="button"
						onClick={() => {
							const [base, quote] = coins
							if (base !== undefined && quote !== undefined) {
								void pushShallowQuery(router, { coin: [quote, base] })
							}
						}}
						className="flex shrink-0 items-center justify-center p-1"
					>
						<Icon name="repeat" height={16} width={16} />
						<span className="sr-only">Switch tokens</span>
					</button>
					<div className="relative w-full sm:max-w-[280px]">
						{selectedCoins[1] != null ? (
							<img
								alt=""
								src={geckoTokenIconUrl(selectedCoins[1].id)}
								height={16}
								width={16}
								loading="lazy"
								onError={(e) => applyLogoFallback(e.currentTarget)}
								className="absolute top-0 bottom-0 left-3 my-auto inline-block aspect-square shrink-0 rounded-full bg-surface-elevated-2 object-cover"
							/>
						) : (
							<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						)}
						<input
							value={selectedCoins[1]?.name ?? ''}
							onClick={() => {
								setIsModalOpen(2)
								dialogStore.toggle()
							}}
							readOnly
							placeholder="Search coins..."
							className={searchFieldInputStyles}
						/>
					</div>
				</div>
				<Ariakit.MenuProvider>
					<Ariakit.MenuButton className={`${buttonStyles({ size: 'md' })} w-full justify-between`}>
						<span>{compareType.label}</span>
						<Ariakit.MenuButtonArrow />
					</Ariakit.MenuButton>
					<Ariakit.Menu
						unmountOnHide
						hideOnInteractOutside
						sameWidth
						wrapperProps={{ className: popoverMobileWrapperClassName }}
						className={menuSurfaceStyles}
						portal
					>
						{compareTypes.map((item) => (
							<Ariakit.MenuItem
								key={item.value}
								onClick={() => {
									void pushShallowQuery(router, { type: item.value })
								}}
								className={popoverRowWithBorderStyles}
							>
								{item.label}
							</Ariakit.MenuItem>
						))}
					</Ariakit.Menu>
				</Ariakit.MenuProvider>
				{coins.length === 2 ? (
					priceData == null ? (
						<div role="status" aria-live="polite" className="m-auto flex min-h-[360px] items-center justify-center">
							<LoadingIndicator />
							<span className="sr-only">Loading token comparison</span>
						</div>
					) : (
						<div className="mt-10 flex flex-col items-center gap-2">
							<h2 className="flex flex-wrap items-center justify-center gap-1 text-base font-normal">
								<span className="flex items-center gap-1">
									<img
										alt=""
										src={selectedCoins[0] ? geckoTokenIconUrl(selectedCoins[0].id) : undefined}
										height="20px"
										width="20px"
										loading="lazy"
										onError={(e) => applyLogoFallback(e.currentTarget)}
										className="inline-block aspect-square shrink-0 rounded-full bg-surface-elevated-2 object-cover"
									/>
									<span>{selectedCoins[0]?.symbol?.toUpperCase()}</span>
								</span>
								<span>WITH THE {compareType.label.toUpperCase()} OF</span>
								<span className="flex items-center gap-1">
									<img
										alt=""
										src={selectedCoins[1] ? geckoTokenIconUrl(selectedCoins[1].id) : undefined}
										height="20px"
										width="20px"
										loading="lazy"
										onError={(e) => applyLogoFallback(e.currentTarget)}
										className="inline-block aspect-square shrink-0 rounded-full bg-surface-elevated-2 object-cover"
									/>
									<span>{selectedCoins[1]?.symbol?.toUpperCase()}</span>
								</span>
							</h2>

							{comparison != null ? (
								<p className="text-lg font-bold">
									{formatUsd(comparison.newPrice)} ({formatRatio(comparison.increase)}x)
								</p>
							) : null}
						</div>
					)
				) : null}

				<TokenSearchDialog
					coinsData={coinsData}
					dialogStore={dialogStore}
					selectedTokens={EMPTY_SELECTED_COINS}
					selectToken={(coin) => {
						const newCoins = coins.slice()
						newCoins[isModalOpen - 1] = coin.id
						void pushShallowQuery(router, { coin: newCoins })
						setIsModalOpen(0)
						dialogStore.toggle()
					}}
				/>
			</div>
		</>
	)
}
