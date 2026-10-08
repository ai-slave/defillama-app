import { TokenLogo } from '~/components/TokenLogo'
import { keyedOccurrences } from '~/utils/keyedOccurrences'
import { formatPercent } from '~/utils/numberFormat'
import type { UtrTopMover } from './types'

export function TopMovers({ movers }: { movers: Array<UtrTopMover> }) {
	if (movers.length === 0) return null

	return (
		<div className="flex items-center gap-2 overflow-x-auto rounded-lg border border-subtle bg-surface px-3 py-2">
			<span className="shrink-0 label-sm text-tertiary">Top Movers (MoM, %)</span>
			{keyedOccurrences(movers, (mover) => JSON.stringify([mover.asset, mover.name])).map(({ item: mover, key }) => (
				<span key={key} className="flex shrink-0 items-center gap-1.5 px-2 label-sm">
					<TokenLogo src={mover.logoUrl ?? null} size={18} />
					<span className="text-primary">{mover.name}</span>
					<span className={mover.momChangePct >= 0 ? 'text-data-up' : 'text-data-down'}>
						{formatPercent(mover.momChangePct, {
							input: 'percent',
							maximumFractionDigits: 2,
							signDisplay: 'always',
							smallValueDisplay: 'rounded',
							useGrouping: false
						})}
					</span>
				</span>
			))}
		</div>
	)
}
