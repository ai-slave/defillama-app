import { useRouter } from 'next/router'
import { Select } from '~/components/Select/Select'
import { Tooltip } from '~/ui/Tooltip'
import { pushYieldsQuery } from '../queryUpdates.client'

// URL-param-driven loop-count selector for the /yields/loop page. Pushes the
// `loopCount` router query param (shallow) exactly like ApyViewControls pushes
// `apyWindow` — `useYieldsServerTable` forwards it to the loops route, which recomputes
// the looped APY geometrically for the requested count. The default (5) pushes NO param
// so URLs stay clean and the request stays byte-identical to the no-toggle baseline.

const MIN_LOOP_COUNT = 1
const MAX_LOOP_COUNT = 10
const DEFAULT_LOOP_COUNT = 5

const LOOP_OPTIONS = Array.from({ length: MAX_LOOP_COUNT - MIN_LOOP_COUNT + 1 }, (_, i) => {
	const value = String(MIN_LOOP_COUNT + i)
	return { key: value, name: value }
})

const LOOP_HELP = 'Number of recursive supply → borrow loops. Default 5.'

function readSingle(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value
}

function decodeLoopCount(value: string | string[] | undefined): number {
	const raw = Number(readSingle(value))
	if (!Number.isFinite(raw)) return DEFAULT_LOOP_COUNT
	return Math.min(Math.max(Math.floor(raw), MIN_LOOP_COUNT), MAX_LOOP_COUNT)
}

function LoopIcon({ size = 14, className }: { size?: number; className?: string }) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden
		>
			<path d="M17 1l4 4-4 4" />
			<path d="M3 11V9a4 4 0 0 1 4-4h14" />
			<path d="M7 23l-4-4 4-4" />
			<path d="M21 13v2a4 4 0 0 1-4 4H3" />
		</svg>
	)
}

export function LoopCountSelect() {
	const router = useRouter()
	const value = decodeLoopCount(router.query.loopCount)

	const onChange = (next: string) => {
		const n = Number(next)
		void pushYieldsQuery(router, { loopCount: n === DEFAULT_LOOP_COUNT ? undefined : String(n) })
	}

	return (
		<Tooltip content={LOOP_HELP}>
			<Select
				allValues={LOOP_OPTIONS}
				selectedValues={String(value)}
				setSelectedValues={onChange}
				label={
					<span className="flex items-center gap-1.5">
						<LoopIcon size={14} className="shrink-0 text-secondary" />
						<span className="text-primary">{value}</span>
						<span className="text-secondary">loop{value === 1 ? '' : 's'}</span>
					</span>
				}
				labelType="none"
				variant="default"
				size="md"
			/>
		</Tooltip>
	)
}
