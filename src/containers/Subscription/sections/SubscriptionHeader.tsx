import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { ThemeSwitch } from '~/components/Nav/ThemeSwitch'
import { SignInModal } from '~/containers/Subscription/SignInModal'
import { useIsClient } from '~/hooks/useIsClient'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Skeleton } from '~/ui/Skeleton'

function AuthActions({ accountClassName }: { accountClassName: string }) {
	const isClient = useIsClient()
	const { isAuthenticated, loaders } = useAuthContext()

	// The sign-in stays mounted through every auth state, so a sign-in from another tab ends on its own step instead of
	// vanishing with the signed-out branch. Its trigger hides itself while the account loads and once signed in.
	return (
		<>
			{!isClient || loaders.userLoading ? (
				<Skeleton className="h-8 w-16 rounded-lg" />
			) : isAuthenticated ? (
				<BasicLink href="/account" className={`flex items-center gap-1.5 text-sub-text-primary ${accountClassName}`}>
					<img src="/assets/account_avatar.png" alt="" className="size-6 rounded-full" />
					<span>My Account</span>
					<Icon name="chevron-right" className="size-3.5" />
				</BasicLink>
			) : null}
			{isClient ? (
				<SignInModal
					trigger={
						<Button variant="primary" size="md">
							Sign in
						</Button>
					}
				/>
			) : null}
		</>
	)
}

export function SubscriptionHeader() {
	return (
		<>
			{/* Mobile */}
			<header className="relative z-20 flex h-16 items-center justify-between bg-sub-overlay px-4 backdrop-blur-[12px] md:hidden">
				<BasicLink href="/" aria-label="Back to home" className="flex size-10 items-center justify-center rounded-full">
					<Icon name="chevron-left" height={28} width={28} />
				</BasicLink>
				<div className="flex items-center gap-4">
					<ThemeSwitch variant="pill" />
					<AuthActions accountClassName="label-md" />
				</div>
			</header>

			{/* Desktop */}
			<header className="relative z-20 hidden h-12 items-center justify-between bg-sub-overlay px-10.5 backdrop-blur-[12px] md:flex">
				<BasicLink href="/" className="flex items-center gap-2 body-sm text-sub-text-primary">
					<Icon name="chevron-left" height={16} width={16} />
					Back
				</BasicLink>
				<div className="flex items-center gap-5">
					<ThemeSwitch variant="pill" size="sm" />
					<AuthActions accountClassName="label-sm" />
				</div>
			</header>
		</>
	)
}
