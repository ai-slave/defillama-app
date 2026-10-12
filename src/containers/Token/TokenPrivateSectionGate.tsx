import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { Button } from '~/ui/Button'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { EmptyState, SurfaceBodyLoadingStatus, SurfaceBodyStatus } from '~/ui/Status'
import { httpErrorMessage } from '~/utils/async'
import type { QueryRetry } from '~/utils/query'
import { getTokenPrivateSectionView } from './TokenPrivateSectionGate.utils'

export function TokenPrivateSectionGate({
	title,
	sectionId,
	lockedTitle,
	isLoading,
	error,
	retry,
	errorMessage,
	emptyMessage,
	headerActions,
	bodyClassName = 'flex flex-1 flex-col p-2',
	children
}: {
	title: string
	sectionId: string
	/** The gate's title for a reader without a subscription: "Token usage needs a subscription". */
	lockedTitle: string
	isLoading?: boolean
	error?: Error | null
	/** The section's query, so a failed read offers Try again. */
	retry: QueryRetry
	errorMessage: string
	emptyMessage?: string | null
	headerActions?: ReactNode
	bodyClassName?: string
	children: ReactNode
}) {
	const router = useRouter()
	const { hasActiveSubscription, isAuthenticated, loaders } = useAuthContext()
	const signInDialogStore = Ariakit.useDialogStore()
	const view = getTokenPrivateSectionView({
		isAuthenticated,
		hasActiveSubscription,
		isLoading: loaders.userLoading || Boolean(isLoading),
		hasError: error != null,
		hasEmptyMessage: emptyMessage != null
	})
	const hasPlaceholderState = view !== 'content'
	const sectionBodyClassName = hasPlaceholderState ? `${bodyClassName} flex-1` : bodyClassName

	return (
		<>
			<Panel className={hasPlaceholderState ? 'min-h-[80dvh] sm:min-h-[572px]' : undefined}>
				<PanelHeader>
					<PanelTitle className="scroll-mt-24" anchor={sectionId}>
						{title}
					</PanelTitle>

					{headerActions}
				</PanelHeader>

				<div className={sectionBodyClassName}>
					{view === 'loading' ? (
						<SurfaceBodyLoadingStatus label={`Loading ${title.toLowerCase()}`} />
					) : view === 'sign-in' || view === 'subscribe' ? (
						<EmptyState
							size="md"
							icon="lock"
							title={lockedTitle}
							actions={
								view === 'sign-in' ? (
									<Button type="button" variant="primary" size="sm" onClick={signInDialogStore.show}>
										Sign in
									</Button>
								) : (
									<Button
										as={BasicLink}
										href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`}
										variant="primary"
										size="sm"
									>
										Subscribe
									</Button>
								)
							}
						/>
					) : view === 'error' ? (
						<SurfaceBodyStatus variant="error" retry={retry}>
							{httpErrorMessage(error, errorMessage)}
						</SurfaceBodyStatus>
					) : view === 'empty' ? (
						<SurfaceBodyStatus variant="empty">{emptyMessage}</SurfaceBodyStatus>
					) : (
						children
					)}
				</div>
			</Panel>

			<SignInModal store={signInDialogStore} />
		</>
	)
}
