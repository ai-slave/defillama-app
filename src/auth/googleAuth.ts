import type { RecordModel } from 'pocketbase'
import { isGoogleLinkChallenge, type GoogleLinkChallenge } from '~/auth/signInFlowStore'

export type GoogleAuthSession = {
	isNew: boolean
	kind: 'authenticated'
	token: string
	user: {
		email: string
		id: string
		verified: boolean
	} & Partial<RecordModel>
}

export type GoogleAuthResult = GoogleAuthSession | GoogleLinkChallenge

export function readGoogleAuthResult(value: unknown): GoogleAuthResult {
	if (!value || typeof value !== 'object' || !('kind' in value)) throw new Error('Invalid Google sign-in response')
	if (value.kind === 'link_verification_required') {
		if (!isGoogleLinkChallenge(value)) throw new Error('Invalid Google sign-in response')
		return value
	}
	if (
		value.kind !== 'authenticated' ||
		!('token' in value) ||
		typeof value.token !== 'string' ||
		!('user' in value) ||
		!value.user ||
		typeof value.user !== 'object' ||
		!('id' in value.user) ||
		typeof value.user.id !== 'string' ||
		!('email' in value.user) ||
		typeof value.user.email !== 'string' ||
		!('verified' in value.user) ||
		typeof value.user.verified !== 'boolean' ||
		('isNew' in value && typeof value.isNew !== 'boolean')
	) {
		throw new Error('Invalid Google sign-in response')
	}
	return {
		isNew: 'isNew' in value && value.isNew === true,
		kind: value.kind,
		token: value.token,
		user: {
			email: value.user.email,
			id: value.user.id,
			verified: value.user.verified
		}
	}
}
