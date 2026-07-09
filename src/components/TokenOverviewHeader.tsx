import { TokenLogo } from '~/components/TokenLogo'
import { Card } from '~/ui/Card'
import { formattedNum } from '~/utils'

type TokenOverviewHeaderProps = {
	name: string
	title?: string
	price?: number | null
	percentChange?: number | null
	circSupply?: number | null
	maxSupply?: number | null
	mcap?: number | null
	fdv?: number | null
	volume24h?: number | null
	symbol?: string | null
}

export function TokenOverviewHeader({
	name,
	title,
	price,
	percentChange,
	circSupply,
	maxSupply,
	mcap,
	fdv,
	volume24h,
	symbol
}: TokenOverviewHeaderProps) {
	const hasStats = circSupply != null || maxSupply != null || mcap != null || fdv != null || volume24h != null

	return (
		<>
			<Card padding="sm" className="flex w-full items-center gap-3">
				<TokenLogo name={name} kind="token" alt={`Logo of ${name}`} />
				<h1 className="heading-sm">{title ?? name}</h1>

				{price != null ? (
					<>
						<span className="mx-1 h-5 border-l border-subtle" />
						<span className="label-lg">${formattedNum(price)}</span>
						{percentChange !== null && percentChange !== undefined ? (
							<span className={`label-sm ${percentChange >= 0 ? 'text-data-up' : 'text-data-down'}`}>
								{percentChange > 0 ? '+' : null}
								{percentChange}%
							</span>
						) : null}
					</>
				) : null}
			</Card>

			{hasStats ? (
				<Card padding="sm" className="flex min-h-[46px] w-full flex-wrap items-center gap-x-6 gap-y-2">
					{circSupply != null ? (
						<div className="flex items-baseline gap-1.5">
							<span className="body-sm text-secondary">Circ. Supply</span>
							<span className="label-sm">
								{formattedNum(circSupply)} {symbol}
							</span>
						</div>
					) : null}

					{maxSupply != null ? (
						<div className="flex items-baseline gap-1.5">
							<span className="body-sm text-secondary">Max Supply</span>
							<span className="label-sm">
								{maxSupply !== Infinity ? formattedNum(maxSupply) : '∞'} {symbol}
							</span>
						</div>
					) : null}

					{mcap != null ? (
						<div className="flex items-baseline gap-1.5">
							<span className="body-sm text-secondary">MCap</span>
							<span className="label-sm">${formattedNum(mcap)}</span>
						</div>
					) : null}

					{fdv != null ? (
						<div className="flex items-baseline gap-1.5">
							<span className="body-sm text-secondary">FDV</span>
							<span className="label-sm">${formattedNum(fdv)}</span>
						</div>
					) : null}

					{volume24h != null ? (
						<div className="flex items-baseline gap-1.5">
							<span className="body-sm text-secondary">Vol 24h</span>
							<span className="label-sm">${formattedNum(volume24h)}</span>
						</div>
					) : null}
				</Card>
			) : null}
		</>
	)
}
