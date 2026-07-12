import { describe, expect, it } from 'vitest'
import {
	ALERT_PROMPT_SUGGESTIONS,
	buildArtifactSaveBody,
	buildCreateAlertBody,
	buildJustAskExample,
	buildScheduleExpressionRaw,
	deriveAlertTitle,
	formatNextRunAt,
	formatPriceDisplay,
	formatPriceLabel,
	getArtifactSubtitle,
	getDeliveryBlockReason,
	getDeliveryReadinessBlock,
	getPriceCaption,
	getSubmitBlockReason,
	getUpsellCopy,
	isAlertCapReachedError,
	normalizePriceInput,
	roundPriceValue,
	validatePriceTrigger,
	validatePrompt
} from '~/containers/LlamaAI/components/alerts/createAlertForm'

describe('validatePrompt', () => {
	it('requires a prompt for schedule alerts', () => {
		expect(validatePrompt('schedule', '')).toBe('Describe what the report should cover')
		expect(validatePrompt('schedule', '   ')).toBe('Describe what the report should cover')
	})

	it('allows an empty prompt for price alerts', () => {
		expect(validatePrompt('price', '')).toBeNull()
	})

	it('accepts a non-empty prompt for either trigger type', () => {
		expect(validatePrompt('schedule', 'Aave V3 TVL and its top pools')).toBeNull()
		expect(validatePrompt('price', 'Aave V3 TVL and its top pools')).toBeNull()
	})
})

describe('validatePriceTrigger', () => {
	it('requires a token to be picked', () => {
		expect(validatePriceTrigger({ tokenNk: null, value: '100' })).toBe('Pick a token')
	})

	it('requires a numeric value', () => {
		expect(validatePriceTrigger({ tokenNk: 'coingecko:aave', value: '' })).toBe('Enter a price')
		expect(validatePriceTrigger({ tokenNk: 'coingecko:aave', value: 'abc' })).toBe('Enter a price')
	})

	it('rejects zero or negative values', () => {
		expect(validatePriceTrigger({ tokenNk: 'coingecko:aave', value: '0' })).toBe('Price must be greater than 0')
		expect(validatePriceTrigger({ tokenNk: 'coingecko:aave', value: '-5' })).toBe('Price must be greater than 0')
	})

	it('passes for a valid token and positive value', () => {
		expect(validatePriceTrigger({ tokenNk: 'coingecko:aave', value: '100' })).toBeNull()
	})
})

describe('getDeliveryReadinessBlock', () => {
	it('blocks telegram when not linked', () => {
		expect(
			getDeliveryReadinessBlock({
				channel: 'telegram',
				telegramLinked: false,
				slackTeamId: '',
				slackWorkspaceCount: 0
			})
		).toEqual({ label: 'Link Telegram first' })
	})

	it('allows telegram when linked', () => {
		expect(
			getDeliveryReadinessBlock({
				channel: 'telegram',
				telegramLinked: true,
				slackTeamId: '',
				slackWorkspaceCount: 0
			})
		).toBeNull()
	})

	it('blocks slack when no workspace is connected', () => {
		expect(
			getDeliveryReadinessBlock({
				channel: 'slack',
				telegramLinked: false,
				slackTeamId: '',
				slackWorkspaceCount: 0
			})
		).toEqual({ label: 'Link Slack first' })
	})

	it('blocks slack when a workspace exists but none is picked', () => {
		expect(
			getDeliveryReadinessBlock({
				channel: 'slack',
				telegramLinked: false,
				slackTeamId: '',
				slackWorkspaceCount: 2
			})
		).toEqual({ label: 'Link Slack first' })
	})

	it('allows slack once a workspace is selected', () => {
		expect(
			getDeliveryReadinessBlock({
				channel: 'slack',
				telegramLinked: false,
				slackTeamId: 'team-1',
				slackWorkspaceCount: 1
			})
		).toBeNull()
	})

	it('never blocks email', () => {
		expect(
			getDeliveryReadinessBlock({ channel: 'email', telegramLinked: false, slackTeamId: '', slackWorkspaceCount: 0 })
		).toBeNull()
	})
})

describe('getSubmitBlockReason', () => {
	const baseDelivery = {
		channel: 'email' as const,
		telegramLinked: false,
		slackTeamId: '',
		slackChannelId: '',
		slackWorkspaceCount: 0
	}

	it('blocks a schedule alert with no prompt', () => {
		expect(
			getSubmitBlockReason({
				triggerType: 'schedule',
				prompt: '',
				price: { tokenNk: null, value: '' },
				delivery: baseDelivery
			})
		).toBe('Describe what the report should cover')
	})

	it('blocks a price alert with no token selected', () => {
		expect(
			getSubmitBlockReason({
				triggerType: 'price',
				prompt: '',
				price: { tokenNk: null, value: '100' },
				delivery: baseDelivery
			})
		).toBe('Pick a token')
	})

	it('blocks when the chosen delivery channel is not ready', () => {
		expect(
			getSubmitBlockReason({
				triggerType: 'price',
				prompt: '',
				price: { tokenNk: 'coingecko:aave', value: '100' },
				delivery: { ...baseDelivery, channel: 'telegram', telegramLinked: false }
			})
		).toBe('Link Telegram first')
	})

	it('blocks when slack channel is not picked even with a workspace selected', () => {
		expect(
			getSubmitBlockReason({
				triggerType: 'price',
				prompt: '',
				price: { tokenNk: 'coingecko:aave', value: '100' },
				delivery: {
					...baseDelivery,
					channel: 'slack',
					slackTeamId: 'team-1',
					slackChannelId: '',
					slackWorkspaceCount: 1
				}
			})
		).toBe('Pick a Slack channel')
	})

	it('returns null once everything is valid', () => {
		expect(
			getSubmitBlockReason({
				triggerType: 'price',
				prompt: '',
				price: { tokenNk: 'coingecko:aave', value: '100' },
				delivery: baseDelivery
			})
		).toBeNull()
	})
})

describe('formatPriceLabel', () => {
	it('caps prices at or above 10 to two decimals', () => {
		expect(formatPriceLabel(1774.35)).toBe('$1,774.35')
		expect(formatPriceLabel(100000)).toBe('$100,000')
		expect(formatPriceLabel(64110.82792502)).toBe('$64,110.83')
	})

	it('keeps sub-dollar precision instead of rounding it away', () => {
		expect(formatPriceLabel(0.5234)).toBe('$0.5234')
		expect(formatPriceLabel(0.00001234)).toBe('$0.00001234')
	})
})

describe('deriveAlertTitle', () => {
	it('derives a price title from token, direction and value', () => {
		expect(deriveAlertTitle({ triggerType: 'price', prompt: '', symbol: 'btc', op: 'above', value: '100000' })).toBe(
			'BTC above $100,000'
		)
	})

	it('falls back to a generic price title when the trigger is incomplete', () => {
		expect(deriveAlertTitle({ triggerType: 'price', prompt: '', symbol: null, op: 'above', value: '100' })).toBe(
			'Price alert'
		)
		expect(deriveAlertTitle({ triggerType: 'price', prompt: '', symbol: 'btc', op: 'above', value: '' })).toBe(
			'Price alert'
		)
	})

	it('derives a schedule title from the first line of the prompt', () => {
		expect(
			deriveAlertTitle({
				triggerType: 'schedule',
				prompt: 'Aave V3 TVL and its top pools\nwith extra detail',
				symbol: null,
				op: 'above',
				value: ''
			})
		).toBe('Aave V3 TVL and its top pools')
	})

	it('truncates long prompts and falls back when empty', () => {
		const long = 'a'.repeat(80)
		const derived = deriveAlertTitle({ triggerType: 'schedule', prompt: long, symbol: null, op: 'above', value: '' })
		expect(derived.length).toBeLessThanOrEqual(60)
		expect(derived.endsWith('…')).toBe(true)
		expect(deriveAlertTitle({ triggerType: 'schedule', prompt: '  ', symbol: null, op: 'above', value: '' })).toBe(
			'Scheduled report'
		)
	})
})

describe('isAlertCapReachedError', () => {
	it('detects the cap-hit sentinel message', () => {
		expect(isAlertCapReachedError(new Error('alert_cap_reached'))).toBe(true)
	})

	it('does not misclassify other errors', () => {
		expect(isAlertCapReachedError(new Error('bad trigger'))).toBe(false)
		expect(isAlertCapReachedError(new Error('Not authenticated'))).toBe(false)
		expect(isAlertCapReachedError('alert_cap_reached')).toBe(false)
		expect(isAlertCapReachedError(null)).toBe(false)
	})
})

describe('getUpsellCopy', () => {
	it('shows the exact usage fraction when known', () => {
		expect(getUpsellCopy({ count: 3, cap: 3, allowed: false })).toBe("You've used 3/3 alerts on your plan")
	})

	it('falls back to a generic message when usage data is unavailable', () => {
		expect(getUpsellCopy(null)).toBe("You've reached your alert limit on this plan")
		expect(getUpsellCopy({ count: 3, cap: null, allowed: true })).toBe("You've reached your alert limit on this plan")
	})
})

describe('formatNextRunAt', () => {
	const now = new Date('2026-07-09T12:00:00Z')

	it('labels a run later today as "today"', () => {
		expect(formatNextRunAt('2026-07-09T19:00:00Z', now)).toMatch(/^today /)
	})

	it('labels a run tomorrow as "tomorrow"', () => {
		expect(formatNextRunAt('2026-07-10T07:00:00Z', now)).toMatch(/^tomorrow /)
	})

	it('falls back to a short date for further-out runs', () => {
		expect(formatNextRunAt('2026-07-20T07:00:00Z', now)).toMatch(/^Jul 20/)
	})

	it('returns a safe fallback for an unparseable date', () => {
		expect(formatNextRunAt('not-a-date', now)).toBe('soon')
	})
})

describe('getPriceCaption', () => {
	it('describes the one-time trigger with the price formatted like every other surface', () => {
		expect(getPriceCaption('LINK', 'above', '100')).toBe('Fires once when LINK goes above $100')
		expect(getPriceCaption('BTC', 'below', '50000')).toBe('Fires once when BTC goes below $50,000')
	})

	it('leaves unparseable drafts as typed', () => {
		expect(getPriceCaption('BTC', 'below', '0')).toBe('Fires once when BTC goes below 0')
	})
})

describe('buildScheduleExpressionRaw', () => {
	it('builds a daily expression', () => {
		expect(buildScheduleExpressionRaw({ frequency: 'daily', hour: 9, dayOfWeek: 1, timezone: 'UTC' })).toBe(
			'Daily at 9:00 UTC'
		)
	})

	it('builds a weekly expression with the day name', () => {
		expect(buildScheduleExpressionRaw({ frequency: 'weekly', hour: 14, dayOfWeek: 3, timezone: 'UTC' })).toBe(
			'Weekly on Wednesday at 14:00 UTC'
		)
	})
})

describe('buildJustAskExample', () => {
	it('carries the typed prompt into a schedule prefill', () => {
		expect(
			buildJustAskExample({
				triggerType: 'schedule',
				frequency: 'weekly',
				prompt: '  Aave TVL and top pools  ',
				symbol: null,
				op: 'above',
				value: ''
			})
		).toBe('Set up a weekly alert: Aave TVL and top pools')
	})

	it('gives an open-ended schedule scaffold when no prompt is typed', () => {
		expect(
			buildJustAskExample({
				triggerType: 'schedule',
				frequency: 'daily',
				prompt: '',
				symbol: null,
				op: 'above',
				value: ''
			})
		).toBe('Set up a daily alert: ')
	})

	it('carries token/op/value into a price prefill', () => {
		expect(
			buildJustAskExample({
				triggerType: 'price',
				frequency: 'daily',
				prompt: '',
				symbol: 'aave',
				op: 'above',
				value: '100'
			})
		).toBe('Set up an alert: AAVE goes above $100')
	})

	it('scaffolds around the token when no level is set yet', () => {
		expect(
			buildJustAskExample({
				triggerType: 'price',
				frequency: 'daily',
				prompt: '',
				symbol: 'eth',
				op: 'below',
				value: ' '
			})
		).toBe('Set up a price alert for ETH: ')
	})

	it('falls back to a generic price scaffold with nothing picked', () => {
		expect(
			buildJustAskExample({
				triggerType: 'price',
				frequency: 'daily',
				prompt: '',
				symbol: null,
				op: 'below',
				value: ''
			})
		).toBe('Set up a price alert: ')
	})
})

describe('buildCreateAlertBody', () => {
	const baseDelivery = { channel: 'email' as const, slackTeamId: '', slackChannelId: '', slackChannelName: null }

	it('builds a schedule body with a daily cadence and trims the title/prompt', () => {
		expect(
			buildCreateAlertBody({
				title: '  My Alert  ',
				triggerType: 'schedule',
				prompt: '  Aave V3 TVL  ',
				schedule: { frequency: 'daily', hour: 9, dayOfWeek: 1, timezone: 'UTC' },
				price: { tokenNk: '', value: '', op: 'above' },
				delivery: baseDelivery
			})
		).toEqual({
			title: 'My Alert',
			prompt: 'Aave V3 TVL',
			trigger: { type: 'schedule' },
			alertConfig: { frequency: 'daily', hour: 9, timezone: 'UTC' },
			delivery_channel: 'email'
		})
	})

	it('includes dayOfWeek only for weekly cadence', () => {
		const body = buildCreateAlertBody({
			title: 'Weekly',
			triggerType: 'schedule',
			prompt: 'Check TVL',
			schedule: { frequency: 'weekly', hour: 14, dayOfWeek: 3, timezone: 'UTC' },
			price: { tokenNk: '', value: '', op: 'above' },
			delivery: baseDelivery
		})
		expect(body.alertConfig).toEqual({ frequency: 'weekly', hour: 14, dayOfWeek: 3, timezone: 'UTC' })
	})

	it('builds a one-time price body (recurring is always false)', () => {
		const body = buildCreateAlertBody({
			title: 'Price alert',
			triggerType: 'price',
			prompt: '',
			schedule: { frequency: 'daily', hour: 9, dayOfWeek: 1, timezone: 'UTC' },
			price: { tokenNk: 'coingecko:aave', value: '100', op: 'above' },
			delivery: baseDelivery
		})
		expect(body).toEqual({
			title: 'Price alert',
			trigger: { type: 'price', token_nk: 'coingecko:aave', op: 'above', value: 100, recurring: false },
			delivery_channel: 'email'
		})
	})

	it('includes slack fields only when delivering to slack', () => {
		const body = buildCreateAlertBody({
			title: 'Slack alert',
			triggerType: 'price',
			prompt: '',
			schedule: { frequency: 'daily', hour: 9, dayOfWeek: 1, timezone: 'UTC' },
			price: { tokenNk: 'coingecko:aave', value: '100', op: 'above' },
			delivery: { channel: 'slack', slackTeamId: 'team-1', slackChannelId: 'chan-1', slackChannelName: 'alerts' }
		})
		expect(body).toMatchObject({
			delivery_channel: 'slack',
			slack_team_id: 'team-1',
			slack_channel_id: 'chan-1',
			slack_channel_name: 'alerts'
		})
	})

	it('omits prompt entirely when empty', () => {
		const body = buildCreateAlertBody({
			title: 'No prompt',
			triggerType: 'price',
			prompt: '   ',
			schedule: { frequency: 'daily', hour: 9, dayOfWeek: 1, timezone: 'UTC' },
			price: { tokenNk: 'coingecko:aave', value: '100', op: 'above' },
			delivery: baseDelivery
		})
		expect(body).not.toHaveProperty('prompt')
	})
})

describe('normalizePriceInput', () => {
	it('converts locale comma decimals to dots', () => {
		expect(normalizePriceInput('1774,35')).toBe('1774.35')
	})

	it('treats commas as thousands separators when a dot is also present', () => {
		expect(normalizePriceInput('$1,774.35')).toBe('1774.35')
		expect(normalizePriceInput('1,000,000.5')).toBe('1000000.5')
	})

	it('strips everything that is not a digit or separator', () => {
		expect(normalizePriceInput('abc12.5x')).toBe('12.5')
		expect(normalizePriceInput('12.5')).toBe('12.5')
	})

	it('keeps only the first decimal point', () => {
		expect(normalizePriceInput('1.2.3')).toBe('1.23')
	})
})

describe('formatPriceDisplay', () => {
	it('groups the integer part with commas', () => {
		expect(formatPriceDisplay('1774.35')).toBe('1,774.35')
		expect(formatPriceDisplay('1000000')).toBe('1,000,000')
	})

	it('keeps partial input intact while typing', () => {
		expect(formatPriceDisplay('')).toBe('')
		expect(formatPriceDisplay('1774.')).toBe('1,774.')
		expect(formatPriceDisplay('.5')).toBe('.5')
		expect(formatPriceDisplay('0.00001234')).toBe('0.00001234')
	})
})

describe('getArtifactSubtitle', () => {
	it('describes the inbox for email', () => {
		expect(getArtifactSubtitle('email', null)).toBe('Get this data delivered to your inbox')
	})

	it('describes telegram', () => {
		expect(getArtifactSubtitle('telegram', null)).toBe('Get this data delivered to your Telegram')
	})

	it('names the slack channel when picked', () => {
		expect(getArtifactSubtitle('slack', 'alerts')).toBe('Get this data delivered to #alerts')
	})

	it('falls back to generic slack copy until a channel is picked', () => {
		expect(getArtifactSubtitle('slack', null)).toBe('Get this data delivered to your Slack')
	})
})

describe('getDeliveryBlockReason', () => {
	it('surfaces readiness blocks', () => {
		expect(
			getDeliveryBlockReason({
				channel: 'telegram',
				telegramLinked: false,
				slackTeamId: '',
				slackChannelId: '',
				slackWorkspaceCount: 0
			})
		).toBe('Link Telegram first')
	})

	it('requires a slack channel once a workspace is selected', () => {
		expect(
			getDeliveryBlockReason({
				channel: 'slack',
				telegramLinked: false,
				slackTeamId: 'team-1',
				slackChannelId: '',
				slackWorkspaceCount: 1
			})
		).toBe('Pick a Slack channel')
	})

	it('passes for a ready channel', () => {
		expect(
			getDeliveryBlockReason({
				channel: 'email',
				telegramLinked: false,
				slackTeamId: '',
				slackChannelId: '',
				slackWorkspaceCount: 0
			})
		).toBeNull()
	})
})

describe('buildArtifactSaveBody', () => {
	const base = {
		messageId: 'msg-1',
		alertId: 'alert-1',
		title: '  Morning brief  ',
		alertConfig: { frequency: 'daily' as const, hour: 9, dayOfWeek: 1, timezone: 'UTC' }
	}

	it('sends the selected channel, overriding whatever the agent proposed', () => {
		const body = buildArtifactSaveBody({
			...base,
			channel: 'telegram',
			slackTeamId: 'T1',
			slackChannelId: 'C1',
			slackChannelName: 'alerts'
		})
		expect(body).toEqual({
			messageId: 'msg-1',
			alertId: 'alert-1',
			title: 'Morning brief',
			alertConfig: base.alertConfig,
			delivery_channel: 'telegram'
		})
	})

	it('includes slack fields only when slack is selected', () => {
		const body = buildArtifactSaveBody({
			...base,
			channel: 'slack',
			slackTeamId: 'T1',
			slackChannelId: 'C1',
			slackChannelName: 'alerts'
		})
		expect(body).toMatchObject({
			delivery_channel: 'slack',
			slack_team_id: 'T1',
			slack_channel_id: 'C1',
			slack_channel_name: 'alerts'
		})
	})

	it('omits alertConfig and sends trigger for a price save', () => {
		const body = buildArtifactSaveBody({
			messageId: 'msg-1',
			alertId: 'alert-1',
			title: 'BTC below 50000',
			trigger: { type: 'price', token_nk: 'coingecko:bitcoin', op: 'below', value: 50000, recurring: false },
			channel: 'email',
			slackTeamId: '',
			slackChannelId: '',
			slackChannelName: null
		})
		expect(body).toEqual({
			messageId: 'msg-1',
			alertId: 'alert-1',
			title: 'BTC below 50000',
			trigger: { type: 'price', token_nk: 'coingecko:bitcoin', op: 'below', value: 50000, recurring: false },
			delivery_channel: 'email'
		})
		expect(body.alertConfig).toBeUndefined()
	})
})

describe('roundPriceValue', () => {
	it('rounds prices at or above $10 to 2 decimals (agent-computed thresholds arrive with float noise)', () => {
		expect(roundPriceValue(67403.75524)).toBe('67403.76')
		expect(roundPriceValue(63786.94172241246)).toBe('63786.94')
		expect(roundPriceValue(64000)).toBe('64000')
	})

	it('keeps 4 significant digits below $10 so cents granularity does not mangle near-$1 thresholds', () => {
		expect(roundPriceValue(1.0955)).toBe('1.096')
		expect(roundPriceValue(1.5)).toBe('1.5')
		expect(roundPriceValue(0.000012347)).toBe('0.00001235')
		expect(roundPriceValue(0.9987654)).toBe('0.9988')
	})

	it('returns empty string for non-positive or non-finite input', () => {
		expect(roundPriceValue(0)).toBe('')
		expect(roundPriceValue(-5)).toBe('')
		expect(roundPriceValue(NaN)).toBe('')
		expect(roundPriceValue(Infinity)).toBe('')
	})
})

describe('ALERT_PROMPT_SUGGESTIONS', () => {
	it('covers the top demand themes from ops.alerts with one chip each', () => {
		expect(ALERT_PROMPT_SUGGESTIONS).toHaveLength(6)
		const labels = ALERT_PROMPT_SUGGESTIONS.map((s) => s.label)
		expect(new Set(labels).size).toBe(labels.length)
		for (const s of ALERT_PROMPT_SUGGESTIONS) {
			expect(s.label.length).toBeGreaterThan(0)
			expect(s.label.length).toBeLessThanOrEqual(24)
			expect(s.prompt.trim().length).toBeGreaterThan(0)
			expect(validatePrompt('schedule', s.prompt)).toBeNull()
		}
	})

	it('does not pin suggestions to Aave (2026-07 decision: mentions were mostly incidental)', () => {
		for (const s of ALERT_PROMPT_SUGGESTIONS) {
			expect(`${s.label} ${s.prompt}`.toLowerCase()).not.toContain('aave')
		}
	})
})
