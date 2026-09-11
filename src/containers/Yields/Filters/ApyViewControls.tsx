import { useRouter } from 'next/router'
import * as React from 'react'
import { Button } from '~/ui/Button'
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

const WINDOW_OPTIONS: Array<{ value: ApyWindow; label: string; tip: string }> = [
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
				<Skeleton className="h-8 w-12" />
				<Skeleton className="h-8 w-40" />
				<Skeleton className="h-8 w-32" />
			</div>
		)
	}

	return (
		<div className="flex flex-wrap items-center gap-2" role="group" aria-label="APY view">
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
