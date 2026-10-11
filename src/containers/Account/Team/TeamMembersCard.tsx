import { useRef } from 'react'
import { Card } from '~/ui/Card'
import { Icon } from '~/ui/Icon'
import { EmptyState } from '~/ui/Status'
import { MemberRow } from './MemberRow'
import { useTeam } from './useTeam'

export function TeamMembersCard() {
	const { members } = useTeam()
	const headingRef = useRef<HTMLHeadingElement>(null)

	return (
		<Card padding="md" className="flex flex-col gap-4">
			<div className="flex items-center gap-2">
				<Icon name="users" className="size-5 text-primary" />
				<h2 ref={headingRef} tabIndex={-1} className="label-lg text-primary">
					Members ({members.length})
				</h2>
			</div>

			{members.length === 0 ? (
				<EmptyState size="md" icon="users" title="No members yet">
					Send invites to add team members.
				</EmptyState>
			) : (
				<div className="flex flex-col gap-2">
					{members.map((member) => (
						<MemberRow key={member.id} member={member} finalFocus={headingRef} />
					))}
				</div>
			)}
		</Card>
	)
}
