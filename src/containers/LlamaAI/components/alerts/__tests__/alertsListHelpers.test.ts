import { describe, expect, it } from 'vitest'
import {
	execChipLabel,
	execChipTone,
	ALERT_EMPTY_STATE_CHIPS,
	ALERT_ESCAPE_HATCH_PREFILL,
	formatPriceAlertSummary,
	formatTokenLabel,
	getPriceAlertState,
	isAlertsUpsellActive,
	isFiredOneTimePriceAlert
} from '~/containers/LlamaAI/components/alerts/alertsListHelpers'
import type { Alert, PriceTrigger } from '~/containers/LlamaAI/components/alerts/types'

describe('isAlertsUpsellActive', () => {
	it('is inactive when usage is undefined or null (cap unknown)', () => {
		expect(isAlertsUpsellActive(undefined)).toBe(false)
		expect(isAlertsUpsellActive(null)).toBe(false)
	})

	it('is inactive when allowed is true', () => {
		expect(isAlertsUpsellActive({ count: 1, cap: 3, allowed: true })).toBe(false)
	})

	it('is active only when allowed is explicitly false', () => {
		expect(isAlertsUpsellActive({ count: 3, cap: 3, allowed: false })).toBe(true)
	})
})

describe('getPriceAlertState', () => {
	it('is armed when enabled and armed is true', () => {
		expect(getPriceAlertState(true, true, true, 0)).toBe('armed')
	})

	it('defaults to armed when the armed field is absent (legacy alerts)', () => {
		expect(getPriceAlertState(true, undefined, true, 0)).toBe('armed')
	})

	it('is waiting to re-arm when enabled but not armed', () => {
		expect(getPriceAlertState(true, false, true, 0)).toBe('waiting to re-arm')
	})

	it('is fired when disabled, one-time (recurring=false), and it has actually run', () => {
		expect(getPriceAlertState(false, false, false, 1)).toBe('fired')
	})

	it('is paused (not fired) when disabled and one-time but it never ran (manually paused pre-fire)', () => {
		expect(getPriceAlertState(false, false, false, 0)).toBe('paused')
	})

	it('is paused when disabled and recurring (or recurring unknown), regardless of run_count', () => {
		expect(getPriceAlertState(false, false, true, 1)).toBe('paused')
		expect(getPriceAlertState(false, false, undefined, 1)).toBe('paused')
	})
})

describe('formatPriceAlertSummary', () => {
	const oneTimeFired: PriceTrigger = {
		type: 'price',
		token_nk: 'coingecko:bitcoin',
		op: 'below',
		value: 70000,
		recurring: false
	}
	const recurringArmed: PriceTrigger = {
		type: 'price',
		token_nk: 'coingecko:ethereum',
		op: 'above',
		value: 3000,
		recurring: true
	}

	it('formats a fired one-time alert with the exact brief example', () => {
		expect(formatPriceAlertSummary(oneTimeFired, false, false, 1)).toBe('BITCOIN below $70,000 · one-time · fired')
	})

	it('omits the one-time segment for recurring alerts', () => {
		expect(formatPriceAlertSummary(recurringArmed, true, true, 0)).toBe('ETHEREUM above $3,000 · armed')
	})

	it('keeps sub-dollar thresholds readable instead of collapsing them to $0', () => {
		const tiny: PriceTrigger = {
			type: 'price',
			token_nk: 'coingecko:pepe',
			op: 'above',
			value: 0.00001235,
			recurring: false
		}
		expect(formatPriceAlertSummary(tiny, true, true, 0)).toBe('PEPE above $0.00001235 · one-time · armed')
	})

	it('shows waiting to re-arm for an enabled-but-unarmed recurring alert', () => {
		expect(formatPriceAlertSummary(recurringArmed, true, false, 0)).toBe('ETHEREUM above $3,000 · waiting to re-arm')
	})

	it('shows paused for a manually disabled recurring alert', () => {
		expect(formatPriceAlertSummary(recurringArmed, false, false, 3)).toBe('ETHEREUM above $3,000 · paused')
	})

	it('shows paused (not fired) for a one-time alert manually paused before it ever ran', () => {
		expect(formatPriceAlertSummary(oneTimeFired, false, false, 0)).toBe('BITCOIN below $70,000 · one-time · paused')
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

	it('is true for a disabled one-time price alert', () => {
		const alert: Alert = { ...base, trigger: { type: 'price', token_nk: 'x', op: 'below', value: 1, recurring: false } }
		expect(isFiredOneTimePriceAlert(alert)).toBe(true)
	})

	it('is false when the alert is still enabled', () => {
		const alert: Alert = {
			...base,
			enabled: true,
			trigger: { type: 'price', token_nk: 'x', op: 'below', value: 1, recurring: false }
		}
		expect(isFiredOneTimePriceAlert(alert)).toBe(false)
	})

	it('is false for a disabled recurring price alert (that is just paused)', () => {
		const alert: Alert = { ...base, trigger: { type: 'price', token_nk: 'x', op: 'below', value: 1, recurring: true } }
		expect(isFiredOneTimePriceAlert(alert)).toBe(false)
	})

	it('is false for a disabled schedule alert (no trigger)', () => {
		expect(isFiredOneTimePriceAlert(base)).toBe(false)
	})

	it('is false for a one-time price alert manually paused before it ever ran (run_count=0)', () => {
		const alert: Alert = {
			...base,
			run_count: 0,
			trigger: { type: 'price', token_nk: 'x', op: 'below', value: 1, recurring: false }
		}
		expect(isFiredOneTimePriceAlert(alert)).toBe(false)
	})
})

describe('ALERT_EMPTY_STATE_CHIPS', () => {
	it('has exactly the two DB-verified static chips from the brief', () => {
		expect(ALERT_EMPTY_STATE_CHIPS).toEqual([
			{ text: 'Daily brief on Hyperliquid, Solana and stablecoins, every morning', variant: 'static' },
			{ text: 'Ping me if ETH drops below $3,000', variant: 'static' }
		])
	})
})

describe('ALERT_ESCAPE_HATCH_PREFILL', () => {
	it('is the exact prefill copy with a trailing space for the cursor', () => {
		expect(ALERT_ESCAPE_HATCH_PREFILL).toBe('Set up an alert: ')
	})
})

describe('formatTokenLabel', () => {
	it('strips the source prefix and uppercases the symbol', () => {
		expect(formatTokenLabel('coingecko:bitcoin')).toBe('BITCOIN')
	})

	it('turns dashes into spaces', () => {
		expect(formatTokenLabel('coingecko:usd-coin')).toBe('USD COIN')
	})

	it('falls back to the raw value when there is no prefix', () => {
		expect(formatTokenLabel('eth')).toBe('ETH')
	})
})

describe('execChipTone / execChipLabel', () => {
	it('keeps success and legacy test rows green', () => {
		expect(execChipTone('success', false)).toBe('success')
		expect(execChipTone('test', false)).toBe('success')
	})

	it('colors delivery_test by whether it actually delivered', () => {
		expect(execChipTone('delivery_test', false)).toBe('success')
		expect(execChipTone('delivery_test', true)).toBe('error')
	})

	it('keeps real failures red and labels test pings in user language', () => {
		expect(execChipTone('error', true)).toBe('error')
		expect(execChipLabel('delivery_test')).toBe('test ping')
		expect(execChipLabel('success')).toBe('success')
	})
})
