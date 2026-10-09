import { Select } from '~/components/Select/Select'
import type { SlackChannel, SlackLink } from '~/containers/LlamaAI/api/slack'
import type { SlackTarget } from '~/containers/LlamaAI/components/alerts/createAlertForm'
import { DAYS_OF_WEEK, getTimezoneLabel, GMT_OFFSETS } from '~/containers/LlamaAI/components/alerts/schedule'
import { RetryNotice } from '~/containers/LlamaAI/components/RetryNotice'
import type { useSlackChannels } from '~/containers/LlamaAI/hooks/useSlackChannels'
import { FieldGroup } from '~/ui/Field'
import { takeLostFocus } from '~/ui/focus'
import { queryReadFailed } from '~/utils/query'

/* ----------------------------------------------------------------------------
   The pickers every alert form shares: the schedule (frequency, weekday, hour,
   timezone) and the Slack workspace and channel. The chat's alert card, the
   Create alert dialog and the Alerts dialog's editor all render these, so a
   schedule or a Slack destination reads and picks the same everywhere.

   Each picker is a `Select` input trigger at md, named by its aria-label; the
   group's visible label sits above the row. The forms keep the values in state
   and read that state on submit.
---------------------------------------------------------------------------- */

export type AlertSchedule = {
	frequency: 'daily' | 'weekly'
	dayOfWeek: number
	hour: number
	timezone: string
}

const FREQUENCY_OPTIONS = [
	{ key: 'daily', name: 'Daily' },
	{ key: 'weekly', name: 'Weekly' }
]

const DAY_OPTIONS = DAYS_OF_WEEK.map((day, index) => ({ key: String(index), name: day }))

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
	key: String(hour),
	name: `${hour.toString().padStart(2, '0')}:00`
}))

export function AlertScheduleFields({
	label,
	schedule,
	onChange
}: {
	label: string
	schedule: AlertSchedule
	onChange: (next: AlertSchedule) => void
}) {
	// A saved timezone outside the offset list stays pickable beside it.
	const timezoneOptions = GMT_OFFSETS.some((option) => option.value === schedule.timezone)
		? GMT_OFFSETS
		: [...GMT_OFFSETS, { value: schedule.timezone, label: getTimezoneLabel(schedule.timezone) }]
	const timezoneValues = timezoneOptions.map((option) => ({ key: option.value, name: option.label }))

	return (
		<FieldGroup label={label}>
			<div className="flex flex-wrap items-center gap-2">
				<Select
					heading="Frequency"
					allValues={FREQUENCY_OPTIONS}
					selectedValues={schedule.frequency}
					setSelectedValues={(value: string) =>
						onChange({ ...schedule, frequency: value === 'weekly' ? 'weekly' : 'daily' })
					}
					label={schedule.frequency === 'weekly' ? 'Weekly' : 'Daily'}
					labelType="none"
					variant="input"
					size="md"
					triggerProps={{ 'aria-label': 'Frequency' }}
				/>
				{schedule.frequency === 'weekly' ? (
					<Select
						heading="Day of week"
						allValues={DAY_OPTIONS}
						selectedValues={String(schedule.dayOfWeek)}
						setSelectedValues={(value: string) => onChange({ ...schedule, dayOfWeek: Number(value) })}
						label={DAYS_OF_WEEK[schedule.dayOfWeek]}
						labelType="none"
						variant="input"
						size="md"
						triggerProps={{ 'aria-label': 'Day of week' }}
					/>
				) : null}
				<span className="body-sm text-secondary">at</span>
				<Select
					heading="Hour"
					allValues={HOUR_OPTIONS}
					selectedValues={String(schedule.hour)}
					setSelectedValues={(value: string) => onChange({ ...schedule, hour: Number(value) })}
					label={HOUR_OPTIONS[schedule.hour].name}
					labelType="none"
					variant="input"
					size="md"
					triggerProps={{ 'aria-label': 'Hour' }}
				/>
				<Select
					heading="Timezone"
					allValues={timezoneValues}
					selectedValues={schedule.timezone}
					setSelectedValues={(value: string) => onChange({ ...schedule, timezone: value })}
					label={timezoneOptions.find((option) => option.value === schedule.timezone)!.label}
					labelType="none"
					variant="input"
					size="md"
					triggerProps={{ 'aria-label': 'Timezone' }}
				/>
			</div>
		</FieldGroup>
	)
}

/** The Slack workspace and channel pickers inside a form's delivery group. A workspace pick takes that workspace's
    default channel, so a channel never outlives the workspace it belongs to. `invalid` marks the pick the group's
    error asks for, which the submit then focuses. */
export function SlackTargetPickers({
	workspaces,
	workspacesLoading,
	target,
	channelsQuery,
	invalid,
	onPick
}: {
	workspaces: ReadonlyArray<SlackLink>
	workspacesLoading: boolean
	target: SlackTarget
	channelsQuery: ReturnType<typeof useSlackChannels>
	invalid: boolean
	onPick: (target: SlackTarget) => void
}) {
	const channels = (channelsQuery.data?.channels ?? []).filter((channel) => !channel.is_archived)
	channels.sort((a, b) => Number(a.is_private) - Number(b.is_private) || a.name.localeCompare(b.name))
	const workspace = workspaces.find((w) => w.team_id === target.teamId)
	const channel = channels.find((c) => c.id === target.channelId)

	return (
		<>
			{workspacesLoading ? (
				<span className="body-sm text-tertiary">Loading workspaces…</span>
			) : workspaces.length > 0 ? (
				<Select
					heading="Slack workspace"
					allValues={workspaces.map((w) => ({ key: w.team_id, name: w.team_name }))}
					selectedValues={target.teamId}
					setSelectedValues={(teamId: string) =>
						onPick({
							teamId,
							channelId: workspaces.find((w) => w.team_id === teamId)?.default_channel_id ?? ''
						})
					}
					label={workspace?.team_name ?? 'Pick workspace'}
					labelType="none"
					variant="input"
					size="md"
					triggerProps={{
						'aria-label': 'Slack workspace',
						'aria-invalid': invalid && !target.teamId ? true : undefined
					}}
				/>
			) : null}
			{target.teamId ? (
				// A failed read keeps its notice through the retry, so the retry shows "Retrying…".
				queryReadFailed(channelsQuery) ? (
					<RetryNotice
						message="Couldn't load Slack channels."
						retrying={channelsQuery.isFetching}
						onRetry={() => void channelsQuery.refetch()}
					/>
				) : channelsQuery.isLoading ? (
					<span className="body-sm text-tertiary">Loading channels…</span>
				) : (
					<Select
						heading="Slack channel"
						allValues={channels.map((c) => {
							const disabled = c.is_private && !c.is_member
							return {
								key: c.id,
								name: channelName(c),
								disabled,
								help: disabled ? 'Invite the bot to this private channel first' : undefined
							}
						})}
						selectedValues={target.channelId}
						setSelectedValues={(channelId: string) => onPick({ teamId: target.teamId, channelId })}
						label={channel ? channelName(channel) : 'Pick channel'}
						labelType="none"
						variant="input"
						size="md"
						triggerProps={{
							// A retried channel list takes the focus its Try again drops as it leaves.
							ref: takeLostFocus,
							'aria-label': 'Slack channel',
							'aria-invalid': invalid && !target.channelId ? true : undefined
						}}
					/>
				)
			) : null}
		</>
	)
}

function channelName(channel: SlackChannel) {
	return `${channel.is_private ? '🔒 ' : '# '}${channel.name}`
}
