import { useQuery } from '@tanstack/react-query'
import { Icon } from '~/components/Icon'
import { BasicLink } from '~/components/Link'
import { getMyDashboardAuthorProfile } from '~/containers/Authors/api'
import { avatarColorStyle } from '~/containers/Authors/avatarColor'
import { hasCustomizedAuthorProfile } from '~/containers/Authors/profileDefaults'
import { useAuthContext } from '~/containers/Subscription/auth'

export function AuthorProfileStrip() {
	const { authorizedFetch, isAuthenticated, loaders, user } = useAuthContext()
	const { data: profile } = useQuery({
		queryKey: ['dashboard-author-profile', user?.id],
		queryFn: () => getMyDashboardAuthorProfile(authorizedFetch),
		enabled: isAuthenticated && !loaders.userLoading && !!user?.id,
		retry: false,
		refetchOnWindowFocus: false
	})

	if (!profile) return null

	const customized = hasCustomizedAuthorProfile(profile)

	return (
		<div
			className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2.5 ${
				customized
					? 'border-(--legacy-cards-border) bg-(--legacy-cards-bg)'
					: 'border-(--legacy-link-text)/20 bg-(--legacy-link-button)'
			}`}
		>
			{profile.avatarUrl ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img src={profile.avatarUrl} alt="" className="size-10 shrink-0 rounded-full object-cover" />
			) : (
				<span
					className="flex size-10 shrink-0 items-center justify-center rounded-full text-xl"
					style={avatarColorStyle(profile.slug)}
				>
					🦙
				</span>
			)}
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm font-semibold text-(--legacy-text-primary)">
					{profile.displayName} <span className="font-normal text-(--legacy-text-label)">@{profile.slug}</span>
				</p>
				<p className="mt-0.5 truncate text-xs text-(--legacy-text-secondary)">
					{customized
						? 'This is how you appear on your public dashboards.'
						: 'Add your name, avatar, and links to stand out on your dashboards and Top Authors.'}
				</p>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<BasicLink
					href={`/authors/${profile.slug}`}
					className="rounded-md border border-(--legacy-cards-border) px-3 py-1.5 text-xs font-medium text-(--legacy-text-secondary) hover:text-(--legacy-text-primary)"
				>
					View public profile
				</BasicLink>
				<BasicLink
					href="/account?tab=profile"
					data-umami-event="dashboard-edit-author-profile"
					className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium ${
						customized
							? 'border border-(--legacy-cards-border) text-(--legacy-text-secondary) hover:text-(--legacy-text-primary)'
							: 'bg-(--legacy-link-text) text-white'
					}`}
				>
					<Icon name="pencil" height={12} width={12} />
					{customized ? 'Edit profile' : 'Set up profile'}
				</BasicLink>
			</div>
		</div>
	)
}
