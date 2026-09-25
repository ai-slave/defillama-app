import { describe, expect, test } from 'vitest'
import {
	buildArtifactSaveBody,
	buildCreateAlertBody,
	buildJustAskExample,
	buildScheduleExpressionRaw,
	deriveAlertTitle,
	formatNextRunAt,
	formatPriceDisplay,
	formatPriceLabel,
	getDeliveryBlockReason,
	getDeliveryReadinessBlock,
	getPriceCaption,
	getSubmitBlockReason,
	isAlertCapReachedError,
	normalizePriceInput,
	resolveSlackChannelName,
	resolveSlackTarget,
	roundPriceValue,
	validatePriceTrigger,
	validatePrompt
} from '~/containers/LlamaAI/components/alerts/createAlertForm'

describe('validatePrompt', () => {
	test('requires a prompt for schedule alerts', () => {
		expect(validatePrompt('schedule', '')).toBe('Describe what the report should cover')
		expect(validatePrompt('schedule', '   ')).toBe('Describe what the report should cover')
	})

	test('allows an empty prompt for price alerts', () => {
		expect(validatePrompt('price', '')).toBeNull()
	})

	test('accepts a non-empty prompt for either trigger type', () => {
		expect(validatePrompt('schedule', 'Aave V3 TVL and its top pools')).toBeNull()
		expect(validatePrompt('price', 'Aave V3 TVL and its top pools')).toBeNull()
	})
})

describe('validatePriceTrigger', () => {
	test('requires a token to be picked', () => {
		expect(validatePriceTrigger({ tokenNk: null, value: '100' })).toBe('Pick a token')
	})

	test('requires a numeric value', () => {
		expect(validatePriceTrigger({ tokenNk: 'coingecko:aave', value: '' })).toBe('Enter a price')
		expect(validatePriceTrigger({ tokenNk: 'coingecko:aave', value: 'abc' })).toBe('Enter a price')
	})

	test('rejects zero or negative values', () => {
		expect(validatePriceTrigger({ tokenNk: 'coingecko:aave', value: '0' })).toBe('Price must be greater than 0')
		expect(validatePriceTrigger({ tokenNk: 'coingecko:aave', value: '-5' })).toBe('Price must be greater than 0')
	})

	test('passes for a valid token and positive value', () => {
		expect(validatePriceTrigger({ tokenNk: 'coingecko:aave', value: '100' })).toBeNull()
	})
})

describe('getDeliveryReadinessBlock', () => {
	test('blocks telegram when not linked', () => {
		expect(
			getDeliveryReadinessBlock({
				channel: 'telegram',
				telegramLinked: false,
				slackTeamId: '',
				slackWorkspaceCount: 0
			})
		).toEqual({ label: 'Link Telegram first' })
	})

	test('allows telegram when linked', () => {
		expect(
			getDeliveryReadinessBlock({
				channel: 'telegram',
				telegramLinked: true,
				slackTeamId: '',
				slackWorkspaceCount: 0
			})
		).toBeNull()
	})

	test('blocks slack when no workspace is connected', () => {
		expect(
			getDeliveryReadinessBlock({
				channel: 'slack',
				telegramLinked: false,
				slackTeamId: '',
				slackWorkspaceCount: 0
			})
		).toEqual({ label: 'Link Slack first' })
	})

	test('blocks slack when a workspace exists but none is picked', () => {
		expect(
			getDeliveryReadinessBlock({
				channel: 'slack',
				telegramLinked: false,
				slackTeamId: '',
				slackWorkspaceCount: 2
			})
		).toEqual({ label: 'Link Slack first' })
	})

	test('allows slack once a workspace is selected', () => {
		expect(
			getDeliveryReadinessBlock({
				channel: 'slack',
				telegramLinked: false,
				slackTeamId: 'team-1',
				slackWorkspaceCount: 1
			})
		).toBeNull()
	})

	test('never blocks email', () => {
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

	test('blocks a schedule alert with no prompt', () => {
		expect(
			getSubmitBlockReason({
				triggerType: 'schedule',
				prompt: '',
				price: { tokenNk: null, value: '' },
				delivery: baseDelivery
			})
		).toBe('Describe what the report should cover')
	})

	test('blocks a price alert with no token selected', () => {
		expect(
			getSubmitBlockReason({
				triggerType: 'price',
				prompt: '',
				price: { tokenNk: null, value: '100' },
				delivery: baseDelivery
			})
		).toBe('Pick a token')
	})

	test('blocks when the chosen delivery channel is not ready', () => {
		expect(
			getSubmitBlockReason({
				triggerType: 'price',
				prompt: '',
				price: { tokenNk: 'coingecko:aave', value: '100' },
				delivery: { ...baseDelivery, channel: 'telegram', telegramLinked: false }
			})
		).toBe('Link Telegram first')
	})

	test('returns null once everything is valid', () => {
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
	test('caps prices at or above 10 to two decimals', () => {
		expect(formatPriceLabel(1774.35)).toBe('$1,774.35')
		expect(formatPriceLabel(100_000)).toBe('$100,000')
		expect(formatPriceLabel(64_110.82792502)).toBe('$64,110.83')
	})

	test('keeps sub-dollar precision instead of rounding it away', () => {
		expect(formatPriceLabel(0.5234)).toBe('$0.5234')
		expect(formatPriceLabel(0.00001234)).toBe('$0.00001234')
	})
})

describe('deriveAlertTitle', () => {
	test('derives a price title from token, direction and value', () => {
		expect(deriveAlertTitle({ triggerType: 'price', prompt: '', symbol: 'btc', op: 'above', value: '100000' })).toBe(
			'BTC above $100,000'
		)
	})

	test('falls back to a generic price title when the trigger is incomplete', () => {
		expect(deriveAlertTitle({ triggerType: 'price', prompt: '', symbol: null, op: 'above', value: '100' })).toBe(
			'Price alert'
		)
		expect(deriveAlertTitle({ triggerType: 'price', prompt: '', symbol: 'btc', op: 'above', value: '' })).toBe(
			'Price alert'
		)
	})

	test('derives a schedule title from the first line of the prompt', () => {
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

	test('truncates long prompts and falls back when empty', () => {
		const long = 'a'.repeat(80)
		const derived = deriveAlertTitle({ triggerType: 'schedule', prompt: long, symbol: null, op: 'above', value: '' })
		expect(derived).toBe(`${'a'.repeat(59)}…`)
		expect(deriveAlertTitle({ triggerType: 'schedule', prompt: '  ', symbol: null, op: 'above', value: '' })).toBe(
			'Scheduled report'
		)
	})
})

describe('isAlertCapReachedError', () => {
	test('detects the cap-hit sentinel message', () => {
		expect(isAlertCapReachedError(new Error('alert_cap_reached'))).toBe(true)
	})

	test('does not misclassify other errors', () => {
		expect(isAlertCapReachedError(new Error('bad trigger'))).toBe(false)
		expect(isAlertCapReachedError(new Error('Not authenticated'))).toBe(false)
		expect(isAlertCapReachedError('alert_cap_reached')).toBe(false)
		expect(isAlertCapReachedError(null)).toBe(false)
	})
})

describe('formatNextRunAt', () => {
	const now = new Date('2026-07-09T12:00:00Z')

	test('labels a run later today as "today"', () => {
		expect(formatNextRunAt('2026-07-09T19:00:00Z', now)).toMatch(/^today /)
	})

	test('labels a run tomorrow as "tomorrow"', () => {
		expect(formatNextRunAt('2026-07-10T07:00:00Z', now)).toMatch(/^tomorrow /)
	})

	test('falls back to a short date for further-out runs', () => {
		expect(formatNextRunAt('2026-07-20T07:00:00Z', now)).toMatch(/^Jul 20/)
	})

	test('returns a safe fallback for an unparseable date', () => {
		expect(formatNextRunAt('not-a-date', now)).toBe('soon')
	})
})

describe('getPriceCaption', () => {
	test('describes the one-time trigger with the price formatted like every other surface', () => {
		expect(getPriceCaption('LINK', 'above', '100')).toBe('Fires once when LINK goes above $100')
		expect(getPriceCaption('BTC', 'below', '50000')).toBe('Fires once when BTC goes below $50,000')
	})

	test('leaves unparseable drafts as typed', () => {
		expect(getPriceCaption('BTC', 'below', '0')).toBe('Fires once when BTC goes below 0')
	})
})

describe('buildScheduleExpressionRaw', () => {
	test('builds a daily expression', () => {
		expect(buildScheduleExpressionRaw({ frequency: 'daily', hour: 9, dayOfWeek: 1, timezone: 'UTC' })).toBe(
			'Daily at 9:00 UTC'
		)
	})

	test('builds a weekly expression with the day name', () => {
		expect(buildScheduleExpressionRaw({ frequency: 'weekly', hour: 14, dayOfWeek: 3, timezone: 'UTC' })).toBe(
			'Weekly on Wednesday at 14:00 UTC'
		)
	})
})

describe('buildJustAskExample', () => {
	test('carries the typed prompt into a schedule prefill', () => {
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

	test('gives an open-ended schedule scaffold when no prompt is typed', () => {
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

	test('carries token/op/value into a price prefill', () => {
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

	test('scaffolds around the token when no level is set yet', () => {
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

	test('falls back to a generic price scaffold with nothing picked', () => {
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

	test('builds a schedule body with a daily cadence and trims the title/prompt', () => {
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

	test('includes dayOfWeek only for weekly cadence', () => {
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

	test('builds a one-time price body (recurring is always false)', () => {
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

	test('includes slack fields only when delivering to slack', () => {
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

	test('omits prompt entirely when empty', () => {
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
	test('converts locale comma decimals to dots', () => {
		expect(normalizePriceInput('1774,35')).toBe('1774.35')
	})

	test('treats commas as thousands separators when a dot is also present', () => {
		expect(normalizePriceInput('$1,774.35')).toBe('1774.35')
		expect(normalizePriceInput('1,000,000.5')).toBe('1000000.5')
	})

	test('strips everything that is not a digit or separator', () => {
		expect(normalizePriceInput('abc12.5x')).toBe('12.5')
		expect(normalizePriceInput('12.5')).toBe('12.5')
	})

	test('keeps only the first decimal point', () => {
		expect(normalizePriceInput('1.2.3')).toBe('1.23')
	})
})

describe('formatPriceDisplay', () => {
	test('groups the integer part with commas', () => {
		expect(formatPriceDisplay('1774.35')).toBe('1,774.35')
		expect(formatPriceDisplay('1000000')).toBe('1,000,000')
	})

	test('keeps partial input intact while typing', () => {
		expect(formatPriceDisplay('')).toBe('')
		expect(formatPriceDisplay('1774.')).toBe('1,774.')
		expect(formatPriceDisplay('.5')).toBe('.5')
		expect(formatPriceDisplay('0.00001234')).toBe('0.00001234')
	})
})

describe('getDeliveryBlockReason', () => {
	test('requires a slack channel once a workspace is selected', () => {
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
})

describe('buildArtifactSaveBody', () => {
	const base = {
		messageId: 'msg-1',
		alertId: 'alert-1',
		title: '  Morning brief  ',
		alertConfig: { frequency: 'daily' as const, hour: 9, dayOfWeek: 1, timezone: 'UTC' }
	}

	test('sends the selected channel, overriding whatever the agent proposed', () => {
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

	test('includes slack fields only when slack is selected', () => {
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

	test('omits alertConfig and sends trigger for a price save', () => {
		const body = buildArtifactSaveBody({
			messageId: 'msg-1',
			alertId: 'alert-1',
			title: 'BTC below 50000',
			trigger: { type: 'price', token_nk: 'coingecko:bitcoin', op: 'below', value: 50_000, recurring: false },
			channel: 'email',
			slackTeamId: '',
			slackChannelId: '',
			slackChannelName: null
		})
		expect(body).toEqual({
			messageId: 'msg-1',
			alertId: 'alert-1',
			title: 'BTC below 50000',
			trigger: { type: 'price', token_nk: 'coingecko:bitcoin', op: 'below', value: 50_000, recurring: false },
			delivery_channel: 'email'
		})
		expect(body.alertConfig).toBeUndefined()
	})
})

describe('roundPriceValue', () => {
	test('rounds prices at or above $10 to 2 decimals (agent-computed thresholds arrive with float noise)', () => {
		expect(roundPriceValue(67_403.75524)).toBe('67403.76')
		expect(roundPriceValue(63_786.94172241246)).toBe('63786.94')
		expect(roundPriceValue(64_000)).toBe('64000')
	})

	test('keeps 4 significant digits below $10 so cents granularity does not mangle near-$1 thresholds', () => {
		expect(roundPriceValue(1.0955)).toBe('1.096')
		expect(roundPriceValue(1.5)).toBe('1.5')
		expect(roundPriceValue(0.000012347)).toBe('0.00001235')
		expect(roundPriceValue(0.9987654)).toBe('0.9988')
	})

	test('returns empty string for non-positive or non-finite input', () => {
		expect(roundPriceValue(0)).toBe('')
		expect(roundPriceValue(-5)).toBe('')
		expect(roundPriceValue(NaN)).toBe('')
		expect(roundPriceValue(Infinity)).toBe('')
	})
})

describe('resolveSlackTarget', () => {
	const t1 = { team_id: 'T1', default_channel_id: 'C1' }
	const t2 = { team_id: 'T2', default_channel_id: 'C2' }

	test('defaults to the only workspace and its default channel', () => {
		expect(resolveSlackTarget({ isSlack: true, picked: null, workspaces: [t1] })).toEqual({
			teamId: 'T1',
			channelId: 'C1'
		})
	})

	test('leaves the channel empty when the only workspace has no default', () => {
		expect(
			resolveSlackTarget({ isSlack: true, picked: null, workspaces: [{ team_id: 'T1', default_channel_id: null }] })
		).toEqual({ teamId: 'T1', channelId: '' })
	})

	test("the user's pick wins over the default", () => {
		expect(
			resolveSlackTarget({ isSlack: true, picked: { teamId: 'T1', channelId: 'C9' }, workspaces: [t1, t2] })
		).toEqual({ teamId: 'T1', channelId: 'C9' })
	})

	// A deliberate choice that disappears is not replaced. Neither the channel nor a substitute
	// workspace may stand in for a destination the user picked, however valid the pair would look.
	test('clears a pick whose workspace is gone rather than substituting the only one left', () => {
		expect(resolveSlackTarget({ isSlack: true, picked: { teamId: 'T1', channelId: 'C9' }, workspaces: [t2] })).toEqual({
			teamId: '',
			channelId: ''
		})
	})

	// Two workspaces is an ambiguous choice, so the form asks instead of guessing.
	test('defaults nothing when there is more than one workspace', () => {
		expect(resolveSlackTarget({ isSlack: true, picked: null, workspaces: [t1, t2] })).toEqual({
			teamId: '',
			channelId: ''
		})
	})

	test('defaults nothing for a channel other than Slack', () => {
		expect(resolveSlackTarget({ isSlack: false, picked: { teamId: 'T1', channelId: 'C9' }, workspaces: [t1] })).toEqual(
			{ teamId: '', channelId: '' }
		)
	})

	test('defaults nothing with no workspaces connected', () => {
		expect(resolveSlackTarget({ isSlack: true, picked: null, workspaces: [] })).toEqual({
			teamId: '',
			channelId: ''
		})
	})
})

describe('resolveSlackChannelName', () => {
	const channels = [
		{ id: 'C1', name: 'general' },
		{ id: 'C9', name: 'private-research' }
	]

	test('names the chosen channel from the loaded list', () => {
		expect(resolveSlackChannelName({ channelId: 'C9', channels })).toBe('private-research')
	})

	test("carries the intent's proposed name while its channel is still the chosen one", () => {
		expect(
			resolveSlackChannelName({
				channelId: 'C1',
				channels: undefined,
				intentChannelId: 'C1',
				intentChannelName: 'general'
			})
		).toBe('general')
	})

	// The reported drift: switching channel before the list arrives used to keep the intent's name, so
	// the alert saved a label for a channel it does not post to.
	test('gives no name to a channel the intent did not propose', () => {
		expect(
			resolveSlackChannelName({
				channelId: 'C7',
				channels: undefined,
				intentChannelId: 'C1',
				intentChannelName: 'general'
			})
		).toBeNull()
	})

	test('prefers the loaded name over the intent', () => {
		expect(
			resolveSlackChannelName({ channelId: 'C1', channels, intentChannelId: 'C1', intentChannelName: 'stale-name' })
		).toBe('general')
	})

	test('gives no name when no channel is chosen', () => {
		expect(
			resolveSlackChannelName({ channelId: '', channels, intentChannelId: '', intentChannelName: 'general' })
		).toBeNull()
	})

	test('gives no name for a channel missing from the loaded list', () => {
		expect(resolveSlackChannelName({ channelId: 'C7', channels })).toBeNull()
	})
})
