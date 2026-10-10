import type { ReactElement, ReactNode } from 'react'
import { useAuthContext } from '~/auth'
import { SiteSearchHotkey } from '~/components/Search'
import { AgenticChat } from '~/containers/LlamaAI'
import { LlamaAIAnimationPreloads } from '~/containers/LlamaAI/components/status/LlamaAIAnimationPreloads'
import { LlamaAIMobileAppGate } from '~/containers/MobileApp/LlamaAIMobileAppGate'
import { LlamaAIRouteProvider, useLlamaAIRouteState, type LlamaAIRouteState } from '~/contexts/LlamaAIRouteState'
import { SessionAliasProvider } from '~/contexts/SessionAliasRegistry'
import Layout from '~/layout'
import { PanelLoadingStatus } from '~/ui/Status'

const CHAT_SEO = {
	title: 'AI Crypto Analysis - DeFi & TradFi Data - LlamaAI',
	description:
		'Get AI-powered answers about chains, protocols, metrics like TVL, fees, revenue, and compare them based on your prompts',
	canonicalUrl: null,
	noIndex: true
} as const

const PROJECT_SEO = {
	title: 'Project - LlamaAI',
	description: 'Project workspace',
	canonicalUrl: null,
	noIndex: true
} as const

const PROJECTS_SEO = {
	title: 'Projects - LlamaAI',
	description: 'Manage knowledge projects for LlamaAI chats',
	canonicalUrl: null,
	noIndex: true
} as const

function seoFromRoute(route: LlamaAIRouteState) {
	if (route.kind === 'project-list') return PROJECTS_SEO
	return route.kind === 'project' ? PROJECT_SEO : CHAT_SEO
}

export function LlamaAIShell({ children }: { children: ReactNode }) {
	const route = useLlamaAIRouteState()
	const { user, loaders } = useAuthContext()
	const userId = user?.id ?? null
	const shouldMountChat = !!user && !loaders.userLoading && route.kind !== 'unknown'

	return (
		<Layout {...seoFromRoute(route)} hideDesktopSearch>
			<SiteSearchHotkey />
			<LlamaAIMobileAppGate>
				<LlamaAIAnimationPreloads />
				<SessionAliasProvider userId={userId}>
					<LlamaAIRouteProvider value={route}>
						{loaders.userLoading ? <PanelLoadingStatus label="Loading account" /> : null}
						{shouldMountChat ? <AgenticChat /> : null}
						{children}
					</LlamaAIRouteProvider>
				</SessionAliasProvider>
			</LlamaAIMobileAppGate>
		</Layout>
	)
}

LlamaAIShell.getLayout = (page: ReactElement) => <LlamaAIShell>{page}</LlamaAIShell>
