import { useRef } from 'react'
import { Icon } from '~/ui/Icon'
import { MemberRow } from './MemberRow'
import { useTeam } from './useTeam'

export function TeamMembersCard() {
	const { members } = useTeam()
	const headingRef = useRef<HTMLHeadingElement>(null)

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface p-4">
			<div className="flex items-center gap-2">
				<Icon name="users" className="size-5 text-primary" />
				<h2 ref={headingRef} tabIndex={-1} className="label-lg text-primary">
					Members ({members.length})
				</h2>
			</div>

			{members.length === 0 ? (
				<p className="body-md text-tertiary">No members yet. Send invites to add team members.</p>
			) : (
				<div className="flex flex-col gap-2">
					{members.map((member) => (
						<MemberRow key={member.id} member={member} finalFocus={headingRef} />
					))}
				</div>
			)}
		</div>
	)
}
