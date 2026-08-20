import { TokenLogo } from '~/components/TokenLogo'
import { formatPercent } from '~/utils/numberFormat'
import type { UtrTopMover } from './types'

export function TopMovers({ movers }: { movers: UtrTopMover[] }) {
	return (
		<div className="flex items-center gap-2 overflow-x-auto rounded-lg border border-subtle bg-surface px-3 py-2">
			<span className="shrink-0 label-sm text-tertiary">Top Movers (MoM, %)</span>
			{movers.length ? null : <span className="label-sm text-secondary">NO DATA YET</span>}
			{movers.map((mover, index) => (
				<span key={`${mover.asset}-${index}`} className="flex shrink-0 items-center gap-1.5 px-2 label-sm">
					<TokenLogo src={mover.logoUrl ?? null} size={18} />
					<span className="text-primary">{mover.name}</span>
					<span className={mover.momChangePct >= 0 ? 'text-success' : 'text-error'}>
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
