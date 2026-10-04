import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthRecord, RecordAuthResponse } from 'pocketbase'
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState, useSyncExternalStore } from 'react'
import toast from 'react-hot-toast'
import { getAuthErrorMessageFromResponse } from '~/auth/authErrors'
import { type AuthRequest, runAuthRequest } from '~/auth/authRequest'
import { getAuthStoreSnapshot, getServerSnapshot, refreshSession, subscribeToAuthStore } from '~/auth/authStore'
import { signInWithPassword } from '~/auth/emailSignIn'
import { signupWithEmail, type SignupRequest } from '~/auth/emailSignup'
import { OtpRequestError, sendVerificationCode } from '~/auth/emailVerification'
import { authenticateGithub } from '~/auth/githubAuth'
import { readGoogleAuthResult, type GoogleAuthResult, type GoogleAuthSession } from '~/auth/googleAuth'
import { rememberSignIn } from '~/auth/lastSignIn'
import { OAuthWelcomeDialog } from '~/auth/OAuthWelcomeDialog'
import { getReferrer } from '~/auth/referrer'
import type { GoogleLinkChallenge } from '~/auth/signInFlowStore'
import { getSignupAttribution } from '~/auth/signupAttribution'
import { clearSignupSource, getSignupSource } from '~/auth/signupSource'
import { clearPersistedSubscriptionStatus, subscriptionStatusQueryOptions } from '~/auth/subscriptionStatus'
import { VerifyEmailDialog } from '~/auth/VerifyEmailDialog'
import { AUTH_SERVER } from '~/constants'
import { clearPersistedUserInterests } from '~/containers/Announcements/userInterestsStorage'
import { LLAMA_AI_CUSTOM_INSTRUCTIONS_KEY } from '~/containers/LlamaAI/customInstructionsStorage'
import { removeStorageItem } from '~/contexts/localStorageStore'
import { refreshNowSeconds } from '~/hooks/useNowSeconds'
import { useStableCallback } from '~/hooks/useStableCallback'
import { useOpeningKey } from '~/ui/Dialog'
import { handleSimpleFetchResponse, httpErrorMessage } from '~/utils/async'
import pb, { type AuthModel } from '~/utils/pocketbase'

export type PromotionalEmailsValue = 'initial' | 'on' | 'off'

export type { GoogleLinkChallenge } from '~/auth/signInFlowStore'

export { readGoogleAuthResult } from '~/auth/googleAuth'
export type { GoogleAuthResult } from '~/auth/googleAuth'

interface FetchOptions extends RequestInit {
	skipAuth?: boolean
}

const clearUserSession = () => {
	clearPersistedSubscriptionStatus(pb.authStore.record?.id)
	clearPersistedUserInterests()
	// Browsers from before the key moved into the query cache still hold the last account's key here.
	localStorage.removeItem('pro_apikey')
	removeStorageItem(LLAMA_AI_CUSTOM_INSTRUCTIONS_KEY)
	pb.authStore.clear()
	localStorage.removeItem('userHash')
	localStorage.removeItem('lite-dashboards')
	if (typeof window !== 'undefined') {
		;(window as any).__frontChatUserHash = null
	}
	if (typeof window !== 'undefined' && (window as any).FrontChat) {
		;(window as any).FrontChat('shutdown', { clearSession: true })
	}
}

interface AuthContextType {
	login: (
		request: Parameters<typeof signInWithPassword>[0] & { suppressVerifyEmailPrompt?: boolean }
	) => ReturnType<typeof signInWithPassword>
	signup: (request: SignupRequest & { suppressVerifyEmailPrompt?: boolean }) => ReturnType<typeof signupWithEmail>
	logout: () => void
	authorizedFetch: (url: string, options?: FetchOptions, onlyToken?: boolean) => Promise<Response | null>
	signInWithGithub: (
		request: AuthRequest & { popup: Window; suppressVerifyEmailPrompt?: boolean }
	) => Promise<RecordAuthResponse['record'] | null>
	signInWithGoogle: (request: AuthRequest & { code: string }) => Promise<GoogleAuthResult | null>
	confirmGoogleLink: (
		request: AuthRequest & { challengeToken: string; code: string }
	) => Promise<GoogleAuthSession | null>
	resendGoogleLink: (request: AuthRequest & { challengeToken: string }) => Promise<GoogleLinkChallenge | null>
	setPromotionalEmails: (value: string) => void
	promptVerifyEmail: (accountId: string | undefined) => void
	isAuthenticated: boolean
	isNewSignup: boolean
	consumeSignupOutcome: () => void
	authToken: string | null
	user: AuthModel
	hasActiveSubscription: boolean
	isTrial: boolean
	loaders: {
		setPromotionalEmails: boolean
		userLoading: boolean
		sessionLoading: boolean
		subscriptionInitialCheck: boolean
	}
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

// An optional chain cannot be lowered inside a try, and this one is read inside the OAuth try/catch.
function isNewOauthUser(authData: { meta?: { isNew?: boolean } }) {
	return authData.meta?.isNew === true
}

const attributeSignup = (
	token: string,
	provider: 'google' | 'github',
	source: string | null,
	referrer: string | null
) => {
	void fetch(`${AUTH_SERVER}/user/attribution`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify({ source, referrer, provider, ...getSignupAttribution() })
	}).catch(() => {
		/* Attribution must not block an accepted sign-in. */
	})
}

const resendGoogleLink: AuthContextType['resendGoogleLink'] = (request) =>
	runAuthRequest(
		request,
		async () => {
			const response = await fetch(`${AUTH_SERVER}/auth/social-link/resend`, {
				method: 'POST',
				signal: request.signal,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ challengeToken: request.challengeToken })
			}).catch((error) => {
				throw new Error('Could not send a code. Check your connection.', { cause: error })
			})
			// The linking endpoint enforces a minute between sends but returns no retry timestamp.
			if (response.status === 429)
				throw new OtpRequestError('Wait before requesting another code.', Date.now() + 60_000)
			if (!response.ok) throw new Error(await getAuthErrorMessageFromResponse(response, 'Could not resend the code.'))
			const result = readGoogleAuthResult(await response.json())
			if (result.kind !== 'link_verification_required') throw new Error('Invalid Google link response')
			return result
		},
		() => {}
	)

export function AuthProvider({ children }: { children: ReactNode }) {
	// Use useSyncExternalStore to listen to authStore changes
	const authStoreState = useSyncExternalStore(subscribeToAuthStore, getAuthStoreSnapshot, getServerSnapshot)
	const [verifyEmailPrompt, setVerifyEmailPrompt] = useState<{
		accountId: string
		isOpen: boolean
		email?: string
	} | null>(null)
	// Each opening of the sheet starts without the last opening's typed code and verify error; the send, and with it
	// the resend cooldown, lives here and carries over.
	const verifyEmailOpening = useOpeningKey(verifyEmailPrompt?.isOpen ?? false)
	const [oauthWelcomeAccountId, setOauthWelcomeAccountId] = useState<string | null>(null)
	const [signupAccountId, setSignupAccountId] = useState<string | null>(null)
	const consumeSignupOutcome = useCallback(() => setSignupAccountId(null), [])
	const openOauthWelcome = (accountId: string) => {
		setPromotionalEmails.reset()
		setOauthWelcomeAccountId(accountId)
	}

	// The send's answer sets the resend deadline from Date.now(), so the sheet's countdown clock re-reads the second
	// before it renders that answer.
	const sendVerifyCode = useMutation({ mutationFn: sendVerificationCode, onSettled: refreshNowSeconds })
	// Opening the sheet for an account sends its first code. Reopening the same account's sheet must not replace
	// the code already in the inbox or restart the server's resend cooldown. Callers save the session first:
	// the send checks it owns the account.
	const openVerifyEmail = useStableCallback((accountId: string, email: string | undefined) => {
		if (verifyEmailPrompt?.accountId !== accountId) sendVerifyCode.mutate(accountId)
		setVerifyEmailPrompt({ accountId, email, isOpen: true })
	})

	const promptVerifyEmail = useCallback(
		(accountId: string | undefined) => {
			if (accountId && pb.authStore.record?.id === accountId) openVerifyEmail(accountId, pb.authStore.record.email)
		},
		[openVerifyEmail]
	)

	// Derive isAuthenticated from authStoreState
	const isAuthenticated = authStoreState.isValid && !!authStoreState.token

	const queryClient = useQueryClient()
	const subscriptionUserId = isAuthenticated ? (authStoreState.record?.id ?? null) : null
	const subscriptionToken = isAuthenticated ? authStoreState.token : null
	const subscriptionQueryOptions = useMemo(
		() => subscriptionStatusQueryOptions({ userId: subscriptionUserId, token: subscriptionToken }),
		[subscriptionUserId, subscriptionToken]
	)
	const subscriptionQuery = useQuery(subscriptionQueryOptions)
	// A token-only replacement cannot confirm ownership of onboarding.
	if (oauthWelcomeAccountId && authStoreState.record?.id !== oauthWelcomeAccountId) setOauthWelcomeAccountId(null)
	if (signupAccountId && authStoreState.record?.id !== signupAccountId) setSignupAccountId(null)

	const { isLoading: userQueryIsLoading } = useQuery({
		queryKey: ['auth', 'status', authStoreState?.record?.id ?? null],
		queryFn: async () => {
			const sessionToken = authStoreState.token
			if (!sessionToken) {
				return null
			}
			// Responses for a session the user already left must not touch the
			// store: a slow refresh must not resurrect it, and a stale 401 must
			// not clear the newer session that replaced it.
			try {
				return await refreshSession(sessionToken)
			} catch (error: any) {
				if (error?.isAbort || error?.message?.includes('autocancelled')) {
					return pb.authStore.token === sessionToken ? (pb.authStore.record ?? null) : null
				}

				console.log('Error refreshing auth:', error)

				if ((error?.status === 401 || error?.code === 401) && pb.authStore.token === sessionToken) {
					clearUserSession()
				}

				throw new Error('Failed to refresh auth', { cause: error })
			}
		},
		enabled: authStoreState.token != null && authStoreState.isValid,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000)
	})

	const authUserLoading = !authStoreState.record?.collectionId && userQueryIsLoading
	const isSubscriptionPending = isAuthenticated && subscriptionUserId != null && subscriptionQuery.isPending
	const userLoading = authUserLoading || (isAuthenticated && subscriptionQuery.data === undefined)
	const sessionLoading = authUserLoading || isSubscriptionPending

	const login = useCallback(
		async ({ suppressVerifyEmailPrompt, ...request }: Parameters<AuthContextType['login']>[0]) => {
			const record = await signInWithPassword(request)
			if (record) setSignupAccountId(null)
			if (record && !record.verified && !suppressVerifyEmailPrompt && pb.authStore.record?.id === record.id) {
				openVerifyEmail(record.id, record.email)
			}
			return record
		},
		[openVerifyEmail]
	)

	// Close when the owning account cannot be confirmed, including a token-only replacement. A verified account keeps
	// its sheet, which confirms the verification until the reader closes it. Refreshing the same account must not
	// reopen a closed sheet.
	if (verifyEmailPrompt && authStoreState.record?.id !== verifyEmailPrompt.accountId) {
		setVerifyEmailPrompt(null)
	}

	const signup = useCallback(
		async ({ suppressVerifyEmailPrompt, ...request }: Parameters<AuthContextType['signup']>[0]) => {
			const record = await signupWithEmail(request, (record) => {
				clearSignupSource()
				setSignupAccountId(record.id)
			})
			if (record && !record.verified && !suppressVerifyEmailPrompt && pb.authStore.record?.id === record.id) {
				openVerifyEmail(record.id, record.email)
			}
			return record
		},
		[openVerifyEmail]
	)

	const authorizedFetch = useCallback(async (url: string, options: FetchOptions = {}, onlyToken = false) => {
		const { skipAuth = false, headers = {}, ...rest } = options
		if (skipAuth) return fetch(url, options)
		if (!pb.authStore.isValid) return null
		return fetch(url, {
			...rest,
			headers: { ...headers, Authorization: onlyToken ? pb.authStore.token : `Bearer ${pb.authStore.token}` }
		})
	}, [])

	const signInWithGithub: AuthContextType['signInWithGithub'] = async (request) => {
		const source = getSignupSource()
		const referrer = getReferrer()
		const result = await runAuthRequest(
			request,
			() => authenticateGithub(request),
			(result) => {
				setSignupAccountId(isNewOauthUser(result) ? result.record.id : null)
				if (isNewOauthUser(result)) {
					openOauthWelcome(result.record.id)
					attributeSignup(result.token, 'github', source, referrer)
				}
				clearSignupSource()
				pb.authStore.save(result.token, result.record)
				if (result.record.email && !result.record.verified && !request.suppressVerifyEmailPrompt)
					openVerifyEmail(result.record.id, result.record.email)
				rememberSignIn({ method: 'github' })
				request.onAuthenticated?.()
			}
		)
		return result?.record ?? null
	}

	const signInWithGoogle: AuthContextType['signInWithGoogle'] = (request) => {
		const source = getSignupSource()
		const referrer = getReferrer()
		return runAuthRequest(
			request,
			async () => {
				const response = await fetch(`${AUTH_SERVER}/auth/google-code-signin`, {
					method: 'POST',
					signal: request.signal,
					headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XmlHttpRequest' },
					body: JSON.stringify({ code: request.code, signupClient: 'web', source })
				}).catch((error) => {
					throw new Error('Could not sign in with Google. Check your connection.', { cause: error })
				})
				if (!response.ok)
					throw new Error(await getAuthErrorMessageFromResponse(response, 'Could not sign in with Google.'))
				return readGoogleAuthResult(await response.json())
			},
			(result) => {
				if (result.kind !== 'authenticated') return
				setSignupAccountId(result.isNew ? result.user.id : null)
				if (result.isNew) {
					openOauthWelcome(result.user.id)
					attributeSignup(result.token, 'google', source, referrer)
				}
				clearSignupSource()
				// This response has identity fields only, even if an earlier sign-in left a fresh profile cache.
				void queryClient.invalidateQueries({
					queryKey: ['auth', 'status', result.user.id],
					exact: true,
					refetchType: 'none'
				})
				pb.authStore.save(result.token, result.user as AuthRecord)
				rememberSignIn({ method: 'google' })
				request.onAuthenticated?.()
			}
		)
	}

	const confirmGoogleLink: AuthContextType['confirmGoogleLink'] = (request) =>
		runAuthRequest(
			request,
			async () => {
				const response = await fetch(`${AUTH_SERVER}/auth/social-link/confirm`, {
					method: 'POST',
					signal: request.signal,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ challengeToken: request.challengeToken, code: request.code })
				}).catch((error) => {
					throw new Error('Could not verify the code. Check your connection.', { cause: error })
				})
				if (!response.ok) throw new Error(await getAuthErrorMessageFromResponse(response, 'Invalid or expired code.'))
				const result = readGoogleAuthResult(await response.json())
				if (result.kind !== 'authenticated') throw new Error('Invalid Google link response')
				return result
			},
			(result) => {
				setSignupAccountId(null)
				clearSignupSource()
				// This response has identity fields only, even if an earlier sign-in left a fresh profile cache.
				void queryClient.invalidateQueries({
					queryKey: ['auth', 'status', result.user.id],
					exact: true,
					refetchType: 'none'
				})
				pb.authStore.save(result.token, result.user as AuthRecord)
				rememberSignIn({ method: 'google' })
				request.onAuthenticated?.()
			}
		)

	const setPromotionalEmails = useMutation({
		mutationFn: async ({ accountId, value }: { accountId: string; value: string }) => {
			if (pb.authStore.record?.id !== accountId) throw new Error('Your account changed. Sign in again.')
			const token = pb.authStore.token
			let response: Response
			try {
				response = await fetch(`${AUTH_SERVER}/user/promotional-emails`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
					body: JSON.stringify({ value })
				})
			} catch (error) {
				if (pb.authStore.record?.id !== accountId) return null
				throw new Error('Could not save your preference. Check your connection.', { cause: error })
			}
			if (pb.authStore.record?.id !== accountId) return null
			await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(httpErrorMessage(error, 'Could not save your preference.'))
			})
			if (pb.authStore.record?.id !== accountId) return null
			// This write changes only the preference. Preserve the token and other account fields.
			pb.authStore.save(pb.authStore.token, { ...pb.authStore.record, promotionalEmails: value })
			return { accountId, value }
		},
		onSuccess: async (data) => {
			if (!data || pb.authStore.record?.id !== data.accountId) return
			await queryClient.cancelQueries({ queryKey: ['auth', 'status', data.accountId], exact: true })
			if (pb.authStore.record?.id !== data.accountId) return
			queryClient.setQueryData<AuthModel>(['auth', 'status', data.accountId], (oldData) =>
				oldData ? { ...oldData, promotionalEmails: data.value as PromotionalEmailsValue } : oldData
			)
			// The account query owns refreshes, including replacing a profile read started before this save.
			void queryClient.invalidateQueries({ queryKey: ['auth', 'status', data.accountId], exact: true })
		}
	})

	// Settings gets toasts (no dialog is open there); the onboarding dialog
	// renders the same outcomes inline instead.
	const setPromotionalEmailsFromSettings = useCallback(
		(value: string) => {
			const accountId = pb.authStore.record?.id
			if (!accountId) return
			setPromotionalEmails.mutate(
				{ accountId, value },
				{
					onSuccess: (data) => {
						if (data) toast.success('Email preferences updated successfully')
					},
					onError: (error) => toast.error(httpErrorMessage(error, 'Failed to update email preferences'))
				}
			)
		},
		[setPromotionalEmails]
	)

	const userData = useMemo(() => {
		if (!authStoreState?.record) return null

		return {
			id: authStoreState.record.id,
			collectionId: authStoreState.record.collectionId,
			collectionName: authStoreState.record.collectionName,
			walletAddress: authStoreState.record.address,
			authMethod: authStoreState.record.auth_method,
			created: authStoreState.record.created,
			updated: authStoreState.record.updated,
			email: authStoreState.record.email,
			name: authStoreState.record.name,
			avatar: authStoreState.record.avatar,
			username: authStoreState.record.username,
			verified: authStoreState.record.email?.includes('@defillama.com') ? true : authStoreState.record.verified,
			emailVisibility: authStoreState.record.emailVisibility,
			expand: authStoreState.record.expand,
			has_active_subscription: authStoreState.record.has_active_subscription,
			flags: authStoreState.record.flags ?? {},
			ethereum_email: authStoreState.record.ethereum_email,
			promotionalEmails: authStoreState.record.promotionalEmails as PromotionalEmailsValue | undefined,
			referral_code: authStoreState.record.referral_code
		} as AuthModel
	}, [authStoreState])

	const contextValue: AuthContextType = {
		user: userData,
		login,
		signup,
		logout: clearUserSession,
		authorizedFetch,
		signInWithGithub,
		signInWithGoogle,
		confirmGoogleLink,
		resendGoogleLink,
		setPromotionalEmails: setPromotionalEmailsFromSettings,
		promptVerifyEmail,
		isAuthenticated,
		consumeSignupOutcome,
		isNewSignup: signupAccountId !== null && signupAccountId === authStoreState.record?.id,
		authToken: isAuthenticated ? authStoreState.token : null,
		hasActiveSubscription: subscriptionQuery.data?.status === 'active',
		isTrial: Boolean(userData?.flags?.is_trial),
		loaders: {
			setPromotionalEmails: setPromotionalEmails.isPending,
			userLoading,
			sessionLoading,
			subscriptionInitialCheck: isAuthenticated && !subscriptionQuery.isFetched
		}
	}

	return (
		<AuthContext.Provider value={contextValue}>
			{children}

			{verifyEmailPrompt && !oauthWelcomeAccountId ? (
				<VerifyEmailDialog
					key={`${verifyEmailPrompt.accountId}:${verifyEmailOpening}`}
					accountId={verifyEmailPrompt.accountId}
					isOpen={verifyEmailPrompt.isOpen}
					email={verifyEmailPrompt.email}
					verified={authStoreState.record?.verified === true}
					send={sendVerifyCode}
					onClose={() => setVerifyEmailPrompt((prompt) => (prompt ? { ...prompt, isOpen: false } : null))}
				/>
			) : null}
			{/* Mount per onboarding instance so a later account can't inherit this one's
			    consent choices. Close only after the preference write succeeds; on error
			    the dialog shows an inline error and stays open for a retry. */}
			{oauthWelcomeAccountId ? (
				<OAuthWelcomeDialog
					key={oauthWelcomeAccountId}
					onSignOut={clearUserSession}
					isSaving={setPromotionalEmails.isPending}
					onContinue={(value, onError) => {
						// mutate() callbacks, so the reset in openOauthWelcome drops an older onboarding's outcome.
						setPromotionalEmails.mutate(
							{ accountId: oauthWelcomeAccountId, value },
							{
								onSuccess: (data) => {
									if (data && pb.authStore.record?.id === data.accountId) setOauthWelcomeAccountId(null)
								},
								onError
							}
						)
					}}
				/>
			) : null}
		</AuthContext.Provider>
	)
}

export const useAuthContext = () => useContext(AuthContext)

function subscribeToUserHash(callback: () => void) {
	window.addEventListener('userHashChange', callback)
	return () => {
		window.removeEventListener('userHashChange', callback)
	}
}

const syncStoredUserHash = (nextUserHash: string | null) => {
	const currentUserHash = localStorage.getItem('userHash')
	if (currentUserHash === nextUserHash) return
	if (nextUserHash === null) {
		localStorage.removeItem('userHash')
	} else {
		localStorage.setItem('userHash', nextUserHash)
	}
	window.dispatchEvent(new Event('userHashChange'))
}

export const useUserHash = () => {
	const { user, hasActiveSubscription, authorizedFetch } = useAuthContext()

	let email = user?.email ?? null
	if (user?.email && user.email.startsWith('0x') && user.email.endsWith('@defillama.com') && user.ethereum_email) {
		email = user.ethereum_email
	}

	const userHash = useSyncExternalStore(
		subscribeToUserHash,
		() => (email && hasActiveSubscription ? (localStorage.getItem('userHash') ?? null) : null),
		() => null
	)

	useQuery({
		queryKey: ['auth', 'user-hash', email, hasActiveSubscription],
		queryFn: () =>
			authorizedFetch(`${AUTH_SERVER}/user/front-hash`)
				.then((res) => {
					if (!res) throw new Error('Not authenticated')
					return handleSimpleFetchResponse(res)
				})
				.then((res) => res.json())
				.then((data) => {
					syncStoredUserHash(data.userHash)
					return data.userHash
				})
				.catch(() => {
					syncStoredUserHash(null)
					return null
				}),
		enabled: !!(email && hasActiveSubscription),
		staleTime: 1000 * 60 * 60 * 24,
		refetchOnWindowFocus: false,
		retry: 3
	})

	return { userHash, email }
}
