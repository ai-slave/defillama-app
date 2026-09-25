import { describe, expect, test } from 'vitest'
import { parseMessageToRenderModel } from '~/containers/LlamaAI/renderModel'
import type { AlertProposedData, Message } from '~/containers/LlamaAI/types'
import { buildRestoredAlerts, normalizeAlertProposedData } from '../restoredAlerts'

const priceTrigger = {
	type: 'price' as const,
	token_nk: 'coingecko:bitcoin',
	op: 'below' as const,
	value: 50_000,
	recurring: false
}

const alertIntent = {
	frequency: 'daily' as const,
	hour: 9,
	timezone: 'UTC'
}

function restoredAlertId(result: Array<AlertProposedData> | undefined) {
	return result?.[0]?.alertId
}

describe('buildRestoredAlerts', () => {
	test('uses the inline alert marker id for historical unsaved alerts', () => {
		const alerts = buildRestoredAlerts({
			content: 'I can schedule that.\n\n[ALERT:aave_daily]',
			messageId: 'message-1',
			metadata: { alertIntent }
		})

		expect(restoredAlertId(alerts)).toBe('aave_daily')
	})

	test('falls back to saveable alert ids when content has no marker', () => {
		const alerts = buildRestoredAlerts({
			content: 'I can schedule that.',
			messageId: 'message-1',
			metadata: { alertIntent, saveableAlertIds: ['x_abc'] }
		})

		expect(restoredAlertId(alerts)).toBe('x_abc')
	})

	test('preserves telegram delivery from persisted metadata', () => {
		const alerts = buildRestoredAlerts({
			content: '[ALERT:telegram_alert]',
			messageId: 'message-1',
			metadata: { alertIntent: { ...alertIntent, deliveryChannel: 'telegram' } }
		})

		expect(alerts?.[0]?.alertIntent.deliveryChannel).toBe('telegram')
	})

	test('keeps legacy fallback behavior when no marker or alert id exists', () => {
		const alerts = buildRestoredAlerts({
			content: 'I can schedule that.',
			messageId: 'message-1',
			metadata: { alertIntent }
		})

		expect(restoredAlertId(alerts)).toBe('restored_message-1')
	})
})

describe('normalizeAlertProposedData', () => {
	test('adds restored-alert defaults to partial live alert proposals', () => {
		expect(
			normalizeAlertProposedData({
				alertId: 'alert-1',
				title: 'Alert',
				delivery_channel: 'slack',
				slack_team_id: 'T1',
				slack_channel_name: 'alerts',
				alertIntent: {}
			})
		).toEqual({
			alertId: 'alert-1',
			title: 'Alert',
			alertIntent: {
				frequency: 'daily',
				hour: 9,
				timezone: 'UTC',
				dayOfWeek: undefined,
				deliveryChannel: 'slack',
				slackTeamId: 'T1',
				slackTeamName: null,
				slackChannelId: null,
				slackChannelName: 'alerts'
			},
			schedule_expression: '',
			next_run_at: ''
		})
	})

	test('clamps invalid live alert schedule fields', () => {
		expect(
			normalizeAlertProposedData({
				alertId: 'alert-1',
				alertIntent: { hour: Infinity, dayOfWeek: 9 }
			}).alertIntent
		).toMatchObject({ hour: 9, dayOfWeek: undefined })

		expect(
			normalizeAlertProposedData({
				alertId: 'alert-1',
				alertIntent: { hour: 27.9, dayOfWeek: 6 }
			}).alertIntent
		).toMatchObject({ hour: 23, dayOfWeek: 6 })
	})

	test('clamps invalid restored alert schedule fields', () => {
		const alerts = buildRestoredAlerts({
			content: '[ALERT:alert-1]',
			messageId: 'message-1',
			metadata: { alertIntent: { ...alertIntent, hour: -3.2, dayOfWeek: 7 } }
		})

		expect(alerts?.[0]?.alertIntent).toMatchObject({ hour: 0, dayOfWeek: undefined })
	})

	test('carries a live price trigger through to alertIntent', () => {
		const result = normalizeAlertProposedData({
			alertId: 'alert-1',
			title: 'BTC below 50000',
			alertIntent: { trigger: priceTrigger }
		})

		expect(result.alertIntent.trigger).toEqual(priceTrigger)
	})

	test('drops a malformed live trigger instead of surfacing a broken price card', () => {
		const result = normalizeAlertProposedData({
			alertId: 'alert-1',
			title: 'Bad trigger',
			alertIntent: { trigger: { type: 'price', op: 'sideways', value: 'not-a-number' } }
		})

		expect(result.alertIntent.trigger).toBeUndefined()
	})

	test('carries a restored price trigger through buildRestoredAlerts', () => {
		const alerts = buildRestoredAlerts({
			content: '[ALERT:price_1]',
			messageId: 'message-1',
			metadata: { alertIntent: { trigger: priceTrigger } }
		})

		expect(alerts?.[0]?.alertIntent.trigger).toEqual(priceTrigger)
	})
})

describe('restored alert render model', () => {
	test('renders a saved restored alert inline when the marker and saved id match', () => {
		const alerts = buildRestoredAlerts({
			content: 'Done.\n\n[ALERT:foo]',
			messageId: 'message-1',
			metadata: { alertIntent },
			savedAlertIds: ['foo']
		})
		const message: Message = {
			role: 'assistant',
			id: 'message-1',
			content: 'Done.\n\n[ALERT:foo]',
			alerts,
			savedAlertIds: ['foo']
		}

		const model = parseMessageToRenderModel(message)

		expect(model.blocks).toHaveLength(2)
		expect(model.blocks[0]).toMatchObject({ type: 'markdown' })
		expect(model.blocks[1]).toMatchObject({ type: 'alert', artifactId: 'foo' })
		expect(model.artifactsById.get('foo')).toMatchObject({ type: 'alert', savedAlertIds: ['foo'] })
	})

	test('keeps alert-like action buttons as prompt actions', () => {
		const model = parseMessageToRenderModel({
			role: 'assistant',
			content: '[ACTION:Alert me daily|Alert me daily about ETH fees]'
		})

		expect(model.blocks).toEqual([
			{
				type: 'action-group',
				key: 'actions-0',
				actions: [{ label: 'Alert me daily', message: 'Alert me daily about ETH fees' }]
			}
		])
	})
})
