import { useMutation, type UseMutationResult, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RecordAuthResponse } from 'pocketbase'
import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore
} from 'react'
import toast from 'react-hot-toast'
import { getAuthStoreSnapshot, getServerSnapshot, refreshSession, subscribeToAuthStore } from '~/auth/authStore'
import { OAuthWelcomeDialog } from '~/auth/OAuthWelcomeDialog'
import { getReferrer } from '~/auth/referrer'
import { isGoogleLinkChallenge, type GoogleLinkChallenge } from '~/auth/signInFlowStore'
import { clearSignupSource, getSignupSource } from '~/auth/signupSource'
import { clearPersistedSubscriptionStatus, subscriptionStatusQueryOptions } from '~/auth/subscriptionStatus'
import { VerifyEmailConfirmDialog } from '~/auth/VerifyEmailConfirmDialog'
import { VerifyEmailDialog } from '~/auth/VerifyEmailDialog'
import { AUTH_SERVER } from '~/constants'
import { fetchJson, handleSimpleFetchResponse } from '~/utils/async'
import pb, { type AuthModel } from '~/utils/pocketbase'

export type PromotionalEmailsValue = 'initial' | 'on' | 'off'

export type { GoogleLinkChallenge } from '~/auth/signInFlowStore'

type GoogleAuthSession = {
	isNew: boolean
	kind: 'authenticated'
	token: string
	user: {
		email: string
		id: string
		verified: boolean
	}
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

interface FetchOptions extends RequestInit {
	skipAuth?: boolean
}

const getNonce = async (address: string) => {
	return fetchJson<{ nonce: string }>(`${AUTH_SERVER}/nonce?address=${address}`).catch((error) => {
		if (error instanceof Error && error.message) {
			throw error
		}
		throw new Error('Failed to get nonce')
	})
}

type CreateSiweMessage = (typeof import('viem/siwe'))['createSiweMessage']
let createSiweMessagePromise: Promise<CreateSiweMessage> | null = null

const loadCreateSiweMessage = async (): Promise<CreateSiweMessage> => {
	if (createSiweMessagePromise == null) {
		createSiweMessagePromise = import('viem/siwe').then((module) => module.createSiweMessage)
	}
	return createSiweMessagePromise
}

const clearUserSession = () => {
	clearPersistedSubscriptionStatus(pb.authStore.record?.id)
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

const getAuthErrorMessageFromResponse = async (response: Response, fallbackMessage: string): Promise<string> => {
	let parsed: unknown = null
	try {
		parsed = await response.json()
	} catch {
		return fallbackMessage
	}

	if (parsed == null || typeof parsed !== 'object') {
		return fallbackMessage
	}

	const messageValue = (parsed as { message?: unknown }).message
	if (typeof messageValue === 'string' && messageValue.length > 0) {
		return messageValue
	}

	const errorValue = (parsed as { error?: unknown }).error
	if (typeof errorValue === 'string' && errorValue.length > 0) {
		return errorValue
	}

	return fallbackMessage
}

const getUserFacingErrorMessage = (error: unknown, fallbackMessage: string): string => {
	if (!(error instanceof Error)) return fallbackMessage
	const rawMessage = error.message || ''
	if (!rawMessage.startsWith('[HTTP] [error]')) return rawMessage || fallbackMessage
	const colonIndex = rawMessage.indexOf(':')
	if (colonIndex === -1) return fallbackMessage
	const details = rawMessage.slice(colonIndex + 1).trim()
	return details || fallbackMessage
}

interface AuthContextType {
	login: (email: string, password: string, onSuccess?: () => void) => Promise<void>
	signup: (
		email: string,
		password: string,
		passwordConfirm: string,
		turnstileToken: string,
		promotionalEmails?: PromotionalEmailsValue,
		onSuccess?: () => void,
		options?: { suppressVerifyEmailPrompt?: boolean }
	) => Promise<void>
	logout: () => void
	authorizedFetch: (url: string, options?: FetchOptions, onlyToken?: boolean) => Promise<Response | null>
	signInWithEthereumMutation: UseMutationResult<
		{
			address: string
		},
		Error,
		{
			address: string
			signMessageFunction: any
		},
		unknown
	>
	signInWithGithubMutation: UseMutationResult<RecordAuthResponse, Error, void>
	signInWithGoogleMutation: UseMutationResult<GoogleAuthResult, Error, string>
	confirmGoogleLinkMutation: UseMutationResult<GoogleAuthSession, Error, { challengeToken: string; code: string }>
	resendGoogleLinkMutation: UseMutationResult<GoogleLinkChallenge, Error, string>
	addWallet: (address: string, signMessageFunction: any, onSuccess?: () => void) => Promise<void>
	resetPasswordMutation: UseMutationResult<void, Error, string>
	changeEmail: (email: string) => void
	sendOtp: () => Promise<void>
	verifyOtp: (otp: string) => Promise<void>
	addEmail: (email: string) => Promise<void>
	setPromotionalEmails: (value: string) => void
	promptVerifyEmail: (email?: string) => void
	isAuthenticated: boolean
	authToken: string | null
	user: AuthModel
	hasActiveSubscription: boolean
	isTrial: boolean
	loaders: {
		login: boolean
		signup: boolean
		logout: boolean
		addWallet: boolean
		changeEmail: boolean
		sendOtp: boolean
		verifyOtp: boolean
		addEmail: boolean
		setPromotionalEmails: boolean
		userLoading: boolean
	}
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

// An optional chain cannot be lowered inside a try, and this one is read inside the OAuth try/catch.
function isNewOauthUser(authData: { meta?: { isNew?: boolean } }) {
	return authData.meta?.isNew === true
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
	// Use useSyncExternalStore to listen to authStore changes
	const authStoreState = useSyncExternalStore(subscribeToAuthStore, getAuthStoreSnapshot, getServerSnapshot)
	const [verifyEmailPrompt, setVerifyEmailPrompt] = useState<{ isOpen: boolean; email?: string }>({ isOpen: false })
	const [verifyEmailConfirm, setVerifyEmailConfirm] = useState<{ isOpen: boolean; email?: string }>({ isOpen: false })
	const [oauthWelcomeOpen, setOauthWelcomeOpen] = useState(false)
	// The undismissable welcome dialog must not outlive the session it was opened
	// for (cross-tab logout or account switch), or its consent choices would write
	// into whichever account is current when Continue is clicked.
	// The user id comes from the sign-in response, not from pb.authStore.record:
	// the Google flow saves the token before its record, and concurrent
	// auth-refresh requests auto-cancel each other, so the store may still hold
	// a null record when the dialog opens.
	const oauthWelcomeUserRef = useRef<string | null>(null)
	const openOauthWelcome = useCallback((userId: string) => {
		oauthWelcomeUserRef.current = userId
		setOauthWelcomeOpen(true)
	}, [])

	const promptVerifyEmail = useCallback((email?: string) => {
		setVerifyEmailConfirm({ isOpen: true, email })
	}, [])

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
	// Close on logout (no token) or account switch (a different record id). A
	// record that has not loaded yet is not a switch, so a null record with a
	// live token keeps the dialog open.
	useEffect(() => {
		if (!oauthWelcomeOpen) return
		const currentId = authStoreState.record?.id ?? null
		if (!authStoreState.token || (currentId !== null && currentId !== oauthWelcomeUserRef.current)) {
			setOauthWelcomeOpen(false)
		}
	}, [oauthWelcomeOpen, authStoreState.token, authStoreState.record?.id])

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

				throw new Error('Failed to refresh auth')
			}
		},
		enabled: authStoreState.token != null && authStoreState.isValid,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false,
		retry: 3,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000)
	})

	const loginMutation = useMutation({
		mutationFn: async ({ email, password }: { email: string; password: string }) => {
			try {
				const res = await pb.collection('users').authWithPassword(email, password)

				return res
			} catch (error) {
				console.log('Login error:', error)
				throw new Error('Invalid credentials')
			}
		},
		onError: () => {
			toast.error('Invalid email or password')
		}
	})

	const authUserLoading = !authStoreState.token || !authStoreState.record ? userQueryIsLoading : false
	const userLoading = authUserLoading || (isAuthenticated && subscriptionQuery.data === undefined)

	const login = useCallback(
		async (email: string, password: string, onSuccess?: () => void) => {
			await loginMutation.mutateAsync({ email, password }).catch((error) => {
				console.log('Login error:', error)
				throw error
			})
			if (onSuccess) {
				onSuccess()
			}
		},
		[loginMutation]
	)

	const signupMutation = useMutation({
		mutationFn: async ({
			email,
			password,
			passwordConfirm,
			turnstileToken,
			promotionalEmails
		}: {
			email: string
			password: string
			passwordConfirm: string
			turnstileToken: string
			promotionalEmails?: PromotionalEmailsValue
			suppressVerifyEmailPrompt?: boolean
		}) => {
			const response = await fetch(`${AUTH_SERVER}/auth/signup`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email,
					password,
					passwordConfirm,
					auth_method: 'email',
					source: getSignupSource(),
					referrer: getReferrer(),
					turnstile_token: turnstileToken,
					promotionalEmails,
					sendVerificationEmail: false
				})
			})

			if (!response.ok) {
				const errorData = await response.json()
				throw errorData
			}

			const { token } = await response.json()
			pb.authStore.save(token)
			try {
				await refreshSession()
			} catch (error) {
				console.log('Error refreshing auth after signup:', error)
			}
		},
		onSuccess: (_data, variables) => {
			clearSignupSource()
			sessionStorage.setItem('just_signed_up', 'true')
			if (!variables.suppressVerifyEmailPrompt) {
				setVerifyEmailPrompt({ isOpen: true, email: variables.email })
			}
		},
		onError: (error: any) => {
			if (error?.error === 'User with this email already exists') {
				return
			}
			const message = error.error
			if (message) {
				toast.error(message)
			} else {
				toast.error('Failed to create account. Please try again.')
			}
		}
	})

	const signup = useCallback(
		async (
			email: string,
			password: string,
			passwordConfirm: string,
			turnstileToken: string,
			promotionalEmails?: PromotionalEmailsValue,
			onSuccess?: () => void,
			options?: { suppressVerifyEmailPrompt?: boolean }
		) => {
			const result = await signupMutation.mutateAsync({
				email,
				password,
				passwordConfirm,
				turnstileToken,
				promotionalEmails,
				suppressVerifyEmailPrompt: options?.suppressVerifyEmailPrompt
			})
			onSuccess?.()
			return result
		},
		[signupMutation]
	)

	const logoutMutation = useMutation({
		mutationFn: () => {
			clearUserSession()
			return Promise.resolve(true)
		}
	})

	const logout = useCallback(() => {
		logoutMutation.mutate()
	}, [logoutMutation])

	const authorizedFetch = useCallback(
		async (url: string, options: FetchOptions = {}, onlyToken = false) => {
			const { skipAuth = false, headers = {}, ...rest } = options

			if (skipAuth) {
				return fetch(url, options)
			}

			if (!pb.authStore.isValid) {
				console.log('Not authenticated')
				return null
			}

			const authHeaders = {
				...headers,
				Authorization: onlyToken ? pb.authStore.token : `Bearer ${pb.authStore.token}`
			}

			try {
				const response = await fetch(url, {
					...rest,
					headers: authHeaders
				})

				if (!response.ok) {
					return response
				}

				return response
			} catch (error) {
				if (error instanceof Error && error.message === 'Session expired') {
					toast.error('Your session has expired. Please login again.')
					logout()
				}
				throw error
			}
		},
		[logout]
	)

	const signInWithEthereumMutation = useMutation({
		mutationFn: async ({ address, signMessageFunction }: { address: string; signMessageFunction: any }) => {
			const [createSiweMessage, { nonce }] = await Promise.all([loadCreateSiweMessage(), getNonce(address)])
			const issuedAt = new Date()
			const message = createSiweMessage({
				domain: window.location.host,
				address: address as `0x${string}`,
				statement: 'Sign in with Ethereum to the app.',
				uri: window.location.origin,
				version: '1',
				chainId: 1,
				nonce,
				issuedAt
			})

			const signature = await signMessageFunction({
				message,
				account: address as `0x${string}`
			})

			const response = await fetch(`${AUTH_SERVER}/eth-auth`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message,
					signature,
					address,
					issuedAt: issuedAt.toISOString(),
					source: getSignupSource(),
					referrer: getReferrer()
				})
			})

			if (!response.ok) {
				const errorMessage = await getAuthErrorMessageFromResponse(response, 'Failed to sign in with Ethereum')
				throw new Error(errorMessage)
			}

			const { password, identity, impersonate } = await response.json()

			if (impersonate) {
				pb.authStore.save(impersonate.token, impersonate.record)
			} else {
				await pb.collection('users').authWithPassword(identity, password)
			}

			clearSignupSource()

			return { address }
		}
	})

	const signInWithGithub = async () => {
		try {
			const authData = await pb.collection('users').authWithOAuth2({
				provider: 'github',
				redirectTo: `${window.location.origin}/subscription`
			})

			if (isNewOauthUser(authData)) {
				openOauthWelcome(authData.record.id)
				try {
					await fetch(`${AUTH_SERVER}/user/attribution`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${pb.authStore.token}`
						},
						body: JSON.stringify({
							source: getSignupSource(),
							referrer: getReferrer(),
							provider: 'github'
						})
					})
				} catch {
					// Attribution is best effort; sign-in must not fail because of it.
				}
			}

			return authData
		} catch (error) {
			console.log('github sign-in error:', error)
			throw new Error('Failed to sign in with GitHub')
		}
	}

	const signInWithGithubMutation = useMutation({
		mutationFn: signInWithGithub
	})

	const saveGoogleSession = async (session: GoogleAuthSession) => {
		pb.authStore.save(session.token)
		try {
			await refreshSession()
		} catch (error) {
			console.log('Error refreshing auth after Google sign-in:', error)
		}
	}

	const signInWithGoogleMutation = useMutation({
		mutationFn: async (identityToken: string) => {
			const source = getSignupSource()
			const referrer = getReferrer()
			const response = await fetch(`${AUTH_SERVER}/auth/google-signin`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					identityToken,
					signupClient: 'web',
					source
				})
			})
			if (!response.ok) {
				throw new Error(await getAuthErrorMessageFromResponse(response, 'Failed to sign in with Google'))
			}
			const result = readGoogleAuthResult(await response.json())
			if (result.kind === 'link_verification_required') return result
			await saveGoogleSession(result)
			if (result.isNew) {
				openOauthWelcome(result.user.id)
				try {
					await fetch(`${AUTH_SERVER}/user/attribution`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${pb.authStore.token}`
						},
						body: JSON.stringify({
							referrer,
							source,
							provider: 'google'
						})
					})
				} catch {
					// Attribution is best effort; sign-in must not fail because of it.
				}
			}
			clearSignupSource()
			return result
		}
	})

	const confirmGoogleLinkMutation = useMutation({
		mutationFn: async ({ challengeToken, code }: { challengeToken: string; code: string }) => {
			const response = await fetch(`${AUTH_SERVER}/auth/social-link/confirm`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ challengeToken, code })
			})
			if (!response.ok) {
				throw new Error(await getAuthErrorMessageFromResponse(response, 'Invalid or expired code'))
			}
			const result = readGoogleAuthResult(await response.json())
			if (result.kind !== 'authenticated') throw new Error('Invalid Google link response')
			await saveGoogleSession(result)
			clearSignupSource()
			return result
		}
	})

	const resendGoogleLinkMutation = useMutation({
		mutationFn: async (challengeToken: string) => {
			const response = await fetch(`${AUTH_SERVER}/auth/social-link/resend`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ challengeToken })
			})
			if (!response.ok) {
				throw new Error(await getAuthErrorMessageFromResponse(response, 'Failed to resend verification code'))
			}
			const result = readGoogleAuthResult(await response.json())
			if (result.kind !== 'link_verification_required') throw new Error('Invalid Google link response')
			return result
		}
	})

	const addWalletMutation = useMutation({
		mutationFn: async ({ address, signMessageFunction }: { address: string; signMessageFunction: any }) => {
			if (!pb.authStore.isValid) {
				throw new Error('User not authenticated')
			}

			const [createSiweMessage, { nonce }] = await Promise.all([loadCreateSiweMessage(), getNonce(address)])
			const issuedAt = new Date()
			const message = createSiweMessage({
				domain: window.location.host,
				address: address as `0x${string}`,
				statement: 'Sign in with Ethereum to the app.',
				uri: window.location.origin,
				version: '1',
				chainId: 1,
				nonce,
				issuedAt
			})

			const signature = await signMessageFunction({
				message,
				account: address as `0x${string}`
			})

			const response = await fetch(`${AUTH_SERVER}/add-wallet`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${pb.authStore.token}`
				},
				body: JSON.stringify({ message, signature, address, issuedAt: issuedAt.toISOString() })
			})

			if (!response.ok) {
				const reason = await getAuthErrorMessageFromResponse(response, 'Failed to link wallet')
				throw new Error(reason)
			}

			return { address }
		},
		onSuccess: async () => {
			try {
				await refreshSession()
			} catch {
				/* ignore refresh error */
			}
			toast.success('Wallet linked successfully')
		},
		onError: (error) => {
			const message = error instanceof Error ? error.message : 'Failed to link wallet'
			toast.error(message)
		}
	})

	const addWallet = useCallback(
		async (address: string, signMessageFunction: any, onSuccess?: () => void) => {
			try {
				await addWalletMutation.mutateAsync({ address, signMessageFunction })
				if (onSuccess) {
					onSuccess()
				}
				return Promise.resolve()
			} catch (error) {
				console.log('Add wallet error:', error)
				return Promise.reject(error)
			}
		},
		[addWalletMutation]
	)

	const resetPasswordMutation = useMutation({
		mutationFn: async (email: string) => {
			await pb.collection('users').requestPasswordReset(email)
			toast.success('Password reset email sent')
		}
	})

	const changeEmail = useMutation({
		mutationFn: async (email: string) => {
			try {
				await pb.collection('users').requestEmailChange(email)
				toast.success('Email change request sent')
			} catch {
				toast.error('User with this email already exists')
			}
		}
	})

	const sendOtpMutation = useMutation({
		mutationFn: async () => {
			if (!pb.authStore.isValid) {
				throw new Error('User not authenticated')
			}
			const response = await fetch(`${AUTH_SERVER}/sendOtp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${pb.authStore.token}`
				}
			})
			await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getUserFacingErrorMessage(error, 'Failed to send verification code'))
			})
		},
		onSuccess: () => {
			toast.success('Verification code sent')
		},
		onError: (error: any) => {
			toast.error(getUserFacingErrorMessage(error, 'Failed to send verification code'))
		}
	})

	const verifyOtpMutation = useMutation({
		mutationFn: async (otp: string) => {
			if (!pb.authStore.isValid) {
				throw new Error('User not authenticated')
			}
			const response = await fetch(`${AUTH_SERVER}/verifyOtp`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${pb.authStore.token}`
				},
				body: JSON.stringify({ otp })
			})
			await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getUserFacingErrorMessage(error, 'Invalid or expired code'))
			})
		},
		onSuccess: async () => {
			try {
				await refreshSession()
			} catch (error) {
				console.log('Error refreshing auth after OTP verification:', error)
			}
			toast.success('Email verified')
		},
		onError: (error: any) => {
			toast.error(getUserFacingErrorMessage(error, 'Invalid or expired code'))
		}
	})

	const addEmail = useMutation({
		mutationFn: async (email: string) => {
			const response = await fetch(`${AUTH_SERVER}/add-email`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${pb.authStore.token}`
				},
				body: JSON.stringify({ email })
			})
			await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getUserFacingErrorMessage(error, 'Failed to add email'))
			})
		},
		onSuccess: () => {
			toast.success('Email added successfully')
		},
		onError: (error: any) => {
			toast.error(getUserFacingErrorMessage(error, 'Failed to add email'))
		}
	})

	const setPromotionalEmails = useMutation({
		mutationFn: async (value: string) => {
			const response = await fetch(`${AUTH_SERVER}/user/promotional-emails`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${pb.authStore.token}`
				},
				body: JSON.stringify({ value })
			})
			await handleSimpleFetchResponse(response).catch((error) => {
				throw new Error(getUserFacingErrorMessage(error, 'Failed to update promotional emails preference'))
			})

			return { value }
		},
		onSuccess: async (data) => {
			queryClient.setQueryData(['auth', 'status', authStoreState?.record?.id ?? null], (oldData: any) => {
				if (!oldData) return oldData
				return {
					...oldData,
					promotionalEmails: data.value
				}
			})
			try {
				await refreshSession()
			} catch (error) {
				console.log('Error refreshing auth after promotional emails update:', error)
			}
		},
		onError: (error: any) => {
			console.log('Failed to update promotional emails preference:', error)
		}
	})

	// Settings gets toasts (no dialog is open there); the onboarding dialog
	// renders the same outcomes inline instead.
	const setPromotionalEmailsFromSettings = useCallback(
		(value: string) => {
			setPromotionalEmails.mutate(value, {
				onSuccess: () => toast.success('Email preferences updated successfully'),
				onError: (error) => toast.error(getUserFacingErrorMessage(error, 'Failed to update email preferences'))
			})
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
		logout,
		authorizedFetch,
		signInWithEthereumMutation,
		signInWithGithubMutation,
		signInWithGoogleMutation,
		confirmGoogleLinkMutation,
		resendGoogleLinkMutation,
		addWallet,
		resetPasswordMutation,
		changeEmail: changeEmail.mutate,
		sendOtp: sendOtpMutation.mutateAsync,
		verifyOtp: verifyOtpMutation.mutateAsync,
		addEmail: addEmail.mutateAsync,
		setPromotionalEmails: setPromotionalEmailsFromSettings,
		promptVerifyEmail,
		isAuthenticated,
		authToken: isAuthenticated ? authStoreState.token : null,
		hasActiveSubscription: subscriptionQuery.data?.status === 'active',
		isTrial: Boolean(userData?.flags?.is_trial),
		loaders: {
			login: loginMutation.isPending,
			signup: signupMutation.isPending,
			logout: logoutMutation.isPending,
			addWallet: addWalletMutation.isPending,
			changeEmail: changeEmail.isPending,
			sendOtp: sendOtpMutation.isPending,
			verifyOtp: verifyOtpMutation.isPending,
			addEmail: addEmail.isPending,
			setPromotionalEmails: setPromotionalEmails.isPending,
			userLoading
		}
	}

	return (
		<AuthContext.Provider value={contextValue}>
			{children}
			<VerifyEmailConfirmDialog
				isOpen={verifyEmailConfirm.isOpen}
				onConfirm={() => {
					const email = verifyEmailConfirm.email
					setVerifyEmailConfirm({ isOpen: false })
					setVerifyEmailPrompt({ isOpen: true, email })
				}}
				onClose={() => setVerifyEmailConfirm({ isOpen: false })}
			/>
			<VerifyEmailDialog
				isOpen={verifyEmailPrompt.isOpen}
				email={verifyEmailPrompt.email}
				sendOtp={contextValue.sendOtp}
				verifyOtp={contextValue.verifyOtp}
				loaders={contextValue.loaders}
				onClose={() => setVerifyEmailPrompt({ isOpen: false })}
			/>
			{/* Mount per onboarding instance so a later account can't inherit this one's
			    consent choices. Close only after the preference write succeeds; on error
			    the mutation toasts and the dialog stays open for a retry. */}
			{oauthWelcomeOpen ? (
				<OAuthWelcomeDialog
					isOpen
					isSaving={setPromotionalEmails.isPending}
					error={
						setPromotionalEmails.isError
							? getUserFacingErrorMessage(
									setPromotionalEmails.error,
									'Failed to save your preference. Please try again.'
								)
							: null
					}
					onContinue={(value) => {
						setPromotionalEmails.mutate(value, { onSuccess: () => setOauthWelcomeOpen(false) })
					}}
				/>
			) : null}
		</AuthContext.Provider>
	)
}

export const useAuthContext = () => {
	const context = useContext(AuthContext)
	if (!context) {
		throw new Error('useAuth must be used within an AuthProvider')
	}
	return context
}

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
