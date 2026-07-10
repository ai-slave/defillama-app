import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import type { IResponseCGMarketsAPI } from '~/api/coingecko.types'
import { fetchCoinPrices } from '~/api/pricing'
import { Icon } from '~/components/Icon'
import { LocalLoader } from '~/components/Loaders'
import { TokenSearchDialog } from '~/containers/TokenSearch/TokenSearchDialog'
import { buttonStyles } from '~/ui/Button'
import { searchFieldIconStyles, searchFieldInputStyles } from '~/ui/Input'
import {
	menuSurfaceStyles,
	popoverRowWithBorderStyles,
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName
} from '~/ui/Popover'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { CompareTokenProtocol } from './types'

const EMPTY_SELECTED_COINS: Record<string, IResponseCGMarketsAPI> = {}

type CompareType = { label: string; value: string }

const compareTypes: CompareType[] = [
	{ label: 'Mcap', value: 'mcap' },
	{ label: 'FDV', value: 'fdv' },
	{ label: 'TVL', value: 'tvl' },
	{ label: 'Volume', value: 'volume' },
	{ label: 'Revenue', value: 'revenue' },
	{ label: 'Fees', value: 'fees' }
]

function getTokenFdvSupply(coin: IResponseCGMarketsAPI): number | null {
	const supply = coin.max_supply ?? coin.total_supply
	return supply != null && Number.isFinite(supply) ? supply : null
}

function getCompareValues(
	type: string,
	coin0: IResponseCGMarketsAPI,
	coin1: IResponseCGMarketsAPI,
	protocolsByGeckoId: Map<string, CompareTokenProtocol>,
	protocolsByName: Map<string, CompareTokenProtocol>
): [number | null, number | null] {
	const p0 = protocolsByGeckoId.get(coin0.id) ?? protocolsByName.get(coin0.name)
	const p1 = protocolsByGeckoId.get(coin1.id) ?? protocolsByName.get(coin1.name)

	switch (type) {
		case 'mcap':
			return [coin0.market_cap ?? null, coin1.market_cap ?? null]
		case 'fdv': {
			return [getTokenFdvSupply(coin0), getTokenFdvSupply(coin1)]
		}
		case 'volume':
			return [coin0.total_volume ?? null, coin1.total_volume ?? null]
		case 'tvl':
			return [p0?.tvl ?? null, p1?.tvl ?? null]
		case 'fees':
			return [p0?.fees ?? null, p1?.fees ?? null]
		case 'revenue':
			return [p0?.revenue ?? null, p1?.revenue ?? null]
		default:
			return [null, null]
	}
}

function computeComparison(
	compareType: CompareType,
	selectedCoins: Array<IResponseCGMarketsAPI | undefined>,
	coinPrices: number[],
	protocolsByGeckoId: Map<string, CompareTokenProtocol>,
	protocolsByName: Map<string, CompareTokenProtocol>
): { newPrice: number; increase: number } | null {
	const coin0 = selectedCoins[0]
	const coin1 = selectedCoins[1]
	if (!coin0 || !coin1) return null

	const [val0, val1] = getCompareValues(compareType.value, coin0, coin1, protocolsByGeckoId, protocolsByName)
	if (val0 == null || val1 == null || !Number.isFinite(val0) || !Number.isFinite(val1) || val0 === 0) return null

	const basePrice = coinPrices[0]
	const quotePrice = coinPrices[1]
	if (!Number.isFinite(basePrice) || !Number.isFinite(quotePrice) || basePrice === 0) return null

	const newPrice = (quotePrice * val1) / val0
	if (!Number.isFinite(newPrice)) return null
	const increase = newPrice / basePrice
	if (!Number.isFinite(increase)) return null

	return { newPrice, increase }
}

export function CompareTokens({
	coinsData,
	protocols
}: {
	coinsData: IResponseCGMarketsAPI[]
	protocols: CompareTokenProtocol[]
}) {
	const router = useRouter()
	const [isModalOpen, setModalOpen] = useState(0)
	const coinParam = router.query?.coin
	const typeParam = router.query?.type

	const coinsDataById = useMemo(
		() => new Map<string, IResponseCGMarketsAPI>(coinsData.map((c) => [c.id, c])),
		[coinsData]
	)
	const protocolsByGeckoId = useMemo(
		() => new Map<string, CompareTokenProtocol>(protocols.flatMap((p) => (p.geckoId ? [[p.geckoId, p] as const] : []))),
		[protocols]
	)
	const protocolsByName = useMemo(
		() => new Map<string, CompareTokenProtocol>(protocols.map((p) => [p.name, p])),
		[protocols]
	)

	const { selectedCoins, coins, compareType } = useMemo(() => {
		const queryCoins = coinParam ?? ([] as string[])

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
		const coinPrices = coins.map((c) => priceData[`coingecko:${c}`]?.price ?? NaN)
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
								alt={''}
								src={selectedCoins[0].image}
								height={16}
								width={16}
								loading="lazy"
								onError={(e) => {
									const img = e.currentTarget
									img.onerror = null
									img.src = '/assets/placeholder.png'
								}}
								className="absolute top-0 bottom-0 left-3 my-auto inline-block aspect-square shrink-0 rounded-full bg-(--legacy-bg-tertiary) object-cover"
							/>
						) : (
							<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						)}
						<input
							value={selectedCoins[0]?.name ?? ''}
							onClick={() => {
								setModalOpen(1)
								dialogStore.toggle()
							}}
							readOnly
							placeholder="Search coins..."
							className={searchFieldInputStyles}
						/>
					</div>
					<button
						onClick={() => {
							if (coins.length > 1) {
								void pushShallowQuery(router, { coin: [coins[1], coins[0]] })
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
								alt={''}
								src={selectedCoins[1].image}
								height={16}
								width={16}
								loading="lazy"
								onError={(e) => {
									const img = e.currentTarget
									img.onerror = null
									img.src = '/assets/placeholder.png'
								}}
								className="absolute top-0 bottom-0 left-3 my-auto inline-block aspect-square shrink-0 rounded-full bg-(--legacy-bg-tertiary) object-cover"
							/>
						) : (
							<Icon name="search" height={16} width={16} className={searchFieldIconStyles} />
						)}
						<input
							value={selectedCoins[1]?.name ?? ''}
							onClick={() => {
								setModalOpen(2)
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
						<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
							<Icon name="x" className="size-5" />
						</Ariakit.PopoverDismiss>

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
							<LocalLoader />
							<span className="sr-only">Loading token comparison</span>
						</div>
					) : (
						<div className="mt-10 flex flex-col items-center gap-2">
							<h2 className="flex flex-wrap items-center justify-center gap-1 text-base font-normal">
								<span className="flex items-center gap-1">
									<img
										alt={''}
										src={selectedCoins[0]?.image}
										height={'20px'}
										width={'20px'}
										loading="lazy"
										onError={(e) => {
											e.currentTarget.src = '/assets/placeholder.png'
										}}
										className="inline-block aspect-square shrink-0 rounded-full bg-(--legacy-bg-tertiary) object-cover"
									/>
									<span>{selectedCoins[0]?.symbol?.toUpperCase()}</span>
								</span>
								<span>WITH THE {compareType.label.toUpperCase()} OF</span>
								<span className="flex items-center gap-1">
									<img
										alt={''}
										src={selectedCoins[1]?.image}
										height={'20px'}
										width={'20px'}
										loading="lazy"
										onError={(e) => {
											e.currentTarget.src = '/assets/placeholder.png'
										}}
										className="inline-block aspect-square shrink-0 rounded-full bg-(--legacy-bg-tertiary) object-cover"
									/>
									<span>{selectedCoins[1]?.symbol?.toUpperCase()}</span>
								</span>
							</h2>

							{comparison != null ? (
								<p className="text-lg font-bold">
									${comparison.newPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })} (
									{comparison.increase.toFixed(2)}x)
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
						setModalOpen(0)
						dialogStore.toggle()
					}}
				/>
			</div>
		</>
	)
}
