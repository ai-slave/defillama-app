import { useId } from 'react'

const PIE_LABELS = [
	{ text: 'Treasury', x: 110, y: 33, rotate: 0 },
	{ text: 'Revenue', x: 177, y: 72, rotate: 58 },
	{ text: 'Burns', x: 177, y: 154, rotate: -58 },
	{ text: 'Dividends', x: 110, y: 198, rotate: 0 },
	{ text: 'Buybacks', x: 43, y: 154, rotate: 58 },
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

export function TokenRightsPieChart({ segments }: { segments: Array<{ label: string; active: boolean }> }) {
	const accessibleNameId = useId()
	const accessibleDescriptionId = useId()
	const stateDescription = segments
		.map((segment) => `${segment.label}: ${segment.active ? 'active' : 'inactive'}`)
		.join('; ')

	return (
		<svg
			viewBox="0 0 220 220"
			role="img"
			aria-labelledby={`${accessibleNameId} ${accessibleDescriptionId}`}
			className="h-[200px] w-[200px]"
		>
			<title id={accessibleNameId}>Token rights summary</title>
			<desc id={accessibleDescriptionId}>{stateDescription}</desc>
			{segments.map((segment, index) => (
				<path
					key={segment.label}
					d={PIE_SEGMENT_PATHS[index]}
					fill={segment.active ? 'var(--success)' : 'var(--error)'}
					stroke="var(--ld-bg-surface)"
					strokeWidth="4"
					strokeDasharray={segment.active ? undefined : '6 4'}
					strokeLinecap="round"
				/>
			))}
			{PIE_LABELS.map((label) => (
				<text
					key={label.text}
					x={label.x}
					y={label.y}
					textAnchor="middle"
					transform={label.rotate ? `rotate(${label.rotate} ${label.x} ${label.y})` : undefined}
					className="fill-secondary text-sm font-bold"
				>
					{label.text}
				</text>
			))}
		</svg>
	)
}
