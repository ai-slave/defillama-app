import { LockIcon } from '~/components/LockIcon'
import { Hovercard } from '~/ui/Hovercard'

export function LockedStabilityCell({
	onRequestUpgrade,
	className
}: {
	onRequestUpgrade: (source: 'header' | 'cell') => void
	className?: string
}) {
	const redactedPreview = (
		<span className="flex flex-col gap-1.5">
			<span className="flex items-center justify-between gap-4">
				<span className="font-semibold">30d Stability</span>
				<span className="inline-flex items-center gap-1 rounded-sm bg-brand-muted px-1.5 py-0.5 label-xs text-link-on-tint">
					<LockIcon className="h-2.5 w-2.5" />
					Pro
				</span>
			</span>
			<span className="inline-flex w-fit items-center gap-1 rounded-full bg-surface-elevated-1 px-2 py-0.5 label-sm text-secondary">
				•••• <span className="opacity-70">••••</span>
			</span>
			<span className="flex flex-col gap-0.5">
				<span className="flex justify-between gap-4">
					<span className="text-secondary">30d Avg APY</span>
					<span>••••</span>
				</span>
				<span className="flex justify-between gap-4">
					<span className="text-secondary">Volatility (σ)</span>
					<span>••••</span>
				</span>
			</span>
			<span className="body-xs opacity-50">Score = 100 / (1 + σ/avg) · higher is steadier</span>
			<span className="border-t border-subtle pt-1.5">
				<button
					type="button"
					onClick={() => onRequestUpgrade('cell')}
					className="group inline-flex cursor-pointer items-center gap-1 label-xs text-link hover:underline"
				>
					Unlock with Pro
					<span className="transition-transform group-hover:translate-x-0.5">→</span>
				</button>
			</span>
		</span>
	)

	return (
		<Hovercard
			content={redactedPreview}
			className={className}
			contentClassName="p-2"
			showOnClick={false}
			render={<button type="button" onClick={() => onRequestUpgrade('cell')} className="cursor-pointer" />}
		>
			<span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated-1 px-2 py-0.5 label-sm text-secondary">
				<LockIcon className="h-3 w-3" />
				<span className="blur-[3px] select-none">Hidden</span>
			</span>
		</Hovercard>
	)
}
