import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Skeleton } from '~/ui/Skeleton'
import { formatUsd, formatPercent } from '~/utils/numberFormat'

interface ExternalDataBalanceCardProps {
	freeRemaining: string
	toppedUpBalance: string
	freeLimit: string
	freeSpent: string
	isLoading: boolean
	onTopUp: () => void
}

const formatBalanceUsd = (value: string) =>
	formatUsd(parseFloat(value), { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function ExternalDataBalanceCard({
	freeRemaining,
	toppedUpBalance,
	freeLimit,
	freeSpent,
	isLoading,
	onTopUp
}: ExternalDataBalanceCardProps) {
	if (isLoading) {
		return (
			<div className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface p-4">
				<div className="flex items-center gap-2">
					<Skeleton className="size-7" />
					<Skeleton className="h-5 w-44" />
				</div>
				<Skeleton className="h-3 w-full" />
				<Skeleton className="h-3 w-3/4" />
				<Skeleton className="h-8 w-20 rounded-lg" />
			</div>
		)
	}

	const freeSpentNum = parseFloat(freeSpent)
	const freeLimitNum = parseFloat(freeLimit)
	const totalAvailable = parseFloat(freeRemaining) + parseFloat(toppedUpBalance)
	const usagePercent = freeLimitNum > 0 ? Math.min(100, (freeSpentNum / freeLimitNum) * 100) : 0
	const isLowBalance = totalAvailable < 1

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface p-4">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Icon name="box" height={28} width={28} className="text-primary" />
					<span className="label-lg text-primary">External Data Balance</span>
				</div>
				<Button variant="primary" size="md" onClick={onTopUp}>
					<Icon name="plus" className="size-3.5" />
					Top up
				</Button>
			</div>

			<p className="body-sm text-tertiary">
				Credits give LlamaAI access to premium data: onchain data, X profiles and posts, LinkedIn, and more. Pro
				subscribers get $10 per month in credits.
			</p>

			{/* Balances */}
			<div className="flex flex-col gap-4 rounded-lg bg-surface-elevated-1 p-3">
				{/* Free This Month */}
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<span className="body-sm text-tertiary">Free this month</span>
						<span className="body-sm text-primary">
							{formatBalanceUsd(freeRemaining)} <span className="text-tertiary">/ {formatBalanceUsd(freeLimit)}</span>
						</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-surface-elevated-2">
						<div
							className="h-full rounded-full bg-brand"
							style={{
								width: `${formatPercent(Math.max(1, usagePercent), { input: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: false })}`
							}}
						/>
					</div>
					<div className="flex items-center justify-between label-xs text-tertiary">
						<span>{formatBalanceUsd(freeSpent)} used</span>
						<span>
							{formatPercent(usagePercent, {
								input: 'percent',
								maximumFractionDigits: 0,
								useGrouping: false
							})}{' '}
							used
						</span>
					</div>
				</div>

				{/* Topped Up */}
				<div className="flex items-center justify-between">
					<span className="body-sm text-tertiary">Topped up</span>
					<span className="label-sm text-primary">{formatBalanceUsd(toppedUpBalance)}</span>
				</div>
			</div>

			{/* Total */}
			<div className="flex items-center justify-between">
				<span className="body-md text-tertiary">Total available</span>
				<span className={`title-md ${isLowBalance ? 'text-warning' : 'text-primary'}`}>
					{formatUsd(totalAvailable, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
				</span>
			</div>
		</div>
	)
}
