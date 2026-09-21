import { REWARDS_EXPERIMENT_ID, type ABGroup } from '~/utils/abTesting'
import { trackUmamiEvent, UMAMI_READY_EVENT } from './umami'

export const REWARDS_EVENTS = {
	FILTER_STATUS: 'rewards-filter-status',
	FILTER_REWARD_TYPE: 'rewards-filter-reward-type',
	FILTER_HIDE_UNVERIFIED: 'rewards-filter-hide-unverified',
	FILTER_RESET: 'rewards-filter-reset',
	SEARCH: 'rewards-search',
	TABLE_SORT: 'rewards-table-sort',
	ROW_EXPAND: 'rewards-row-expand',
	PROTOCOL_CLICK: 'rewards-protocol-click',
	SUBMIT_CLICK: 'rewards-submit-click'
} as const

type RewardsEventName = (typeof REWARDS_EVENTS)[keyof typeof REWARDS_EVENTS]

type RewardsEventData = { variant: ABGroup } & Record<string, string | number | boolean | null>

// Interactions before the lazy Umami script loads wait here; the script's ready event flushes them in order.
const pending: Array<{ eventName: RewardsEventName; data: RewardsEventData }> = []

function flushPending() {
	for (const event of pending) trackUmamiEvent(event.eventName, event.data)
	pending.length = 0
}

/** Umami attributes an event to the page current at send time, so leaving Rewards before ready drops the queue. */
export function discardPendingRewardsEvents() {
	pending.length = 0
	window.removeEventListener(UMAMI_READY_EVENT, flushPending)
}

export function trackRewardsEvent(eventName: RewardsEventName, data: RewardsEventData): void {
	const payload = { ...data, experiment: REWARDS_EXPERIMENT_ID }
	if (window.umami) {
		trackUmamiEvent(eventName, payload)
		return
	}
	if (pending.length === 0) window.addEventListener(UMAMI_READY_EVENT, flushPending, { once: true })
	pending.push({ eventName, data: payload })
}
