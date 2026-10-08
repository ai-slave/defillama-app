import { useId } from 'react'
import type { TokenRightsPieTone, TokenRightsPieTones } from './utils'

/** Six equal slices, clockwise from the top. */
const PIE_SLICES = [
	{
		key: 'treasury',
		path: 'M 110 110 L 76 51.11 A 68 68 0 0 1 144 51.11 Z',
		label: { text: 'Treasury', x: 110, y: 33, rotate: 0 }
	},
	{
		key: 'revenue',
		path: 'M 110 110 L 144 51.11 A 68 68 0 0 1 178 110 Z',
		label: { text: 'Revenue', x: 177, y: 72, rotate: 58 }
	},
	{
		key: 'burns',
		path: 'M 110 110 L 178 110 A 68 68 0 0 1 144 168.89 Z',
		label: { text: 'Burns', x: 177, y: 154, rotate: -58 }
	},
	{
		key: 'equity',
		path: 'M 110 110 L 144 168.89 A 68 68 0 0 1 76 168.89 Z',
		label: { text: 'Equity', x: 110, y: 198, rotate: 0 }
	},
	{
		key: 'valueAccrual',
		path: 'M 110 110 L 76 168.89 A 68 68 0 0 1 42 110 Z',
		label: { text: 'Value Accrual', lines: ['Value', 'Accrual'], x: 35, y: 151, rotate: 58 }
	},
	{
		key: 'governance',
		path: 'M 110 110 L 42 110 A 68 68 0 0 1 76 51.11 Z',
		label: { text: 'Governance', x: 43, y: 72, rotate: -58 }
	}
] as const

const PIE_TONE_COLORS: Record<TokenRightsPieTone, string> = {
	positive: 'var(--text-success)',
	negative: 'var(--text-error)',
	warning: 'var(--text-warning)'
}

export function TokenRightsPieChart({
	tones,
	showLabels = true,
	className = 'h-[200px] w-[200px]'
}: {
	tones: TokenRightsPieTones
	showLabels?: boolean
	className?: string
}) {
	const accessibleNameId = useId()
	const accessibleDescriptionId = useId()
	const stateDescription = PIE_SLICES.map((slice) => `${slice.label.text}: ${tones[slice.key]}`).join('; ')

	return (
		<svg
			viewBox={showLabels ? '0 0 220 220' : '40 40 140 140'}
			role="img"
			aria-labelledby={`${accessibleNameId} ${accessibleDescriptionId}`}
			className={className}
		>
			<title id={accessibleNameId}>Token rights summary</title>
			<desc id={accessibleDescriptionId}>{stateDescription}</desc>
			{PIE_SLICES.map(({ key, path, label }) => (
				<g key={key}>
					<path d={path} fill={PIE_TONE_COLORS[tones[key]]} stroke="var(--bg-surface)" strokeWidth="4" />
					{showLabels ? (
						<text
							x={label.x}
							y={label.y}
							textAnchor="middle"
							transform={label.rotate ? `rotate(${label.rotate} ${label.x} ${label.y})` : undefined}
							className="fill-secondary title-md"
						>
							{'lines' in label
								? label.lines.map((line, index) => (
										<tspan key={line} x={label.x} dy={index === 0 ? 0 : 14}>
											{line}
										</tspan>
									))
								: label.text}
						</text>
					) : null}
				</g>
			))}
		</svg>
	)
}
