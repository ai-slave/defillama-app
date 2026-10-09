import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { Button, StableLabel } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { followAuthor } from './api'
import type { AuthorPageResponse } from './types'

export function FollowAuthorButton({
	slug,
	following,
	isOwnProfile
}: {
	slug: string
	following?: boolean
	isOwnProfile: boolean
}) {
	const { authorizedFetch, isAuthenticated } = useAuthContext()
	const queryClient = useQueryClient()
	const mutation = useMutation({
		mutationFn: () => followAuthor(slug, authorizedFetch),
		onSuccess: (data) => {
			queryClient.setQueriesData(
				{ queryKey: ['author-page', slug], exact: false },
				(oldData: AuthorPageResponse | undefined) => {
					if (!oldData) return oldData
					return {
						...oldData,
						stats: { ...oldData.stats, followerCount: data.followerCount },
						viewer: { ...oldData.viewer, following: data.following }
					}
				}
			)
			queryClient.invalidateQueries({ queryKey: ['pro-dashboard', 'following-authors'] })
			toast.success(data.following ? 'Following author' : 'Unfollowed author')
		},
		onError: (error: unknown) => {
			toast.error(error instanceof Error ? error.message : 'Failed to update follow')
		}
	})

	if (isOwnProfile) return null

	const isFollowing = mutation.data?.following ?? following ?? false

	return (
		<Button
			variant={isFollowing ? 'secondary' : 'primary'}
			size="md"
			// One busy label for both directions, so the button keeps its width after the toggle settles.
			pendingLabel="Updating…"
			pending={mutation.isPending}
			onClick={() => {
				if (!isAuthenticated) {
					toast.error('Please sign in to follow authors')
					return
				}
				mutation.mutate()
			}}
		>
			<Icon name={isFollowing ? 'check' : 'plus'} className="size-3.5" />
			<StableLabel labels={['Follow', 'Following']} current={isFollowing ? 'Following' : 'Follow'} />
		</Button>
	)
}
