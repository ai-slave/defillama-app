import { useMemo, useState } from 'react'
import { formatDate } from '~/utils/dateFormat'
import { formatNumber, formatUsd, formatPercent, PERCENT_POINTS_TWO_DECIMALS_OPTIONS } from '~/utils/numberFormat'
import type { KpkVault } from './api'
import { useKpkVaults } from './api'
import { KPK_MINT_TEXT } from './chartDefaults'
import { CompositionSection } from './CompositionSection'
import { vaultTotals } from './transform'
import {
	andList,
	Card,
	DataTable,
	Disclaimer,
	DuplicateMark,
	LedgerStrip,
	LedgerTile,
	MeterBar,
	QueryError,
	RefLinks,
	RowLink,
	SectionHeader,
	Spark,
	ToggleGroup,
	signClass,
	signedBps,
	usdFromMillions,
	type FooterRow,
	KPK_PERCENT_OPTIONS
} from './ui'

const ALL_VENUES = 'all'

const DOUBLE_COUNT_NOTE = 'Counted inside another vault on this table. Excluded from the adjusted totals.'

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
	return <>{formatNumber(value, { maximumFractionDigits: 0 }) ?? '—'}</>
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
	const doubleCountNote = data?.doubleCountNote ?? DOUBLE_COUNT_NOTE
	const adjustedVenues = useMemo(
		() => [...new Set((data?.list ?? []).filter((vault) => vault.doubleCounted).map((vault) => vault.venue))],
		[data?.list]
	)
	const showAdjustedTva = data?.tvaAdjusted != null && adjustedVenues.length > 0

	const footer = useMemo<Array<FooterRow> | undefined>(() => {
		if (!totals) return undefined
		const footerRows: Array<FooterRow> = [
			{
				cells: {
					name: 'Total',
					tva: formatUsd(totals.tvaUsd, { compact: true, compactSuffix: 'lowercase' }) ?? '—',
					interest: formatUsd(totals.interestUsd, { compact: true, compactSuffix: 'lowercase' }) ?? '—'
				}
			}
		]
		if (totals.duplicateVenues.length > 0) {
			footerRows.push({
				muted: true,
				title: doubleCountNote,
				cells: {
					name: `Adjusted, excl. ${andList(totals.duplicateVenues)}`,
					tva: formatUsd(totals.tvaAdjustedUsd, { compact: true, compactSuffix: 'lowercase' }) ?? '—',
					interest: formatUsd(totals.interestAdjustedUsd, { compact: true, compactSuffix: 'lowercase' }) ?? '—'
				}
			})
		}
		return footerRows
	}, [totals, doubleCountNote])

	if (isError) return <QueryError label="Vaults" />

	return (
		<div className="flex flex-col gap-5">
			<LedgerStrip>
				<LedgerTile
					label="Curated Total Value Allocated"
					value={data ? usdFromMillions(data.tva) : undefined}
					sub={data ? `Across ${data.count} vaults on ${andList(data.venues)}` : undefined}
					metric={showAdjustedTva ? usdFromMillions(data?.tvaAdjusted) : undefined}
					metricLabel={showAdjustedTva ? `adjusted, excluding ${andList(adjustedVenues)}` : undefined}
					metricTitle={showAdjustedTva ? doubleCountNote : undefined}
				/>
				{/* No `+` suffix: unlike the brief-stated facts on Overview, this is an exact
				    figure from Dune, so "at least" would understate a number we know. */}
				<LedgerTile
					label="Agent rebalancing volume"
					value={data?.rebalancingVolume}
					sub="Executed by KPK's non-custodial rebalancing and exit agents"
					subRef={data?.rebalancingRef}
					metric={data?.rebalancingActionsLabel}
					metricLabel="cumulative rebalancing actions"
				/>
				<LedgerTile
					label="Instant liquidity"
					value={data ? (formatPercent(data.liquidityPct, KPK_PERCENT_OPTIONS) ?? '—') : undefined}
					suffix={data ? 'of TVA' : undefined}
					sub={
						data
							? `Aggregate instantly withdrawable share of curated TVA against a ${formatPercent(data.liquidityTarget, KPK_PERCENT_OPTIONS) ?? '—'} target`
							: undefined
					}
				/>
			</LedgerStrip>

			<CompositionSection
				title="Curated Total Value Allocated"
				subtitle={data ? `Daily readings through ${formatDate(data.compAsOf)}` : undefined}
				comps={data?.comp}
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
										<span className="text-pro-text-primary">
											{row.name}
											{row.doubleCounted && <DuplicateMark note={doubleCountNote} />}
										</span>
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
										<span className={KPK_MINT_TEXT}>
											{formatPercent(row.apy, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'}
										</span>
										<Spark values={row.apyHistory} label={`${row.name} APY history`} />
									</span>
								)
							},
							{
								key: 'apy30',
								label: 'APY 30d',
								right: true,
								render: (row) => formatPercent(row.apy30, PERCENT_POINTS_TWO_DECIMALS_OPTIONS) ?? '—'
							},
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
								label: 'Instant liquidity',
								title: "Share of the current TVA that's available to withdraw instantly",
								right: true,
								render: (row) => (
									<span className="flex items-center justify-end gap-2">
										<span className={row.belowTarget ? 'text-warning' : undefined}>
											{formatPercent(row.liq, KPK_PERCENT_OPTIONS) ?? '—'} /{' '}
											{formatPercent(row.liqTarget, {
												input: 'percent',
												smallValueDisplay: 'rounded',
												maximumFractionDigits: 0,
												useGrouping: false
											}) ?? '—'}
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
								key: 'deriskingAutomations',
								label: 'Derisking automations',
								title:
									'All-time count of agent-executed derisking rebalances. Only venues with an agent-attributed event source report a figure.',
								right: true,
								render: (row) => formatNumber(row.deriskingAutomations, { maximumFractionDigits: 0 }) ?? '—'
							},
							{ key: 'losses', label: 'Incurred losses', render: () => 'None' },
							{
								key: 'url',
								label: '',
								render: (row) => <RowLink href={row.url} label={row.name} />
							}
						]}
						footer={footer}
					/>
				</Card>
			</section>

			<RefLinks refs={data?.refs} />

			{data?.riskDisclaimer && <Disclaimer title="Risk disclaimer">{data.riskDisclaimer}</Disclaimer>}
		</div>
	)
}
