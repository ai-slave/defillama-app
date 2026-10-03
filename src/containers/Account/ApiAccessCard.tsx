import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button } from '~/ui/Button'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { formatNumber, formatFixedNumber, formatPercent } from '~/utils/numberFormat'
import { ApiUsageBreakdown, type ApiUsageStats } from './ApiUsageBreakdown'
import { ToggleSwitch } from './ToggleSwitch'

const API_CREDITS_LIMIT = 1_000_000

interface ApiAccessCardProps {
	apiKey: string | null
	credits: number | null
	usageStats: ApiUsageStats | null | undefined
	isUsageStatsLoading: boolean
	isUsageStatsError: boolean
	generateNewKeyMutation: UseMutationResult<string, Error, void>
	canManageOverage?: boolean
	isOverageEnabled?: boolean
	onToggleOverage?: () => void
	isOverageToggleLoading?: boolean
	overageError?: string | null
}

export function ApiAccessCard({
	apiKey,
	credits,
	usageStats,
	isUsageStatsLoading,
	isUsageStatsError,
	generateNewKeyMutation,
	canManageOverage,
	isOverageEnabled,
	onToggleOverage,
	isOverageToggleLoading,
	overageError
}: ApiAccessCardProps) {
	const [confirmRegenerate, setConfirmRegenerate] = useState(false)
	const copy = useMutation({
		mutationFn: async () => {
			await navigator.clipboard.writeText(apiKey!)
			return apiKey
		}
	})
	// Fast consecutive copies can batch away the pending render; each attempt needs a fresh timer.
	const successfulCopyAttempt = copy.isSuccess ? copy.submittedAt : null
	useEffect(() => {
		if (successfulCopyAttempt === null) return
		const timer = setTimeout(copy.reset, 2000)
		return () => clearTimeout(timer)
	}, [successfulCopyAttempt, copy.reset])
	const [showKey, setShowKey] = useState(false)

	const remaining = credits ?? 0
	const usagePercentage = formatFixedNumber((remaining / API_CREDITS_LIMIT) * 100, 1)

	if (!apiKey) {
		return (
			<div className="flex flex-col gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
				<div className="flex items-center gap-2">
					<Icon name="cli" height={28} width={28} className="text-sub-text-primary" />
					<span className="text-base leading-5 font-medium text-sub-text-primary">API Access</span>
				</div>

				<div className="flex flex-col items-center gap-4 rounded-lg bg-sub-surface-panel px-4 py-8 text-center dark:bg-sub-dark-page">
					<p className="max-w-sm text-sm text-sub-text-muted">
						You don't have an API key yet. Generate one to start making requests to the DefiLlama API.
					</p>
					<Button
						variant="primary"
						size="md"
						onClick={() => generateNewKeyMutation.mutate()}
						pendingLabel={generateNewKeyMutation.isPending ? 'Generating…' : null}
					>
						<Icon name="key" height={14} width={14} />
						Generate API Key
					</Button>
					{generateNewKeyMutation.error ? (
						<p role="alert" className="text-sm text-error">
							{generateNewKeyMutation.error.message}
						</p>
					) : null}
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-sub-border-slate-100 bg-white p-4 dark:border-sub-border-strong dark:bg-sub-surface-dark">
			{/* Header */}
			<div className="flex items-center gap-2">
				<Icon name="cli" height={28} width={28} className="text-sub-text-primary" />
				<span className="text-base leading-5 font-medium text-sub-text-primary">API Access</span>
			</div>

			{/* API Key Section */}
			<div className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<span className="text-sm text-sub-text-primary">Your API Key</span>
					<div className="flex flex-wrap gap-2">
						<Button
							// A key generated here replaces the Generate button, so its first control takes that focus.
							ref={generateNewKeyMutation.isSuccess ? takeLostFocus : undefined}
							size="sm"
							onClick={() => setShowKey((v) => !v)}
							aria-label={showKey ? 'Hide API key' : 'Show API key'}
						>
							<Icon name={showKey ? 'eye-off' : 'eye'} height={14} width={14} />
							{showKey ? 'Hide' : 'Show'}
						</Button>
						<Button size="sm" onClick={() => copy.mutate()} pendingLabel={copy.isPending ? 'Copying…' : null}>
							<Icon name="copy" height={14} width={14} />
							{copy.isSuccess && copy.data === apiKey ? 'Copied' : 'Copy'}
						</Button>
						<Button
							size="sm"
							onClick={() => {
								generateNewKeyMutation.reset()
								setConfirmRegenerate(true)
							}}
							pendingLabel={generateNewKeyMutation.isPending ? 'Regenerating…' : null}
						>
							<Icon name="repeat" height={14} width={14} />
							Regenerate
						</Button>
					</div>
				</div>
				<div className="rounded-lg bg-sub-surface-panel px-3 py-2.5 dark:bg-sub-dark-page">
					<code className="font-mono text-xs leading-5 break-all text-sub-text-muted">
						{showKey ? apiKey : '•'.repeat(apiKey.length)}
					</code>
				</div>
			</div>

			{copy.error ? (
				<p role="alert" className="text-sm text-error">
					Could not copy the API key. Try again.
				</p>
			) : null}
			{confirmRegenerate ? (
				<ConfirmActionDialog
					title="Regenerate API key?"
					description="Your current API key will stop working. Update every integration to use the new key after regeneration."
					confirmLabel="Regenerate"
					pendingLabel="Regenerating…"
					mutation={generateNewKeyMutation}
					variables={undefined}
					onClose={() => setConfirmRegenerate(false)}
				/>
			) : null}
			{/* API Usage */}
			<div className="flex flex-col gap-4 rounded-lg bg-sub-surface-panel p-3 dark:bg-sub-dark-page">
				<span className="text-sm text-sub-text-primary">API Usage</span>
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<span className="text-xs text-sub-text-muted">
							Remaining API Calls: {formatPercent(usagePercentage, { input: 'percent' })}
						</span>
						<span className="text-xs text-sub-text-primary">
							{formatNumber(remaining)} <span className="text-sub-text-muted">/{formatNumber(API_CREDITS_LIMIT)}</span>
						</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-sub-border-light dark:bg-white/[0.08]">
						<div className="h-full rounded-full bg-sub-brand-primary" style={{ width: `${usagePercentage}%` }} />
					</div>
					<div className="flex items-center justify-between">
						<span className="text-xs text-sub-text-muted">Rate Limit:</span>
						<span className="text-xs text-sub-text-primary">
							1,000 Requests<span className="text-sub-text-muted">/minute</span>
						</span>
					</div>
				</div>
			</div>

			{/* Overage */}
			{canManageOverage && (
				<div className="flex flex-col gap-2 rounded-lg bg-sub-surface-panel p-3 dark:bg-sub-dark-page">
					<div className="flex items-center justify-between gap-4">
						<span className="text-sm text-sub-text-primary">
							Allow extra usage charges{' '}
							<span className="text-sub-text-muted">({isOverageEnabled ? 'Enabled' : 'Disabled'})</span>
						</span>
						<ToggleSwitch
							checked={Boolean(isOverageEnabled)}
							onClick={onToggleOverage}
							disabled={isOverageToggleLoading}
							aria-label="Allow extra usage charges"
						/>
					</div>
					<p className="text-xs leading-4 text-sub-text-muted">
						When enabled, API usage beyond your plan's included limits continues uninterrupted and the additional usage
						is billed to your card. Pricing after included limits: $0.60 per 1,000 calls.
						<br />
						We will notify you via email if you approach your plan limits.
					</p>
					{overageError ? (
						<p role="alert" className="text-xs leading-4 text-error">
							{overageError}
						</p>
					) : null}
				</div>
			)}

			{/* API Usage Breakdown */}
			<ApiUsageBreakdown usageStats={usageStats} isLoading={isUsageStatsLoading} isError={isUsageStatsError} />
		</div>
	)
}
