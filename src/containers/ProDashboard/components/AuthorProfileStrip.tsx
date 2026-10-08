import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { getMyDashboardAuthorProfile } from '~/containers/Authors/api'
import { avatarColorStyle } from '~/containers/Authors/avatarColor'
import { hasCustomizedAuthorProfile } from '~/containers/Authors/profileDefaults'
import { Button } from '~/ui/Button'

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
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-3 text-sm">
				{profile.avatarUrl ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img src={profile.avatarUrl} alt="" loading="lazy" className="size-6 shrink-0 rounded-full object-cover" />
				) : (
					<span
						className="flex size-6 shrink-0 items-center justify-center rounded-full text-sm"
						style={avatarColorStyle(profile.slug)}
					>
						🦙
					</span>
				)}
				<p className="min-w-0 truncate font-medium text-pro-text-primary">
					{profile.displayName} <span className="font-normal text-pro-text-tertiary">@{profile.slug}</span>
				</p>
				<div className="ml-auto flex shrink-0 items-center gap-1">
					<Button as={BasicLink} href={`/authors/${profile.slug}`} size="sm" variant="ghost">
						View profile
					</Button>
					<Button
						as={BasicLink}
						href="/account?tab=profile"
						size="sm"
						variant="ghost"
						data-umami-event="dashboard-edit-author-profile"
					>
						{customized ? 'Edit profile' : 'Set up profile'}
					</Button>
				</div>
			</div>
			{customized ? null : (
				<p className="text-xs text-pro-text-tertiary">
					Add your name, avatar, and links to stand out on your dashboards and Top Authors.
				</p>
			)}
		</div>
	)
}
