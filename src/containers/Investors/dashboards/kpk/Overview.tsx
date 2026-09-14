import { useCallback } from 'react'
import { formatNumber } from '~/utils/numberFormat'
import { useKpkOverview, type KpkRef } from './api'
import { CompositionSection, type CompositionSubtotal } from './CompositionSection'
import { MILLION } from './transform'
import {
	asOfLabel,
	ContinuityRule,
	LedgerStrip,
	LedgerTile,
	QueryError,
	RefLinks,
	usdFromMillions,
	type LedgerMetric
} from './ui'

const HACKS_REF: KpkRef = {
	label: 'Total value lost to hacks — DefiLlama',
	url: 'https://defillama.com/hacks/total-value-lost'
}

const BOOK_TITLES = {
	mandates: 'Treasury mandates, including the mandate assets held in KPK vaults',
	vaults: 'Curated vault TVA, including the vault counted inside another KPK vault'
}

export default function Overview() {
	const { data, isError } = useKpkOverview()

	const adjusted = data?.tvaAdjusted
	const books = data?.books
	const asOf = asOfLabel(data?.asOf)

	const subtotals = useCallback(
		(breakdown: string): Array<CompositionSubtotal> | undefined => {
			if (breakdown !== 'line' || !books) return undefined
			return [
				{ name: 'Treasury mandates, total', valueUsd: books.mandates * MILLION, title: BOOK_TITLES.mandates },
				{ name: 'Vaults, total', valueUsd: books.vaults * MILLION, title: BOOK_TITLES.vaults }
			]
		},
		[books]
	)

	if (isError) return <QueryError label="Overview" />

	const tvaMetrics: Array<LedgerMetric> | undefined = data
		? [
				...(books
					? [
							{ value: usdFromMillions(books.mandates), label: 'mandates', title: BOOK_TITLES.mandates },
							{ value: usdFromMillions(books.vaults), label: 'vaults', title: BOOK_TITLES.vaults }
						]
					: []),
				...(adjusted == null
					? []
					: [
							{
								value: usdFromMillions(adjusted),
								label: data.tvaAdjustedLabel ?? 'adjusted',
								title: data.doubleCountNote ?? undefined
							}
						])
			]
		: undefined

	return (
		<div className="flex flex-col gap-5">
			<LedgerStrip>
				<LedgerTile
					label="Total Value Allocated"
					value={data ? usdFromMillions(data.tva) : undefined}
					sub={`Current value KPK manages onchain${asOf ? ` · ${asOf}` : ''}`}
					metrics={tvaMetrics?.length ? tvaMetrics : undefined}
				/>
				{/* A guarded query that failed sends `null`, so the tile reads "—" while the
				    rest of the strip stands. A loading tile is the skeleton, not a dash. */}
				<LedgerTile
					label="Deployed onchain"
					value={data ? (data.deployedOnchain.value ?? '—') : undefined}
					suffix={data?.deployedOnchain.suffix}
					sub={data?.deployedOnchain.sub}
					subRef={data?.deployedOnchain.ref}
					metric={data ? (data.deployedOnchain.metric ?? '—') : undefined}
					metricLabel={data?.deployedOnchain.metricLabel}
					metricRef={data?.deployedOnchain.metricRef}
				/>
				<LedgerTile
					label="Agent rebalancing volume"
					value={data ? (data.rebalancing.value ?? '—') : undefined}
					suffix={data?.rebalancing.suffix}
					sub={data?.rebalancing.sub}
					subRef={data?.rebalancing.ref}
					metric={data ? (data.rebalancing.metric ?? '—') : undefined}
					metricLabel={data?.rebalancing.metricLabel}
				/>
				{/* "Since inception" rather than the year: the rule is the track record, and
				    a date beside a zero read as the date something happened. */}
				<LedgerTile
					label="Funds lost"
					value={data ? formatNumber(data.fundsLost.value, { maximumFractionDigits: 0 }) : undefined}
					suffix={data ? 'since inception' : undefined}
					suffixBelow
					sub={data ? 'No funds lost on DeFi incidents' : undefined}
					subRef={data ? HACKS_REF : undefined}
				>
					<ContinuityRule years={data?.fundsLost.years} />
				</LedgerTile>
			</LedgerStrip>

			<CompositionSection
				title="Composition of Total Value Allocated"
				comps={data?.comp}
				initialKey="line"
				subtotals={subtotals}
			/>

			<RefLinks refs={data?.refs} />
		</div>
	)
}
