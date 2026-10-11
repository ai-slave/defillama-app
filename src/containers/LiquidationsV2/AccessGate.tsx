import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { Button } from '~/ui/Button'
import { Panel } from '~/ui/Panel'
import { EmptyState, SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import type { QueryRetry } from '~/utils/query'
import type { NavLink } from './api.types'

interface LiquidationsShellChromeProps {
	protocolLinks?: Array<NavLink>
	chainLinks?: Array<NavLink>
	activeProtocolLink?: string
	activeChainLink?: string
}

interface LiquidationsShellCardProps extends LiquidationsShellChromeProps {
	/** The panel body: a loading, error or gate state. */
	children: React.ReactNode
}

function LiquidationsShellChrome({
	protocolLinks,
	chainLinks,
	activeProtocolLink,
	activeChainLink
}: LiquidationsShellChromeProps) {
	return (
		<>
			{protocolLinks?.length ? (
				<RowLinksWithDropdown
					heading="Protocols"
					links={protocolLinks}
					{...(activeProtocolLink ? { activeLink: activeProtocolLink } : {})}
				/>
			) : null}
			{chainLinks && chainLinks.length > 2 ? (
				<RowLinksWithDropdown
					heading="Chains"
					links={chainLinks}
					{...(activeChainLink ? { activeLink: activeChainLink } : {})}
				/>
			) : null}
		</>
	)
}

function LiquidationsShellCard({
	children,
	protocolLinks,
	chainLinks,
	activeProtocolLink,
	activeChainLink
}: LiquidationsShellCardProps) {
	return (
		<>
			<LiquidationsShellChrome
				{...(protocolLinks ? { protocolLinks } : {})}
				{...(chainLinks ? { chainLinks } : {})}
				{...(activeProtocolLink ? { activeProtocolLink } : {})}
				{...(activeChainLink ? { activeChainLink } : {})}
			/>

			<Panel className="min-h-[380px] w-full flex-1">{children}</Panel>
		</>
	)
}

export function LiquidationsShellLoader(props: LiquidationsShellChromeProps) {
	return (
		<LiquidationsShellCard {...props}>
			<SurfaceBodyLoadingStatus />
		</LiquidationsShellCard>
	)
}

export function LiquidationsShellError({
	errorMessage,
	retry,
	...props
}: LiquidationsShellChromeProps & { errorMessage: string; retry: QueryRetry }) {
	return (
		<LiquidationsShellCard {...props}>
			<SurfaceBodyStatus variant="error" retry={retry}>
				{errorMessage}
			</SurfaceBodyStatus>
		</LiquidationsShellCard>
	)
}

export function LiquidationsAccessGate(props: LiquidationsShellChromeProps) {
	const router = useRouter()
	const signInDialogStore = Ariakit.useDialogStore()
	const { isAuthenticated, loaders } = useAuthContext()

	// The sign-in stays mounted through the account load, so a sign-in from another tab ends on its own step.
	return (
		<>
			{loaders.userLoading ? (
				<LiquidationsShellLoader {...props} />
			) : (
				<LiquidationsShellCard {...props}>
					<EmptyState
						size="md"
						icon="lock"
						title="Liquidations need a subscription"
						actions={
							isAuthenticated ? (
								<Button
									as={BasicLink}
									href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`}
									variant="primary"
									size="sm"
								>
									Subscribe
								</Button>
							) : (
								<Button type="button" variant="primary" size="sm" onClick={signInDialogStore.show}>
									Sign in
								</Button>
							)
						}
					>
						See positions, prices and liquidation levels by protocol and chain.
					</EmptyState>
				</LiquidationsShellCard>
			)}

			<SignInModal store={signInDialogStore} />
		</>
	)
}
