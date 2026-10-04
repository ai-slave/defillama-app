import { describe, expect, test } from 'vitest'
import type { TelegramStatus } from '~/containers/LlamaAI/api/telegram'
import { getIntegrationRowResetKey } from '~/containers/LlamaAI/components/IntegrationRow'
import {
	deriveTelegramLinkState,
	getTelegramStatusRefetchInterval
} from '~/containers/LlamaAI/hooks/useIntegrationLink'

const linked: TelegramStatus = {
	link: { state: 'linked', telegramUsername: 'defillama', linkedAt: '2026-05-14T00:00:00.000Z' },
	pending: null
}

const unlinked: TelegramStatus = { link: { state: 'unlinked' }, pending: null }

const pending: TelegramStatus = {
	link: { state: 'unlinked' },
	pending: {
		token: 'pending-token',
		deepLink: 'https://t.me/defillama_bot?start=pending-token',
		expiresAt: '2026-05-14T00:05:00.000Z'
	}
}

const linkedWithPending: TelegramStatus = {
	...linked,
	pending: pending.pending
}

const noConfirm = { isPending: false, data: undefined, variables: undefined, error: null }

function derive(status: TelegramStatus | null) {
	return deriveTelegramLinkState({
		status,
		statusError: null,
		isLoading: false,
		isStarting: false,
		confirm: noConfirm,
		initialTgloginToken: null
	})
}

describe('useIntegrationLink state helpers', () => {
	test('renders linked with pending as awaiting Telegram confirmation', () => {
		expect(derive(linkedWithPending)).toEqual({
			status: 'awaiting_tg',
			token: 'pending-token',
			deepLink: 'https://t.me/defillama_bot?start=pending-token'
		})
		expect(getTelegramStatusRefetchInterval(linkedWithPending)).toBe(2000)
	})

	test('renders unlinked without pending as idle and stops polling', () => {
		expect(derive(unlinked)).toEqual({ status: 'idle' })
		expect(getTelegramStatusRefetchInterval(unlinked)).toBe(false)
	})

	test('renders linked without pending as linked and stops polling', () => {
		expect(derive(linked)).toEqual({
			status: 'linked',
			username: 'defillama',
			linkedAt: '2026-05-14T00:00:00.000Z'
		})
		expect(getTelegramStatusRefetchInterval(linked)).toBe(false)
	})

	test('changes the reset key when a new tglogin token arrives', () => {
		expect(getIntegrationRowResetKey('first-token', linked)).toBe('tglogin:first-token')
		expect(getIntegrationRowResetKey('second-token', linked)).toBe('tglogin:second-token')
		expect(getIntegrationRowResetKey(null, pending)).toBe('pending:pending-token')
	})

	test('keeps forced switch confirmation errors visible while a tglogin token is still present', () => {
		expect(
			deriveTelegramLinkState({
				status: linked,
				statusError: null,
				isLoading: false,
				isStarting: false,
				confirm: {
					isPending: false,
					data: undefined,
					variables: { token: 'deep-link-token', short_code: '123456', force: true },
					error: new Error('Switch failed')
				},
				initialTgloginToken: 'deep-link-token'
			})
		).toEqual({ status: 'error', message: 'Switch failed' })
	})

	test('surfaces status load errors when there is no status data to render', () => {
		expect(
			deriveTelegramLinkState({
				status: undefined,
				statusError: new Error('Failed to load Telegram status'),
				isLoading: false,
				isStarting: false,
				confirm: noConfirm,
				initialTgloginToken: null
			})
		).toEqual({ status: 'error', message: 'Failed to load Telegram status' })
	})
})
