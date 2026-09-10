import * as Ariakit from '@ariakit/react'
import { useState, type ReactNode } from 'react'
import type { SlackLink } from '~/containers/LlamaAI/api/slack'
import { useSlackIntegrationLink } from '~/containers/LlamaAI/hooks/useSlackIntegrationLink'
import { Button } from '~/ui/Button'
import { DialogHeading, dialogScrollableBodyStyles, dialogSurfaceStyles } from '~/ui/Dialog'
import { InlineStatus } from '~/ui/Status'

type Props = {
	title: string
	description: string
	glyph?: ReactNode
}

// Slack's own button colour is a third-party brand mark; it takes Button md geometry and the shared
// disabled idiom so it lines up with every other control in the row.
const SLACK_BUTTON =
	'inline-flex min-h-8 shrink-0 items-center justify-center gap-1 rounded-lg bg-ai-slack px-3 py-1.5 label-sm whitespace-nowrap text-on-brand not-disabled:not-aria-disabled:hover:bg-ai-slack-deep disabled:cursor-not-allowed disabled:opacity-60'

function ConnectButton({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
	return (
		<button type="button" onClick={onClick} disabled={disabled} className={SLACK_BUTTON}>
			<SlackLogo />
			{label}
		</button>
	)
}

function SlackLogo() {
	return (
		<svg width="14" height="14" viewBox="0 0 122.8 122.8" aria-hidden="true">
			<path
				d="M25.8 77.6c0 7.1-5.8 12.9-12.9 12.9S0 84.7 0 77.6s5.8-12.9 12.9-12.9h12.9v12.9zm6.5 0c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9v32.3c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V77.6z"
				fill="#E01E5A"
			/>
			<path
				d="M45.2 25.8c-7.1 0-12.9-5.8-12.9-12.9S38.1 0 45.2 0s12.9 5.8 12.9 12.9v12.9H45.2zm0 6.5c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H12.9C5.8 58.1 0 52.3 0 45.2s5.8-12.9 12.9-12.9h32.3z"
				fill="#36C5F0"
			/>
			<path
				d="M97 45.2c0-7.1 5.8-12.9 12.9-12.9s12.9 5.8 12.9 12.9-5.8 12.9-12.9 12.9H97V45.2zm-6.5 0c0 7.1-5.8 12.9-12.9 12.9s-12.9-5.8-12.9-12.9V12.9C64.7 5.8 70.5 0 77.6 0s12.9 5.8 12.9 12.9v32.3z"
				fill="#2EB67D"
			/>
			<path
				d="M77.6 97c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9-12.9-5.8-12.9-12.9V97h12.9zm0-6.5c-7.1 0-12.9-5.8-12.9-12.9s5.8-12.9 12.9-12.9h32.3c7.1 0 12.9 5.8 12.9 12.9s-5.8 12.9-12.9 12.9H77.6z"
				fill="#ECB22E"
			/>
		</svg>
	)
}

function WorkspaceRow({
	workspace,
	onDisconnect,
	onReconnect,
	isDisconnecting
}: {
	workspace: SlackLink
	onDisconnect: () => void
	onReconnect: () => void
	isDisconnecting: boolean
}) {
	const needsReconnect = !workspace.revoked && workspace.needs_reconnect === true
	return (
		<div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-subtle bg-surface p-3">
			<div className="min-w-0 flex-1">
				<p className="m-0 label-md text-primary">{workspace.team_name}</p>
				<p className="m-0 mt-0.5 body-sm text-secondary">
					{workspace.revoked ? (
						<span className="text-warning">Disconnected by Slack. Reconnect to resume alerts.</span>
					) : needsReconnect ? (
						<span className="text-warning">Reconnect to enable LlamaAI chat in this workspace.</span>
					) : workspace.default_channel_name ? (
						<>Default channel: #{workspace.default_channel_name}</>
					) : (
						<>No default channel set</>
					)}
				</p>
				{workspace.last_error && !workspace.revoked && (
					<p className="m-0 mt-0.5 body-sm text-warning">{workspace.last_error}</p>
				)}
			</div>
			<div className="flex shrink-0 gap-2">
				{workspace.revoked || needsReconnect ? (
					<button type="button" onClick={onReconnect} className={SLACK_BUTTON}>
						Reconnect
					</button>
				) : (
					<Button type="button" size="md" onClick={onDisconnect} disabled={isDisconnecting}>
						{isDisconnecting ? 'Disconnecting…' : 'Disconnect'}
					</Button>
				)}
			</div>
		</div>
	)
}

export function SlackIntegrationRow({ title, description, glyph }: Props) {
	const link = useSlackIntegrationLink()
	const [disconnectTarget, setDisconnectTarget] = useState<SlackLink | null>(null)

	const confirmDisconnect = () => {
		if (!disconnectTarget) return
		link.disconnect(disconnectTarget.team_id)
		setDisconnectTarget(null)
	}

	return (
		<div className="rounded-lg border border-subtle bg-surface-elevated-1 p-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="flex min-w-0 flex-1 items-center gap-3">
					{glyph}
					<div className="min-w-0">
						<p className="m-0 label-md text-primary">{title}</p>
						<p className="m-0 mt-0.5 body-sm text-secondary">{description}</p>
					</div>
				</div>
				{(link.state.status === 'idle' || link.state.status === 'starting' || link.state.status === 'loading') && (
					<ConnectButton
						onClick={() => link.connect()}
						disabled={link.state.status === 'starting' || link.state.status === 'loading'}
						label={
							link.state.status === 'starting'
								? 'Opening…'
								: link.state.status === 'loading'
									? 'Loading…'
									: 'Add to Slack'
						}
					/>
				)}
			</div>

			{link.state.status === 'pending' && (
				<div className="mt-3 rounded-lg bg-surface-elevated-2 p-3 body-sm text-secondary">
					<div>
						Waiting for confirmation in Slack. Once you finish in Slack, come back to this page to see your workspace
						here.
					</div>
					<div className="mt-3 flex flex-wrap gap-2">
						<button type="button" onClick={() => link.connect()} disabled={link.isStarting} className={SLACK_BUTTON}>
							{link.isStarting ? 'Opening…' : 'Start over'}
						</button>
						<Button type="button" size="md" onClick={() => link.cancelPending()} disabled={link.isCancelingPending}>
							{link.isCancelingPending ? 'Canceling…' : 'Cancel'}
						</Button>
					</div>
				</div>
			)}

			{link.state.status === 'linked' && (
				<div className="mt-3 flex flex-col gap-2">
					{link.state.workspaces.map((w) => (
						<WorkspaceRow
							key={w.team_id}
							workspace={w}
							onDisconnect={() => setDisconnectTarget(w)}
							onReconnect={() => link.connect()}
							isDisconnecting={link.isDisconnecting}
						/>
					))}
					<div className="flex justify-end">
						<ConnectButton onClick={() => link.connect()} label="Add another workspace" />
					</div>
				</div>
			)}

			{link.state.status === 'error' && (
				<div className="mt-3">
					<InlineStatus variant="error">{link.state.message}</InlineStatus>
				</div>
			)}
			<Ariakit.DialogProvider open={!!disconnectTarget} setOpen={(open) => !open && setDisconnectTarget(null)}>
				<Ariakit.Dialog portal className={`${dialogSurfaceStyles} [--dialog-width:448px] max-sm:h-fit max-sm:min-h-0`}>
					<header className="shrink-0 border-b border-subtle p-3">
						<DialogHeading>Disconnect Slack workspace?</DialogHeading>
					</header>
					<div className={`${dialogScrollableBodyStyles} p-3`}>
						<Ariakit.DialogDescription className="body-sm text-secondary">
							{disconnectTarget?.team_name ?? 'This workspace'} will stop receiving LlamaAI alerts. Existing alerts
							targeting this workspace will be paused.
						</Ariakit.DialogDescription>
					</div>
					<footer className="flex shrink-0 justify-end gap-2 border-t border-subtle p-3">
						<Ariakit.DialogDismiss type="button" render={<Button size="md" />}>
							Cancel
						</Ariakit.DialogDismiss>
						<Button
							type="button"
							size="md"
							variant="destructive"
							onClick={confirmDisconnect}
							disabled={!disconnectTarget || link.isDisconnecting}
						>
							Disconnect
						</Button>
					</footer>
				</Ariakit.Dialog>
			</Ariakit.DialogProvider>
		</div>
	)
}
