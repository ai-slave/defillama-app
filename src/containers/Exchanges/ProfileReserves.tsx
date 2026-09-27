import { useRouter } from 'next/router'
import { IncludeOwnTokensSwitch, ReserveAssetsCharts } from '~/containers/Cexs/ReserveAssetsCharts'
import { ReserveStablecoinCharts } from '~/containers/Cexs/ReserveStablecoinCharts'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatStrip, type InlineStatStripItem } from '~/ui/SummaryStats'
import { formatUsd, formatPercent } from '~/utils/numberFormat'
import { pushShallowQuery } from '~/utils/routerQuery'
import type { ExchangeProfileModel, ExchangeReservesModel } from './models'
import {
	DEFAULT_PROFILE_RESERVES_VIEW,
	EXCHANGES_QUERY_KEYS,
	getProfileReservesView,
	type ProfileReservesView
} from './queryState'

/** Headline reserve stats to lift out of the proof-of-reserves metadata group, in display order. */
const RESERVE_STAT_KEYS = ['total', 'clean', 'clean_ratio', 'own_conc', 'in24h']

function ReserveStatStrip({ profile }: { profile: ExchangeProfileModel }) {
	const group = profile.metadata.groups.find((candidate) => candidate.key === 'proof_of_reserves')
	if (!group) return null

	const items: Array<InlineStatStripItem> = []
	for (const key of RESERVE_STAT_KEYS) {
		const field = group.fields.find((candidate) => candidate.key === key)
		if (!field || typeof field.value !== 'number') continue
		if (field.type === 'usd') {
			items.push({
				label: field.label,
				value:
					key === 'in24h' ? (
						<span className={field.value < 0 ? 'text-data-down' : field.value > 0 ? 'text-data-up' : ''}>
							{formatUsd(field.value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })}
						</span>
					) : (
						formatUsd(field.value, { compact: true, minimumCompactValue: 1_000_000, compactSuffix: 'lowercase' })
					)
			})
		} else if (field.type === 'pct') {
			items.push({
				label: field.label,
				value: `${formatPercent(field.value, { input: 'fraction', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })}`
			})
		}
	}
	if (items.length === 0) return null
	return <InlineStatStrip items={items} />
}

export function ProfileReserves({
	profile,
	reserves
}: {
	profile: ExchangeProfileModel
	reserves: ExchangeReservesModel
}) {
	const router = useRouter()
	const view = getProfileReservesView(router.query)

	const setView = (nextView: ProfileReservesView) => {
		void pushShallowQuery(router, {
			[EXCHANGES_QUERY_KEYS.profileReservesView]: nextView === DEFAULT_PROFILE_RESERVES_VIEW ? undefined : nextView
		})
	}

	const showOwnTokensSwitch = view === 'assets' && reserves.ownToken != null

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<SegmentedControl
					value={view}
					onValueChange={setView}
					options={[
						{ value: 'assets', label: 'Assets' },
						{ value: 'stablecoins', label: 'Stablecoins' }
					]}
					label="Reserves view"
					variant="default"
					size="md"
				/>
				{showOwnTokensSwitch && reserves.ownToken ? (
					<span className="ml-auto">
						<IncludeOwnTokensSwitch ownToken={reserves.ownToken} />
					</span>
				) : null}
			</div>
			{view === 'stablecoins' ? (
				<ReserveStablecoinCharts protocol={reserves.protocolSlug} displayName={profile.name} />
			) : (
				<>
					<ReserveStatStrip profile={profile} />
					<ReserveAssetsCharts
						protocol={reserves.protocolSlug}
						displayName={profile.name}
						ownToken={reserves.ownToken}
					/>
				</>
			)}
		</div>
	)
}
