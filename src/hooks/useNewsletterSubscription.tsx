import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { errorToast, successToast } from '~/components/Toast/notifications'
import { AUTH_SERVER } from '~/constants'
import { handleSimpleFetchResponse } from '~/utils/async'
import pb, { type AuthModel } from '~/utils/pocketbase'

export type NewsletterKey = 'newsletter' | 'research'

export const NEWSLETTERS: { key: NewsletterKey; label: string; description: string }[] = [
	{ key: 'newsletter', label: 'DefiLlama Newsletter', description: 'Onchain data insights, DeFi tips, and new tools.' },
	{ key: 'research', label: 'Research Notes', description: 'In-depth research reports and analysis.' }
]

const NEWSLETTER_LABELS: Record<NewsletterKey, string> = {
	newsletter: 'DefiLlama Newsletter',
	research: 'Research Notes'
}

interface SubscribeArgs {
	email: string
	newsletters: NewsletterKey[]
}

interface MediaKitArgs {
	email: string
}

export interface NewsletterSubscribeResponse {
	email: string
	result: Partial<Record<NewsletterKey, string>>
}

export interface MediaKitEmailResponse {
	email: string
	sent: true
}

export function shouldShowNewsletterSignup(user: AuthModel | null | undefined): boolean {
	return user?.promotionalEmails !== 'on'
}

const getUserFacingErrorMessage = (error: unknown, fallbackMessage: string): string => {
	if (!(error instanceof Error)) return fallbackMessage
	if (!error.message.startsWith('[HTTP] [error]')) return error.message || fallbackMessage
	const colonIndex = error.message.indexOf(':')
	if (colonIndex === -1) return fallbackMessage
	const details = error.message.slice(colonIndex + 1).trim()
	return details || fallbackMessage
}

export interface NewsletterSuccessToast {
	title: string
	description?: string
}

const DEFAULT_SUCCESS_TOAST: NewsletterSuccessToast = {
	title: 'Subscribed to selected newsletters'
}

export function useNewsletterSubscription({
	successMessage = DEFAULT_SUCCESS_TOAST
}: { successMessage?: NewsletterSuccessToast } = {}) {
	return useMutation<NewsletterSubscribeResponse, Error, SubscribeArgs>({
		mutationFn: async ({ email, newsletters }) => {
			const allSelected = newsletters.length === NEWSLETTERS.length
			const res = await fetch(`${AUTH_SERVER}/newsletter/subscribe`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(allSelected ? { email } : { email, newsletters })
			})
			await handleSimpleFetchResponse(res)
			return (await res.json()) as NewsletterSubscribeResponse
		},
		onSuccess: (data, { newsletters }) => {
			if (pb.authStore.isValid) {
				pb.collection('users')
					.authRefresh()
					.catch(() => {})
			}
			const failed = newsletters.filter((key) => data.result?.[key] !== 'ok')
			if (failed.length === 0) {
				successToast(successMessage)
				return
			}
			const ok = newsletters.filter((key) => data.result?.[key] === 'ok')
			if (ok.length > 0) {
				errorToast({
					title: 'Partially subscribed',
					description: `Subscribed to ${ok.map((key) => NEWSLETTER_LABELS[key]).join(', ')}. Couldn't subscribe to ${failed
						.map((key) => NEWSLETTER_LABELS[key])
						.join(', ')} — please try again.`
				})
				return
			}
			errorToast({ title: 'Subscription failed', description: 'Please try again in a moment.' })
		},
		onError: (err) => {
			toast.error(getUserFacingErrorMessage(err, 'Could not subscribe. Please try again.'))
		}
	})
}

export function useMediaKitEmail() {
	return useMutation<MediaKitEmailResponse, Error, MediaKitArgs>({
		mutationFn: async ({ email }) => {
			const res = await fetch(`${AUTH_SERVER}/newsletter/subscribe`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, mediaKit: true })
			})
			await handleSimpleFetchResponse(res)
			return (await res.json()) as MediaKitEmailResponse
		},
		onSuccess: () => {
			successToast({
				title: 'Media kit sent',
				description: 'Check your inbox for the PDF link.'
			})
		},
		onError: (err) => {
			toast.error(getUserFacingErrorMessage(err, 'Could not send the media kit. Please try again.'))
		}
	})
}
