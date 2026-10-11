import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { RowLinksWithDropdown } from '~/components/RowLinksWithDropdown'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { Panel } from '~/ui/Panel'
import { SurfaceBodyLoadingStatus, SurfaceBodyStatus, type StatusVariant } from '~/ui/Status'
import type { NavLink } from './api.types'

interface LiquidationsShellChromeProps {
	protocolLinks?: Array<NavLink>
	chainLinks?: Array<NavLink>
	activeProtocolLink?: string
	activeChainLink?: string
}

interface LiquidationsShellCardProps extends LiquidationsShellChromeProps {
	children?: React.ReactNode
	statusVariant?: StatusVariant
	textClassName?: string
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
	activeChainLink,
	statusVariant = 'empty',
	textClassName = 'body-md text-secondary'
}: LiquidationsShellCardProps) {
	return (
		<>
			<LiquidationsShellChrome
				{...(protocolLinks ? { protocolLinks } : {})}
				{...(chainLinks ? { chainLinks } : {})}
				{...(activeProtocolLink ? { activeProtocolLink } : {})}
				{...(activeChainLink ? { activeChainLink } : {})}
			/>

			<Panel className="w-full flex-1">
				{statusVariant === 'loading' ? (
					<SurfaceBodyLoadingStatus className="min-h-[380px]" />
				) : (
					<SurfaceBodyStatus
						variant={statusVariant}
						className="min-h-[380px]"
						contentClassName="flex max-w-xl flex-col items-center gap-3 px-6 py-8"
						textClassName={textClassName}
					>
						{children}
					</SurfaceBodyStatus>
				)}
			</Panel>
		</>
	)
}

export function LiquidationsShellLoader(props: LiquidationsShellChromeProps) {
	return <LiquidationsShellCard {...props} statusVariant="loading" />
}

export function LiquidationsShellError({
	errorMessage,
	...props
}: LiquidationsShellChromeProps & { errorMessage: string }) {
	return (
		<LiquidationsShellCard {...props} statusVariant="error" textClassName="body-sm text-error">
			{errorMessage}
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
					{!isAuthenticated ? (
						<p className="body-md text-secondary">
							An{' '}
							<button type="button" onClick={signInDialogStore.show} className="underline">
								active subscription
							</button>{' '}
							is required to view liquidations data.
						</p>
					) : (
						<p className="body-md text-secondary">
							An{' '}
							<BasicLink href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`} className="underline">
								active subscription
							</BasicLink>{' '}
							is required to view liquidations data.
						</p>
					)}
				</LiquidationsShellCard>
			)}

			<SignInModal store={signInDialogStore} />
		</>
	)
}
