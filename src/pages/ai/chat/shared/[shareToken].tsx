import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useCallback, useState } from 'react'
import { useAuthContext } from '~/auth'
import { setReferrer } from '~/auth/referrer'
import { BasicLink } from '~/components/Link'
import { AI_SERVER } from '~/constants'
import { AgenticChat } from '~/containers/LlamaAI'
import { LlamaAIAnimationPreloads } from '~/containers/LlamaAI/components/status/LlamaAIAnimationPreloads'
import { toSessionId } from '~/containers/LlamaAI/ids'
import { buildForkedSharedRoute, replaceSharedForkHistoryPath } from '~/containers/LlamaAI/sharedForkRoute'
import { LlamaAIMobileAppGate } from '~/containers/MobileApp/LlamaAIMobileAppGate'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { LlamaAIRouteProvider, type LlamaAIRouteState } from '~/contexts/LlamaAIRouteState'
import Layout from '~/layout'
import { Button } from '~/ui/Button'
import { EmptyState, PanelLoadingStatus, PanelStatus } from '~/ui/Status'
import { fetchJson } from '~/utils/async'
import pb from '~/utils/pocketbase'
import { queryReadFailed } from '~/utils/query'
import { withServerSidePropsTelemetry } from '~/utils/telemetry'

interface SharedSession {
	session: {
		sessionId: string
		title: string
		createdAt: string
		isPublic: boolean
	}
	// API now returns role-based format
	messages: Array<{
		role: 'user' | 'assistant'
		content: string
		messageId?: string
		timestamp: number
		sequenceNumber?: number
		images?: Array<{ url: string; mimeType: string; filename?: string }>
		// Assistant-specific fields
		metadata?: any
		suggestions?: Array<any>
		charts?: Array<any>
		chartData?: Array<any> | Record<string, Array<any>>
		citations?: Array<string>
		csvExports?: Array<{ id: string; title: string; url: string; rowCount: number; filename: string }>
	}>
	isPublicView: true
}

interface PageProps {
	shareToken: string
	sessionTitle: string | null
}

const getServerSidePropsHandler: GetServerSideProps<PageProps> = async (context) => {
	const shareToken = context.params?.shareToken as string

	let sessionTitle: string | null = null
	try {
		const data = await fetchJson<SharedSession>(`${AI_SERVER}/user/public/${shareToken}`)
		sessionTitle = data?.session?.title || null
	} catch {
		// Session might not exist or be private — page will handle the error state
	}

	return {
		props: { shareToken, sessionTitle }
	}
}

export const getServerSideProps = withServerSidePropsTelemetry<PageProps>(
	'/ai/chat/shared/[shareToken]',
	getServerSidePropsHandler
)

// A link to a conversation that is gone or private resolves to null (not found), which is not a failed read.
async function getSharedSession(shareToken: string): Promise<SharedSession | null> {
	// fetchJson's browser timeout: a server that never answers ends in the error state, not a loader that spins forever.
	const res = await fetch(`${AI_SERVER}/user/public/${shareToken}`, { signal: AbortSignal.timeout(60_000) })
	// Every 4xx means this link has no conversation to show (revoked, expired, malformed); 5xx stays a failed read.
	if (res.status >= 400 && res.status < 500) return null
	if (!res.ok) throw new Error(`Shared conversation failed with ${res.status}`)
	return res.json()
}

export default function SharedConversationPage({ shareToken: ssrToken, sessionTitle }: PageProps) {
	const router = useRouter()
	const shareToken = (router.query.shareToken as string) || ssrToken
	const { user } = useAuthContext()
	const [pendingMessage, setPendingMessage] = useState<string | null>(null)
	const [routeOverride, setRouteOverride] = useState<LlamaAIRouteState>({ kind: 'unknown' })
	const signInDialogStore = Ariakit.useDialogStore({
		// Closing sign-in without a session drops the question, so a later sign-in never sends it. Reads the session
		// itself: this runs before the dialog finishes a sign-in from another tab on the same close.
		setOpen: (open) => {
			if (!open && !pb.authStore.isValid) setPendingMessage(null)
		}
	})

	const ogImageUrl = `${AI_SERVER}/user/og/${shareToken}`
	const title = sessionTitle || 'AI Crypto Analysis - LlamaAI'
	const description = sessionTitle
		? `${sessionTitle} — AI-powered DeFi analysis by LlamaAI`
		: 'Get AI-powered answers about chains, protocols, metrics like TVL, fees, revenue, and compare them based on your prompts'

	const sessionQuery = useQuery({
		queryKey: ['llamaai', 'shared-session', shareToken],
		queryFn: () => getSharedSession(shareToken),
		enabled: !!shareToken && typeof shareToken === 'string',
		staleTime: Infinity,
		refetchOnWindowFocus: false,
		retry: false
	})
	const session = sessionQuery.data

	// Unauth user submitting: save message + show login. After login, the
	// `initialPrompt` below auto-fires AgenticChat's in-place fork.
	const handleForkSubmit = useCallback(
		(prompt: string) => {
			if (shareToken) {
				setReferrer(`shared-conversation:${shareToken}`)
			}
			setPendingMessage(prompt)
			signInDialogStore.show()
		},
		[signInDialogStore, shareToken]
	)

	// After login, hand the saved message to AgenticChat as initialPrompt so it auto-submits in-place.
	const initialPrompt = user && pendingMessage ? pendingMessage : undefined
	const handleSharedSessionFork = useCallback((sessionId: string) => {
		const forkedSessionId = toSessionId(sessionId)
		replaceSharedForkHistoryPath(forkedSessionId)
		setRouteOverride(buildForkedSharedRoute(forkedSessionId))
	}, [])

	const head = (
		<Head>
			<meta property="og:image" content={ogImageUrl} />
			<meta name="twitter:card" content="summary_large_image" />
			<meta name="twitter:image" content={ogImageUrl} />
		</Head>
	)

	if (queryReadFailed(sessionQuery)) {
		return (
			<Layout title={title} description={description} canonicalUrl={null} noIndex>
				{head}
				<LlamaAIMobileAppGate>
					<PanelStatus variant="error" retry={sessionQuery}>
						Couldn't load this conversation.
					</PanelStatus>
				</LlamaAIMobileAppGate>
			</Layout>
		)
	}

	if (sessionQuery.isLoading || !router.isReady) {
		return (
			<Layout title={title} description={description} canonicalUrl={null} noIndex>
				{head}
				<LlamaAIMobileAppGate>
					<LlamaAIAnimationPreloads />
					<PanelLoadingStatus label="Loading conversation" />
				</LlamaAIMobileAppGate>
			</Layout>
		)
	}

	if (!session) {
		return (
			<Layout
				title="Conversation Not Found - DefiLlama"
				description="The requested conversation could not be found"
				canonicalUrl={null}
				noIndex
			>
				<LlamaAIMobileAppGate>
					<EmptyState
						size="lg"
						headingAs="h1"
						title="Conversation not found"
						actions={
							<Button as={BasicLink} href="/ai/chat" size="md">
								Go to LlamaAI
							</Button>
						}
					>
						The conversation may have been made private or the link is invalid.
					</EmptyState>
				</LlamaAIMobileAppGate>
			</Layout>
		)
	}

	return (
		<Layout title={title} description={description} canonicalUrl={null} noIndex hideDesktopSearchLlamaAiButton>
			{head}
			<LlamaAIMobileAppGate>
				<LlamaAIAnimationPreloads />
				<LlamaAIRouteProvider value={routeOverride}>
					<AgenticChat
						sharedSession={session as any}
						shareToken={shareToken}
						onForkSubmit={handleForkSubmit}
						onSharedSessionFork={handleSharedSessionFork}
						initialPrompt={initialPrompt}
					/>
				</LlamaAIRouteProvider>
				<SignInModal store={signInDialogStore} />
			</LlamaAIMobileAppGate>
		</Layout>
	)
}
