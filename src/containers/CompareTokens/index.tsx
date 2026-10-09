import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import type { IResponseCGTokenRankingsDatasetItem } from '~/api/coingecko.types'
import { fetchCoinPrices } from '~/api/pricing'
import { Select } from '~/components/Select/Select'
import { selectTriggerStyles } from '~/components/Select/types'
import { applyLogoFallback } from '~/components/TokenLogo/applyLogoFallback'
import { TokenSearchDialog } from '~/containers/TokenSearch/TokenSearchDialog'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { SurfaceBodyLoadingStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
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

const compareTypeOptions = compareTypes.map((type) => ({ key: type.value, name: type.label }))

export function CompareTokens({
	coinsData,
	protocols
}: {
	coinsData: Array<IResponseCGTokenRankingsDatasetItem>
	protocols: Array<CompareTokenProtocol>
}) {
	const router = useRouter()
	// Which of the two tokens the search dialog replaces; the dialog's store owns whether it is open.
	const [pickingSlot, setPickingSlot] = useState<0 | 1>(0)
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
				{/* On wider screens the labels share one row and the fields the next, so the swap centers on the fields. */}
				<div className="flex flex-col gap-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:grid-rows-[auto_auto] sm:gap-x-4 sm:gap-y-1.5">
					<CoinPicker
						label="First token"
						coin={selectedCoins[0]}
						dialogStore={dialogStore}
						onPick={() => setPickingSlot(0)}
					/>
					<Tooltip
						content="Switch tokens"
						render={
							<Button
								variant="ghost"
								size="md"
								square
								className="sm:col-start-2 sm:row-start-2"
								disabled={coins.length !== 2}
								accessibleWhenDisabled
								aria-label="Switch tokens"
								onClick={() => void pushShallowQuery(router, { coin: [coins[1], coins[0]] })}
							/>
						}
					>
						<Icon name="repeat" className="size-4" />
					</Tooltip>
					<CoinPicker
						label="Second token"
						coin={selectedCoins[1]}
						dialogStore={dialogStore}
						onPick={() => setPickingSlot(1)}
					/>
				</div>
				<Select
					heading="Compare by"
					allValues={compareTypeOptions}
					selectedValues={compareType.value}
					setSelectedValues={(type) => void pushShallowQuery(router, { type })}
					label={compareType.label}
					labelType="none"
					variant="filter"
					size="md"
					className="w-full"
					triggerProps={{ 'aria-label': 'Compare by' }}
				/>
				{coins.length === 2 ? (
					priceData == null ? (
						<SurfaceBodyLoadingStatus label="Loading token comparison" />
					) : (
						<div className="mt-10 flex flex-col items-center gap-2">
							<h2 className="flex flex-wrap items-center justify-center gap-1 body-lg">
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
								<span>with the {compareType.label} of</span>
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
								<p className="mono-xl">
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
						newCoins[pickingSlot] = coin.id
						void pushShallowQuery(router, { coin: newCoins })
						dialogStore.hide()
					}}
				/>
			</div>
		</>
	)
}

/** Opens the shared token search for one side of the comparison. The disclosure gets focus back when the search closes. */
function CoinPicker({
	label,
	coin,
	dialogStore,
	onPick
}: {
	label: string
	coin: IResponseCGTokenRankingsDatasetItem | undefined
	dialogStore: Ariakit.DialogStore
	onPick: () => void
}) {
	return (
		<div className="flex w-full flex-col gap-1.5 sm:row-span-2 sm:grid sm:grid-rows-subgrid">
			<span className="label-sm text-secondary">{label}</span>
			<Ariakit.DialogDisclosure
				store={dialogStore}
				onClick={onPick}
				aria-label={`${label}: ${coin?.name ?? 'none'}`}
				className={`${selectTriggerStyles('input', 'md')} w-full overflow-hidden`}
			>
				{coin != null ? (
					<>
						<img
							alt=""
							src={geckoTokenIconUrl(coin.id)}
							height={16}
							width={16}
							loading="lazy"
							onError={(e) => applyLogoFallback(e.currentTarget)}
							className="inline-block aspect-square shrink-0 rounded-full bg-surface-elevated-2 object-cover"
						/>
						<span className="min-w-0 truncate">{coin.name}</span>
					</>
				) : (
					<>
						<Icon name="search" height={16} width={16} className="shrink-0 text-tertiary" />
						<span className="text-tertiary">Search coins...</span>
					</>
				)}
			</Ariakit.DialogDisclosure>
		</div>
	)
}
