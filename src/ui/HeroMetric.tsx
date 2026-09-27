import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { Icon } from '~/ui/Icon'
import { tooltipSurfaceStyles } from '~/ui/Popover'
import { Tooltip } from '~/ui/Tooltip'

interface HeroMetricProps {
	label: string
	tooltip?: string
	/** Already formatted headline value. Text only: the hydration flag on its span covers nothing nested. */
	value: string | number
	/** Per-chain breakdown; when present the hero expands to show it. */
	byChain?: Array<[string, ReactNode]>
	byChainTitle?: string
}

/** Headline stat at the top of a summary card: big value, optionally expanding to per-chain rows. */
export function HeroMetric({ label, tooltip, value, byChain, byChainTitle }: HeroMetricProps) {
	const valueEl = (
		<span className="min-h-8 font-jetbrains text-2xl font-semibold" suppressHydrationWarning>
			{value}
		</span>
	)

	if (!byChain || byChain.length === 0) {
		return (
			<p className="flex flex-col">
				{tooltip ? (
					<Tooltip content={tooltip} className="text-secondary underline decoration-dotted">
						{label}
					</Tooltip>
				) : (
					<span className="text-secondary">{label}</span>
				)}
				{valueEl}
			</p>
		)
	}

	const summaryContent = (
		<>
			<span className={`text-secondary ${tooltip ? 'underline decoration-dotted' : ''}`.trim()}>{label}</span>
			<span className="flex flex-nowrap items-center gap-2">
				{valueEl}
				<Icon
					name="chevron-down"
					height={16}
					width={16}
					className="relative top-0.5 text-tertiary transition-transform duration-100 group-open:rotate-180"
				/>
			</span>
		</>
	)

	return (
		<details className="group">
			{tooltip ? (
				/* A <summary> must not contain interactive descendants, so the summary
				   itself anchors the tooltip (same trick as MetricSection). */
				<Ariakit.TooltipProvider placement="top-start">
					<Ariakit.TooltipAnchor
						render={(anchorProps) => (
							<summary {...anchorProps} className="flex cursor-pointer flex-col">
								{summaryContent}
							</summary>
						)}
					/>
					<Ariakit.Tooltip className={`${tooltipSurfaceStyles} max-w-56 whitespace-pre-wrap`} unmountOnHide portal>
						<div className="p-2">{tooltip}</div>
					</Ariakit.Tooltip>
				</Ariakit.TooltipProvider>
			) : (
				<summary className="flex cursor-pointer flex-col">{summaryContent}</summary>
			)}
			<div className="my-3 flex max-h-[50dvh] flex-col overflow-auto">
				<h2 className="font-semibold">{byChainTitle ?? `${label} by chain`}</h2>
				{byChain.map(([chain, chainValue]) => (
					<p
						key={chain}
						className="flex items-center justify-between gap-1 border-b border-dashed border-subtle py-1 last:border-none"
					>
						<span className="text-secondary">{chain}</span>
						<span className="font-jetbrains">{chainValue}</span>
					</p>
				))}
			</div>
		</details>
	)
}
