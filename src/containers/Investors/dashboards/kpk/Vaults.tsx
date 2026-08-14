import { useMemo, useState } from 'react'
import { formatNumber } from '~/utils/numberFormat'
import type { KpkVault } from './api'
import { useKpkVaults } from './api'
import { KPK_MINT_TEXT } from './chartDefaults'
import { CompositionSection } from './CompositionSection'
import { vaultTotals } from './transform'
import {
	Card,
	Chip,
	DataTable,
	Disclaimer,
	LedgerStrip,
	LedgerTile,
	MeterBar,
	QueryError,
	RefLinks,
	RowLink,
	SectionHeader,
	Spark,
	ToggleGroup,
	pct,
	signClass,
	signedBps,
	usd,
	usdFromMillions
} from './ui'

const BREAKDOWNS = [
	{ key: 'venue', label: 'By venue' },
	{ key: 'chain', label: 'By chain' },
	{ key: 'asset', label: 'By asset' }
] as const

const ALL_VENUES = 'all'

const HEALTH_LABELS = { ok: 'Healthy', watch: 'Monitor', unknown: 'Unknown' } as const
const HEALTH_TONES = { ok: 'ok', watch: 'watch', unknown: 'muted' } as const

/** "and"-joined venue list for the tile subtitle: `Morpho, Gearbox and Euler`. */
function venueList(venues: string[]): string {
	if (venues.length < 2) return venues[0] ?? ''
	return `${venues.slice(0, -1).join(', ')} and ${venues[venues.length - 1]}`
}

/**
 * Three distinct states, rendered as three distinct things: a count (`0` is a real
 * count), "not applicable" for venues with no rebalancing agent, and "no source".
 */
function RebalanceCell({ value }: { value: KpkVault['rebalances30d'] }) {
	if (value === 'NA') {
		return (
			<span className="text-pro-text-tertiary" title="Passive lending pool — no rebalancing agent to count">
				n/a
			</span>
		)
	}
	if (value == null) return <>—</>
	return <>{formatNumber(value, { maximumFractionDigits: 0 })}</>
}

export default function Vaults() {
	const { data, isError } = useKpkVaults()
	const [venue, setVenue] = useState<string>(ALL_VENUES)

	const venueOptions = useMemo(
		() => [{ key: ALL_VENUES, label: 'All' }, ...(data?.venues ?? []).map((name) => ({ key: name, label: name }))],
		[data?.venues]
	)

	const rows = useMemo(() => {
		if (!data) return undefined
		return venue === ALL_VENUES ? data.list : data.list.filter((vault) => vault.venue === venue)
	}, [data, venue])

	const totals = useMemo(() => (rows ? vaultTotals(rows) : null), [rows])

	if (isError) return <QueryError label="Vaults" />

	return (
		<div className="flex flex-col gap-5">
			<LedgerStrip>
				<LedgerTile
					label="Curated Total Value Allocated"
					value={data ? usdFromMillions(data.tva) : undefined}
					sub={data ? `Across ${data.count} vaults on ${venueList(data.venues)}` : undefined}
				/>
				{/* No `+` suffix: unlike the brief-stated facts on Overview, this is an exact
				    figure from Dune, so "at least" would understate a number we know. */}
				<LedgerTile
					label="Agent rebalancing volume"
					value={data?.rebalancingVolume}
					sub="Executed by KPK's non-custodial rebalancing and exit agents"
					metric={data?.rebalancingActionsLabel}
					metricLabel="cumulative rebalancing actions"
				/>
				<LedgerTile
					label="Withdrawal liquidity"
					value={data ? pct(data.liquidityPct, 1) : undefined}
					suffix={data ? 'of TVA' : undefined}
					sub={
						data
							? `Aggregate instantly withdrawable share of curated TVA against a ${pct(data.liquidityTarget, 1)} target`
							: undefined
					}
				>
					{data && (
						<MeterBar
							value={data.liquidityPct}
							target={data.liquidityTarget}
							tone={data.liquidityPct != null && data.liquidityPct < data.liquidityTarget ? 'warning' : 'accent'}
						/>
					)}
				</LedgerTile>
			</LedgerStrip>

			<CompositionSection
				title="Curated Total Value Allocated"
				subtitle={data ? `Month-end readings through ${data.compAsOf}` : undefined}
				comps={data?.comp}
				options={BREAKDOWNS}
				initialKey="venue"
			/>

			<section className="flex flex-col gap-3">
				<SectionHeader title="Vaults">
					<ToggleGroup label="Filter vaults by venue" options={venueOptions} value={venue} onChange={setVenue} />
				</SectionHeader>
				<Card>
					<DataTable<KpkVault>
						rows={rows}
						empty={`No ${venue === ALL_VENUES ? '' : `${venue} `}vaults`}
						cols={[
							{
								key: 'name',
								label: 'Vault',
								render: (row) => (
									<span className="flex flex-col">
										<span className="text-pro-text-primary">{row.name}</span>
										<span className="body-sm text-pro-text-tertiary">
											{row.venue} · {row.chain}
										</span>
									</span>
								)
							},
							{ key: 'tva', label: 'TVA', right: true, render: (row) => usdFromMillions(row.tva) },
							{
								key: 'apy',
								label: 'APY',
								right: true,
								render: (row) => (
									<span className="flex items-center justify-end gap-2">
										<span className={KPK_MINT_TEXT}>{pct(row.apy)}</span>
										<Spark values={row.apyHistory} label={`${row.name} APY history`} />
									</span>
								)
							},
							{ key: 'apy30', label: 'APY 30d', right: true, render: (row) => pct(row.apy30) },
							{
								key: 'spreadBps',
								label: 'vs benchmark',
								right: true,
								render: (row) => (
									<span className="flex flex-col items-end">
										<span className={signClass(row.spreadBps)}>{signedBps(row.spreadBps)}</span>
										{row.benchName && <span className="body-sm text-pro-text-tertiary">{row.benchName}</span>}
									</span>
								)
							},
							{
								key: 'interest',
								label: 'Interest earned',
								right: true,
								render: (row) => usdFromMillions(row.interest)
							},
							{
								key: 'liq',
								label: 'Withdrawal liquidity',
								right: true,
								render: (row) => (
									<span className="flex items-center justify-end gap-2">
										<span className={row.belowTarget ? 'text-warning' : undefined}>
											{pct(row.liq, 1)} / {pct(row.liqTarget, 0)}
										</span>
										<MeterBar value={row.liq} target={row.liqTarget} tone={row.belowTarget ? 'warning' : 'accent'} />
									</span>
								)
							},
							{ key: 'exposure', label: 'Collateral & market exposure', wrap: true },
							{
								key: 'rebalances30d',
								label: 'Rebalances 30d',
								right: true,
								render: (row) => <RebalanceCell value={row.rebalances30d} />
							},
							{
								key: 'health',
								label: 'Health',
								render: (row) => <Chip tone={HEALTH_TONES[row.health]}>{HEALTH_LABELS[row.health]}</Chip>
							},
							{
								key: 'url',
								label: '',
								render: (row) => <RowLink href={row.url} label={row.name} />
							}
						]}
						footer={
							totals
								? {
										name: 'Total',
										tva: usd(totals.tvaUsd),
										interest: usd(totals.interestUsd)
									}
								: undefined
						}
					/>
				</Card>
			</section>

			<RefLinks refs={data?.refs} />

			{data?.riskDisclaimer && <Disclaimer title="Risk disclaimer">{data.riskDisclaimer}</Disclaimer>}
		</div>
	)
}
