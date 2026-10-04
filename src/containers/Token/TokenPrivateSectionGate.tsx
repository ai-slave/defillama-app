import * as Ariakit from '@ariakit/react'
import { useRouter } from 'next/router'
import type { ReactNode } from 'react'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { Icon } from '~/ui/Icon'
import { Panel, PanelHeader, PanelTitle } from '~/ui/Panel'
import { LoadingIndicator } from '~/ui/Status'
import { getTokenPrivateSectionView } from './TokenPrivateSectionGate.utils'

export function TokenPrivateSectionGate({
	title,
	sectionId,
	contentLabel,
	isLoading,
	error,
	errorMessage,
	emptyMessage,
	headerActions,
	bodyClassName = 'flex flex-1 flex-col p-2',
	children
}: {
	title: string
	sectionId: string
	contentLabel: string
	isLoading?: boolean
	error?: Error | null
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
			<Panel padding="none" className={hasPlaceholderState ? 'min-h-[80dvh] sm:min-h-[572px]' : undefined}>
				<PanelHeader>
					<PanelTitle className="group relative flex scroll-mt-24 items-center gap-1" id={sectionId}>
						{title}
						<a
							aria-hidden="true"
							tabIndex={-1}
							href={`#${sectionId}`}
							className="absolute top-0 right-0 z-10 flex size-full items-center"
						/>
						<Icon name="link" className="invisible size-3.5 group-hover:visible group-focus-visible:visible" />
					</PanelTitle>

					{headerActions}
				</PanelHeader>

				<div className={sectionBodyClassName}>
					{view === 'loading' ? (
						<div className="flex flex-1 items-center justify-center">
							<LoadingIndicator />
						</div>
					) : view === 'sign-in' || view === 'subscribe' ? (
						<div className="flex flex-1 items-center justify-center px-4 text-center">
							{view === 'sign-in' ? (
								<p className="body-sm text-secondary">
									An{' '}
									<button type="button" onClick={signInDialogStore.show} className="underline">
										active subscription
									</button>{' '}
									is required to view {contentLabel}.
								</p>
							) : (
								<p className="body-sm text-secondary">
									An{' '}
									<BasicLink
										href={`/subscription?returnUrl=${encodeURIComponent(router.asPath)}`}
										className="underline"
									>
										active subscription
									</BasicLink>{' '}
									is required to view {contentLabel}.
								</p>
							)}
						</div>
					) : view === 'error' ? (
						<div className="flex flex-1 items-center justify-center px-4 text-center">
							<p className="max-w-md body-sm text-secondary">{error?.message || errorMessage}</p>
						</div>
					) : view === 'empty' ? (
						<div className="flex flex-1 items-center justify-center px-4 text-center">
							<p className="body-sm text-secondary">{emptyMessage}</p>
						</div>
					) : (
						children
					)}
				</div>
			</Panel>

			<SignInModal store={signInDialogStore} />
		</>
	)
}
