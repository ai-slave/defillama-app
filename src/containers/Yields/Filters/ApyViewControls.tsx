import { useRouter } from 'next/router'
import * as React from 'react'
import { Button } from '~/ui/Button'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { trackYieldsEvent, YIELDS_EVENTS } from '~/utils/analytics/yields'
import type { ApyWindow } from '../data/types'
import { pushYieldsQuery } from '../queryUpdates.client'
import { HelpDefs, HelpIcon } from './ui'

// URL-param-driven APY view toggle for the /yields page. Pushes `apyWindow` and
// `apyComponents` router query params (shallow); `useYieldsServerTable` forwards the
// whole router query to the earn route, which recomputes resolvedApy / sparkline /
// stability server-side. Defaults (current window, base+reward) push NO params so
// URLs stay clean and the request stays byte-identical to the no-toggle baseline.

const WINDOW_OPTIONS: { value: ApyWindow; label: string; tip: string }[] = [
	{ value: 'current', label: 'Now', tip: 'Latest snapshot' },
	{ value: 'avg_7d', label: '7d', tip: '7-day average' },
	{ value: 'avg_30d', label: '30d', tip: '30-day average' }
]

const APY_HELP = (
	<HelpDefs
		items={[
			{ id: 'base', term: 'Base', def: 'Real yield. Always included.' },
			{ id: 'reward', term: '+ Reward', def: 'Token incentives.' },
			{ id: 'intrinsic', term: '+ Intrinsic', def: 'Yield embedded in the asset itself (e.g. LST rebases).' },
			{
				id: 'window',
				term: 'Now / 7d / 30d',
				def: 'The window: latest snapshot, 7-day average, or 30-day average.'
			}
		]}
	/>
)

function readSingle(value: string | string[] | undefined): string | undefined {
	return Array.isArray(value) ? value[0] : value
}

// Mirror the server's parseApyWindow default ('current').
function decodeWindow(value: string | string[] | undefined): ApyWindow {
	const raw = readSingle(value)
	return raw === 'avg_7d' || raw === 'avg_30d' ? raw : 'current'
}

// Mirror the server's parseApyComponents: absent → base+reward.
function decodeComponents(value: string | string[] | undefined): { reward: boolean; intrinsic: boolean } {
	const raw = readSingle(value)
	if (raw == null) return { reward: true, intrinsic: false }
	const parts = raw.split(',').map((part) => part.trim())
	return { reward: parts.includes('reward'), intrinsic: parts.includes('intrinsic') }
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

function encodeComponents(reward: boolean, intrinsic: boolean): string | undefined {
	if (reward && !intrinsic) return undefined
	const parts: string[] = []
	if (reward) parts.push('reward')
	if (intrinsic) parts.push('intrinsic')
	return parts.length ? parts.join(',') : 'base'
}

export function ApyViewControls() {
	const router = useRouter()
	const window = decodeWindow(router.query.apyWindow)
	const { reward, intrinsic } = decodeComponents(router.query.apyComponents)

	const setWindow = (next: ApyWindow) => {
		if (next !== window) trackYieldsEvent(YIELDS_EVENTS.APY_WINDOW, { window: next })
		void pushYieldsQuery(router, { apyWindow: next === 'current' ? undefined : next })
	}
	const toggleReward = () => {
		trackYieldsEvent(YIELDS_EVENTS.APY_COMPONENT_TOGGLE, {
			component: 'reward',
			enabled: !reward,
			view: describeComponents(!reward, intrinsic)
		})
		void pushYieldsQuery(router, { apyComponents: encodeComponents(!reward, intrinsic) })
	}
	const toggleIntrinsic = () => {
		trackYieldsEvent(YIELDS_EVENTS.APY_COMPONENT_TOGGLE, {
			component: 'intrinsic',
			enabled: !intrinsic,
			view: describeComponents(reward, !intrinsic)
		})
		void pushYieldsQuery(router, { apyComponents: encodeComponents(reward, !intrinsic) })
	}

	return (
		<div className="flex flex-wrap items-center gap-2" role="group" aria-label="APY view">
			<span className="flex shrink-0 items-center gap-1 label-md text-secondary">
				APY
				<HelpIcon content={APY_HELP} label="About APY metric" />
			</span>
			<div className="flex items-center gap-1.5">
				<ComponentToggle label="Reward" active={reward} onClick={toggleReward} />
				<ComponentToggle label="Intrinsic" active={intrinsic} onClick={toggleIntrinsic} />
			</div>
			<span className="mx-0.5 h-5 w-px bg-border-medium" aria-hidden />
			<SegmentedControl
				value={window}
				onValueChange={setWindow}
				options={WINDOW_OPTIONS.map((option) => ({ ...option, tooltip: option.tip }))}
				label="APY window"
				variant="default"
				size="md"
			/>
		</div>
	)
}

function ComponentToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
	return (
		<Button type="button" variant="toggle" size="md" aria-pressed={active} data-active={active} onClick={onClick}>
			<span aria-hidden className="opacity-70">
				+
			</span>
			{label}
		</Button>
	)
}
