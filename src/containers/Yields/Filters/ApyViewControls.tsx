import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { Button } from '~/ui/Button'
import { Checkbox } from '~/ui/Checkbox'
import { DrawerDismiss, PopoverSurface } from '~/ui/PopoverSurface'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { Skeleton } from '~/ui/Skeleton'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import { readSingleQueryValue } from '~/utils/routerQuery'
import type { ApyWindow } from '../data/types'
import { pushYieldsQuery } from '../queryUpdates.client'
import { APY_COMPONENTS_PREF, APY_WINDOW_PREF, writeStickyPref } from '../stickyQueryPrefs'
import { HelpDefs, HelpIcon } from './ui'

// URL-param-driven APY view toggle for the /yields page. Pushes `apyWindow` and
// `apyComponents` router query params (shallow); `useYieldsServerTable` forwards the
// whole router query to the earn route, which recomputes resolvedApy / sparkline /
// stability server-side. Defaults (current window, base+reward) push NO params so
// URLs stay clean and the request stays byte-identical to the no-toggle baseline.
//
// Inline dials from `sm` up; below that one trigger opening a sheet with the same controls.

const WINDOW_OPTIONS: Array<{ value: ApyWindow; label: string; tooltip: string }> = [
	{ value: 'current', label: 'Now', tooltip: 'Latest snapshot' },
	{ value: 'avg_7d', label: '7d', tooltip: '7-day average' },
	{ value: 'avg_30d', label: '30d', tooltip: '30-day average' }
]

const WINDOW_LABELS: Record<ApyWindow, string> = { current: 'Now', avg_7d: '7d', avg_30d: '30d' }

// The sheet prints the definition under the control, so a tooltip there is just noise.
const WINDOW_OPTIONS_PLAIN = WINDOW_OPTIONS.map(({ value, label }) => ({ value, label }))

const APY_DEFS = {
	base: 'Real yield. Always included.',
	reward: 'Token incentives.',
	intrinsic: 'Yield embedded in the asset itself (e.g. LST rebases).',
	window: 'The window: latest snapshot, 7-day average, or 30-day average.'
} as const

const APY_HELP = (
	<HelpDefs
		items={[
			{ id: 'base', term: 'Base', def: APY_DEFS.base },
			{ id: 'reward', term: '+ Reward', def: APY_DEFS.reward },
			{ id: 'intrinsic', term: '+ Intrinsic', def: APY_DEFS.intrinsic },
			{ id: 'window', term: 'Now / 7d / 30d', def: APY_DEFS.window }
		]}
	/>
)

// Mirror the server's parseApyWindow default ('current').
function decodeWindow(value: string | Array<string> | undefined): ApyWindow {
	const raw = readSingleQueryValue(value)
	return raw === 'avg_7d' || raw === 'avg_30d' ? raw : 'current'
}

// Mirror the server's parseApyComponents: absent → base+reward.
function decodeComponents(value: string | Array<string> | undefined): { reward: boolean; intrinsic: boolean } {
	const raw = readSingleQueryValue(value)
	if (raw == null) return { reward: true, intrinsic: false }
	const parts = new Set(raw.split(',').map((part) => part.trim()))
	return { reward: parts.has('reward'), intrinsic: parts.has('intrinsic') }
}

// Encode back to the `apyComponents` param. Base is always implied. The default
// (reward on, intrinsic off) returns undefined so the param is dropped; base-only
// (both off) uses a `base` sentinel so the server doesn't fall back to its reward
// default.
// Analytics label for the resulting composition (base is always included).
function describeComponents(reward: boolean, intrinsic: boolean): string {
	let view = 'base'
	if (reward) view += '+reward'
	if (intrinsic) view += '+intrinsic'
	return view
}

// Omit base+reward; use 'base' when both toggles are off.
function encodeComponents(reward: boolean, intrinsic: boolean): string | undefined {
	if (reward && !intrinsic) return undefined
	const parts: Array<string> = []
	if (reward) parts.push('reward')
	if (intrinsic) parts.push('intrinsic')
	return parts.length > 0 ? parts.join(',') : 'base'
}

// Base + reward. Anything else brands the trigger; the sheet and its accessible name say what.
function isDefaultComposition(reward: boolean, intrinsic: boolean): boolean {
	return reward && !intrinsic
}

export function ApyViewControls({ ready = true }: { ready?: boolean }) {
	const router = useRouter()
	const window = decodeWindow(router.query.apyWindow)
	const { reward, intrinsic } = decodeComponents(router.query.apyComponents)

	// Write storage before navigation to prevent restoring the previous choice.
	const setWindow = (next: ApyWindow) => {
		if (next !== window) trackYieldsEvent(YIELDS_EVENTS.APY_WINDOW, { window: next })
		const apyWindow = next === 'current' ? undefined : next
		writeStickyPref(APY_WINDOW_PREF, apyWindow)
		void pushYieldsQuery(router, { apyWindow })
	}
	const toggleComponent = (component: 'reward' | 'intrinsic') => {
		const nextReward = component === 'reward' ? !reward : reward
		const nextIntrinsic = component === 'intrinsic' ? !intrinsic : intrinsic
		trackYieldsEvent(YIELDS_EVENTS.APY_COMPONENT_TOGGLE, {
			component,
			enabled: component === 'reward' ? nextReward : nextIntrinsic,
			view: describeComponents(nextReward, nextIntrinsic)
		})
		const apyComponents = encodeComponents(nextReward, nextIntrinsic)
		writeStickyPref(APY_COMPONENTS_PREF, apyComponents)
		void pushYieldsQuery(router, { apyComponents })
	}

	if (!ready) {
		return (
			<div role="status" aria-label="Loading APY preferences" className="flex flex-wrap items-center gap-2">
				<Skeleton className="hidden h-8 w-12 sm:block" />
				<Skeleton className="hidden h-8 w-40 sm:block" />
				<Skeleton className="hidden h-8 w-32 sm:block" />
				<Skeleton className="h-8 w-24 sm:hidden" />
			</div>
		)
	}

	return (
		<>
			<div className="hidden flex-wrap items-center gap-2 sm:flex" role="group" aria-label="APY view">
				<span className="flex shrink-0 items-center gap-1 label-md text-secondary">
					APY
					<HelpIcon content={APY_HELP} label="About APY metric" />
				</span>
				<div className="flex items-center gap-1.5">
					<ComponentToggle label="Reward" active={reward} onClick={() => toggleComponent('reward')} />
					<ComponentToggle label="Intrinsic" active={intrinsic} onClick={() => toggleComponent('intrinsic')} />
				</div>
				<span className="mx-0.5 h-5 w-px bg-border-medium" aria-hidden />
				<SegmentedControl
					value={window}
					onValueChange={setWindow}
					options={WINDOW_OPTIONS}
					label="APY window"
					variant="default"
					size="md"
				/>
			</div>

			<ApyViewSheet
				window={window}
				reward={reward}
				intrinsic={intrinsic}
				onWindowChange={setWindow}
				onToggleComponent={toggleComponent}
			/>
		</>
	)
}

function ApyViewSheet({
	window,
	reward,
	intrinsic,
	onWindowChange,
	onToggleComponent
}: {
	window: ApyWindow
	reward: boolean
	intrinsic: boolean
	onWindowChange: (next: ApyWindow) => void
	onToggleComponent: (component: 'reward' | 'intrinsic') => void
}) {
	const isDefault = isDefaultComposition(reward, intrinsic)
	const spoken = `Base${reward ? ' plus reward' : ''}${intrinsic ? ' plus intrinsic' : ''}`

	return (
		<Ariakit.PopoverProvider placement="bottom-start">
			<Ariakit.PopoverDisclosure
				render={<Button type="button" variant={isDefault ? 'secondary' : 'outline'} size="md" className="sm:hidden" />}
			>
				<span className={isDefault ? 'text-secondary' : undefined}>APY</span>
				<span>{WINDOW_LABELS[window]}</span>
				<span className="sr-only">view settings: {spoken}</span>
				<Ariakit.PopoverDisclosureArrow className="size-4 shrink-0 text-tertiary" />
			</Ariakit.PopoverDisclosure>
			<PopoverSurface variant="panel" dismiss="own" overflowPadding={16} width="lg">
				<div className="flex items-center justify-between gap-2 border-b border-subtle py-1 pr-1 pl-4">
					<Ariakit.PopoverHeading className="label-md text-primary">APY view</Ariakit.PopoverHeading>
					<DrawerDismiss label="Close APY view" />
				</div>

				<div className="flex flex-col gap-1 p-2">
					<span className="px-3 pt-1 label-sm text-secondary uppercase">Composition</span>
					<div className="flex items-center justify-between gap-4 px-3 py-2">
						<span className="flex min-w-0 flex-col gap-0.5">
							<span className="label-md text-primary">Base</span>
							<span className="body-sm text-secondary">{APY_DEFS.base}</span>
						</span>
						<span className="shrink-0 label-sm text-tertiary">Always on</span>
					</div>
					<ComponentRow
						label="Reward"
						definition={APY_DEFS.reward}
						checked={reward}
						onChange={() => onToggleComponent('reward')}
					/>
					<ComponentRow
						label="Intrinsic"
						definition={APY_DEFS.intrinsic}
						checked={intrinsic}
						onChange={() => onToggleComponent('intrinsic')}
					/>
				</div>

				<div className="flex flex-col gap-2 border-t border-subtle p-3">
					<span className="px-1 label-sm text-secondary uppercase">Window</span>
					<SegmentedControl
						value={window}
						onValueChange={onWindowChange}
						options={WINDOW_OPTIONS_PLAIN}
						label="APY window"
						variant="responsive"
						size="md"
					/>
					<span className="px-1 body-sm text-secondary">{APY_DEFS.window}</span>
				</div>
			</PopoverSurface>
		</Ariakit.PopoverProvider>
	)
}

function ComponentRow({
	label,
	definition,
	checked,
	onChange
}: {
	label: string
	definition: string
	checked: boolean
	onChange: () => void
}) {
	return (
		<Checkbox variant="filter-borderless" checked={checked} onChange={onChange}>
			<span className="flex min-w-0 flex-col gap-0.5 text-left">
				<span className="label-md text-primary">{label}</span>
				<span className="body-sm text-secondary">{definition}</span>
			</span>
		</Checkbox>
	)
}

function ComponentToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
	return (
		<Button type="button" variant="toggle" size="md" aria-pressed={active} data-active={active} onClick={onClick}>
			<span aria-hidden className="text-tertiary">
				+
			</span>
			{label}
		</Button>
	)
}
