import type { ReactNode } from 'react'
import { StaleText } from '~/ui/StaleText'
import { StatItem } from '~/ui/SummaryStats'
import { Tooltip } from '~/ui/Tooltip'
import { DisclosureChevron } from './DisclosureChevron'

interface HeroMetricProps {
	label: string
	tooltip?: string
	/** Already formatted headline value; a cached price may differ from the live one, so it renders as StaleText. */
	value: string | number
	/** Per-chain breakdown; when present the hero expands to show it. */
	byChain?: Array<[string, ReactNode]>
	byChainTitle?: string
	/** The by-chain list's heading level, h2 by default: lower it where the hero sits under a deeper heading. */
	headingAs?: 'h1' | 'h2' | 'h3' | 'h4' | undefined
}

/** Headline stat at the top of a summary card: big value, optionally expanding to per-chain rows under an h2 (or
    `headingAs`) "… by chain" heading. Without rows it is the StatItem headline. */
export function HeroMetric({
	label,
	tooltip,
	value,
	byChain,
	byChainTitle,
	headingAs: Heading = 'h2'
}: HeroMetricProps) {
	if (!byChain || byChain.length === 0) {
		return <StatItem label={label} tooltip={tooltip} value={<StaleText>{value}</StaleText>} />
	}

	return (
		<details>
			{/* A <summary> must not contain interactive descendants, so the summary itself anchors the tooltip (as
			    MetricSection does): hover or focus shows the definition, and a click or tap still toggles the rows. */}
			<Tooltip content={tooltip} render={<summary className="flex cursor-pointer flex-col" />}>
				<span className={`text-secondary ${tooltip ? 'underline decoration-dotted' : ''}`.trim()}>{label}</span>
				<span className="flex flex-nowrap items-center gap-2">
					<StaleText className="min-h-8 mono-xl">{value}</StaleText>
					<DisclosureChevron kind="section" size="md" className="relative top-0.5" />
				</span>
			</Tooltip>
			<div className="my-3 flex max-h-[50dvh] flex-col overflow-auto">
				<Heading className="font-semibold">{byChainTitle ?? `${label} by chain`}</Heading>
				{byChain.map(([chain, chainValue]) => (
					<p
						key={chain}
						className="flex items-baseline justify-between gap-1 border-b border-dashed border-subtle py-1 last:border-none"
					>
						<span className="text-secondary">{chain}</span>
						<span className="mono-md">{chainValue}</span>
					</p>
				))}
			</div>
		</details>
	)
}
