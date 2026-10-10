import { describe, expect, test } from 'vitest'
import {
	execBadgeLabel,
	execBadgeStatus,
	applyAlertUpdateToList,
	formatPriceAlertSummary,
	formatTokenLabel,
	getPriceAlertState,
	getAlertsAccessState,
	isAlertsUpsellActive,
	isFiredOneTimePriceAlert
} from '~/containers/LlamaAI/components/alerts/alertsListHelpers'
import type { Alert, PriceTrigger } from '~/containers/LlamaAI/components/alerts/types'

describe('getAlertsAccessState', () => {
	test('waits for authentication before choosing a view', () => {
		expect(getAlertsAccessState(false, true)).toBe('loading')
	})

	test('gates anonymous users', () => {
		expect(getAlertsAccessState(false, false)).toBe('sign-in')
	})

	test('keeps authenticated users in the alerts flow', () => {
		expect(getAlertsAccessState(true, false)).toBe('ready')
	})
})

describe('isAlertsUpsellActive', () => {
	test('is inactive when usage is undefined or null (cap unknown)', () => {
		expect(isAlertsUpsellActive(undefined)).toBe(false)
		expect(isAlertsUpsellActive(null)).toBe(false)
	})

	test('is inactive when allowed is true', () => {
		expect(isAlertsUpsellActive({ count: 1, cap: 3, allowed: true })).toBe(false)
	})

	test('is active only when allowed is explicitly false', () => {
		expect(isAlertsUpsellActive({ count: 3, cap: 3, allowed: false })).toBe(true)
	})
})

describe('getPriceAlertState', () => {
	test('is armed when enabled and armed is true', () => {
		expect(getPriceAlertState(true, true, true, 0)).toBe('armed')
	})

	test('defaults to armed when the armed field is absent (legacy alerts)', () => {
		expect(getPriceAlertState(true, undefined, true, 0)).toBe('armed')
	})

	test('is waiting to re-arm when enabled but not armed', () => {
		expect(getPriceAlertState(true, false, true, 0)).toBe('waiting to re-arm')
	})

	test('is fired when disabled, one-time (recurring=false), and it has actually run', () => {
		expect(getPriceAlertState(false, false, false, 1)).toBe('fired')
	})

	test('is paused (not fired) when disabled and one-time but it never ran (manually paused pre-fire)', () => {
		expect(getPriceAlertState(false, false, false, 0)).toBe('paused')
	})

	test('is paused when disabled and recurring (or recurring unknown), regardless of run_count', () => {
		expect(getPriceAlertState(false, false, true, 1)).toBe('paused')
		expect(getPriceAlertState(false, false, undefined, 1)).toBe('paused')
	})
})

describe('formatPriceAlertSummary', () => {
	const oneTimeFired: PriceTrigger = {
		type: 'price',
		token_nk: 'coingecko:bitcoin',
		op: 'below',
		value: 70_000,
		recurring: false
	}
	const recurringArmed: PriceTrigger = {
		type: 'price',
		token_nk: 'coingecko:ethereum',
		op: 'above',
		value: 3000,
		recurring: true
	}

	test('formats a fired one-time alert with the exact brief example', () => {
		expect(formatPriceAlertSummary(oneTimeFired, false, false, 1)).toBe('BITCOIN below $70,000 · one-time · fired')
	})

	test('omits the one-time segment for recurring alerts', () => {
		expect(formatPriceAlertSummary(recurringArmed, true, true, 0)).toBe('ETHEREUM above $3,000 · armed')
	})

	test('keeps sub-dollar thresholds readable instead of collapsing them to $0', () => {
		const tiny: PriceTrigger = {
			type: 'price',
			token_nk: 'coingecko:pepe',
			op: 'above',
			value: 0.00001235,
			recurring: false
		}
		expect(formatPriceAlertSummary(tiny, true, true, 0)).toBe('PEPE above $0.00001235 · one-time · armed')
	})
})

describe('isFiredOneTimePriceAlert', () => {
	const base: Alert = {
		id: 'a1',
		title: 'BTC drop',
		original_query: '',
		schedule_expression: '',
		next_run_at: '',
		last_run_at: null,
		last_run_status: null,
		enabled: false,
		run_count: 1,
		created_at: ''
	}

	test('is true for a disabled one-time price alert', () => {
		const alert: Alert = { ...base, trigger: { type: 'price', token_nk: 'x', op: 'below', value: 1, recurring: false } }
		expect(isFiredOneTimePriceAlert(alert)).toBe(true)
	})

	test('is false when the alert is still enabled', () => {
		const alert: Alert = {
			...base,
			enabled: true,
			trigger: { type: 'price', token_nk: 'x', op: 'below', value: 1, recurring: false }
		}
		expect(isFiredOneTimePriceAlert(alert)).toBe(false)
	})

	test('is false for a disabled recurring price alert (that is just paused)', () => {
		const alert: Alert = { ...base, trigger: { type: 'price', token_nk: 'x', op: 'below', value: 1, recurring: true } }
		expect(isFiredOneTimePriceAlert(alert)).toBe(false)
	})

	test('is false for a disabled schedule alert (no trigger)', () => {
		expect(isFiredOneTimePriceAlert(base)).toBe(false)
	})

	test('is false for a one-time price alert manually paused before it ever ran (run_count=0)', () => {
		const alert: Alert = {
			...base,
			run_count: 0,
			trigger: { type: 'price', token_nk: 'x', op: 'below', value: 1, recurring: false }
		}
		expect(isFiredOneTimePriceAlert(alert)).toBe(false)
	})
})

describe('formatTokenLabel', () => {
	test('strips the source prefix and uppercases the symbol', () => {
		expect(formatTokenLabel('coingecko:bitcoin')).toBe('BITCOIN')
	})

	test('turns dashes into spaces', () => {
		expect(formatTokenLabel('coingecko:usd-coin')).toBe('USD COIN')
	})

	test('falls back to the raw value when there is no prefix', () => {
		expect(formatTokenLabel('eth')).toBe('ETH')
	})
})

describe('applyAlertUpdateToList', () => {
	const alert: Alert = {
		id: 'alert-1',
		title: 'Old title',
		original_query: '',
		schedule_expression: 'Daily at 9:00 UTC',
		next_run_at: '',
		last_run_at: null,
		last_run_status: null,
		enabled: true,
		run_count: 0,
		created_at: '',
		delivery_channel: 'email'
	}

	test('applies a price trigger and Slack destination in one cache transition', () => {
		const trigger: PriceTrigger = {
			type: 'price',
			token_nk: 'coingecko:ethereum',
			op: 'below',
			value: 3000,
			recurring: false
		}
		const [updated] = applyAlertUpdateToList(
			[alert],
			{
				alertId: alert.id,
				title: 'ETH below $3,000',
				delivery_channel: 'slack',
				condition: '',
				trigger,
				slack_team_id: 'team-1',
				slack_channel_id: 'channel-1',
				slack_channel_name: 'alerts'
			},
			{ shouldInclude: false, value: null }
		)

		expect(updated).toMatchObject({
			title: 'ETH below $3,000',
			trigger,
			delivery_channel: 'slack',
			slack_team_id: 'team-1',
			slack_channel_id: 'channel-1',
			slack_channel_name: 'alerts'
		})
		expect(updated.schedule_expression).toBe(alert.schedule_expression)
	})

	test('updates schedule and condition without adding a price trigger', () => {
		const [updated] = applyAlertUpdateToList(
			[alert],
			{
				alertId: alert.id,
				title: 'Weekly report',
				alertConfig: { frequency: 'weekly', hour: 14, dayOfWeek: 3, timezone: 'UTC' },
				delivery_channel: 'email',
				condition: 'TVL below $1B'
			},
			{ shouldInclude: true, value: 'TVL below $1B' }
		)

		expect(updated).toMatchObject({
			title: 'Weekly report',
			schedule_expression: 'Weekly on Wednesday at 14:00 UTC',
			delivery_channel: 'email',
			condition: 'TVL below $1B'
		})
		expect(updated.trigger).toBeUndefined()
	})
})

describe('execBadgeStatus / execBadgeLabel', () => {
	test('marks success and legacy test rows good', () => {
		expect(execBadgeStatus('success', false)).toBe('good')
		expect(execBadgeStatus('test', false)).toBe('good')
	})

	test('marks delivery_test by whether it actually delivered', () => {
		expect(execBadgeStatus('delivery_test', false)).toBe('good')
		expect(execBadgeStatus('delivery_test', true)).toBe('bad')
	})

	test('marks real failures bad and labels test pings in user language', () => {
		expect(execBadgeStatus('error', true)).toBe('bad')
		expect(execBadgeLabel('delivery_test')).toBe('Test ping')
		expect(execBadgeLabel('success')).toBe('Success')
	})
})
