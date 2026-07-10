import { useId } from 'react'
import type { TokenRightsPieTone } from './utils'

const PIE_LABELS = [
	{ text: 'Treasury', x: 110, y: 33, rotate: 0 },
	{ text: 'Revenue', x: 177, y: 72, rotate: 58 },
	{ text: 'Burns', x: 177, y: 154, rotate: -58 },
	{ text: 'Equity', x: 110, y: 198, rotate: 0 },
	{ text: 'Value Accrual', lines: ['Value', 'Accrual'], x: 35, y: 151, rotate: 58 },
	{ text: 'Governance', x: 43, y: 72, rotate: -58 }
] as const

const PIE_SEGMENT_PATHS = [
	'M 110 110 L 76 51.11 A 68 68 0 0 1 144 51.11 Z',
	'M 110 110 L 144 51.11 A 68 68 0 0 1 178 110 Z',
	'M 110 110 L 178 110 A 68 68 0 0 1 144 168.89 Z',
	'M 110 110 L 144 168.89 A 68 68 0 0 1 76 168.89 Z',
	'M 110 110 L 76 168.89 A 68 68 0 0 1 42 110 Z',
	'M 110 110 L 42 110 A 68 68 0 0 1 76 51.11 Z'
] as const

const PIE_TONE_COLORS: Record<TokenRightsPieTone, string> = {
	positive: 'var(--success)',
	negative: 'var(--error)',
	warning: 'var(--warning)'
}

export function TokenRightsPieChart({
	segments,
	showLabels = true,
	className = 'h-[200px] w-[200px]'
}: {
	segments: ReadonlyArray<{ label: string; tone: TokenRightsPieTone }>
	showLabels?: boolean
	className?: string
}) {
	const accessibleNameId = useId()
	const accessibleDescriptionId = useId()
	const stateDescription = segments.map((segment) => `${segment.label}: ${segment.tone}`).join('; ')

	return (
		<svg
			viewBox={showLabels ? '0 0 220 220' : '40 40 140 140'}
			role="img"
			aria-labelledby={`${accessibleNameId} ${accessibleDescriptionId}`}
			className={className}
		>
			<title id={accessibleNameId}>Token rights summary</title>
			<desc id={accessibleDescriptionId}>{stateDescription}</desc>
			{segments.map((segment, index) => (
				<path
					key={segment.label}
					d={PIE_SEGMENT_PATHS[index]}
					fill={PIE_TONE_COLORS[segment.tone]}
					stroke="var(--ld-bg-surface)"
					strokeWidth="4"
				/>
			))}
			{showLabels
				? PIE_LABELS.map((label) => (
						<text
							key={label.text}
							x={label.x}
							y={label.y}
							textAnchor="middle"
							transform={label.rotate ? `rotate(${label.rotate} ${label.x} ${label.y})` : undefined}
							className="fill-secondary text-sm font-bold"
						>
							{'lines' in label
								? label.lines.map((line, index) => (
										<tspan key={line} x={label.x} dy={index === 0 ? 0 : 14}>
											{line}
										</tspan>
									))
								: label.text}
						</text>
					))
				: null}
		</svg>
	)
}
