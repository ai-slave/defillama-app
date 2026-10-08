import { useMutation, type UseMutationResult } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Button } from '~/ui/Button'
import { ConfirmActionDialog } from '~/ui/ConfirmActionDialog'
import { takeLostFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Switch } from '~/ui/Switch'
import { formatNumber, formatFixedNumber, formatPercent } from '~/utils/numberFormat'
import { ApiUsageBreakdown, type ApiUsageStats } from './ApiUsageBreakdown'

const API_CREDITS_LIMIT = 1_000_000

interface ApiAccessCardProps {
	apiKey: string | null
	credits: number | null
	usageStats: ApiUsageStats | null | undefined
	isUsageStatsLoading: boolean
	isUsageStatsError: boolean
	generateNewKeyMutation: UseMutationResult<string, Error, void>
	/** The extra-usage switch, only for the account's own Stripe API subscription. */
	overage?: { enabled: boolean; onToggle: () => void; isPending: boolean; error: string | null } | null
}

export function ApiAccessCard({
	apiKey,
	credits,
	usageStats,
	isUsageStatsLoading,
	isUsageStatsError,
	generateNewKeyMutation,
	overage
}: ApiAccessCardProps) {
	const [confirmRegenerate, setConfirmRegenerate] = useState(false)
	// The first key's failure. Not the mutation's own error: that one clears as soon as a retry starts. Success
	// replaces the Generate step.
	const [generateError, setGenerateError] = useState<string | null>(null)
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
			<div className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface p-4">
				<div className="flex items-center gap-2">
					<Icon name="cli" height={28} width={28} className="text-primary" />
					<span className="label-lg text-primary">API access</span>
				</div>

				<div className="flex flex-col items-center gap-4 rounded-lg bg-surface-elevated-1 px-4 py-8 text-center">
					<p className="max-w-sm body-md text-tertiary">
						You don't have an API key yet. Generate one to start making requests to the DefiLlama API.
					</p>
					<Button
						variant="primary"
						size="md"
						onClick={() =>
							generateNewKeyMutation.mutate(undefined, { onError: (error) => setGenerateError(error.message) })
						}
						pendingLabel={generateNewKeyMutation.isPending ? 'Generating…' : null}
					>
						<Icon name="key" height={14} width={14} />
						Generate API key
					</Button>
					{generateError ? (
						<p role="alert" className="body-md text-error">
							{generateError}
						</p>
					) : null}
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface p-4">
			{/* Header */}
			<div className="flex items-center gap-2">
				<Icon name="cli" height={28} width={28} className="text-primary" />
				<span className="label-lg text-primary">API access</span>
			</div>

			{/* API Key Section */}
			<div className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<span className="body-md text-primary">Your API key</span>
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
							onClick={() => setConfirmRegenerate(true)}
							pendingLabel={generateNewKeyMutation.isPending ? 'Regenerating…' : null}
						>
							<Icon name="repeat" height={14} width={14} />
							Regenerate
						</Button>
					</div>
				</div>
				<div className="rounded-lg bg-surface-elevated-1 px-3 py-2.5">
					<code className="mono-sm break-all text-tertiary">{showKey ? apiKey : '•'.repeat(apiKey.length)}</code>
				</div>
			</div>

			{copy.error ? (
				<p role="alert" className="body-md text-error">
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
			<div className="flex flex-col gap-4 rounded-lg bg-surface-elevated-1 p-3">
				<span className="body-md text-primary">API usage</span>
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<span className="body-sm text-tertiary">
							Remaining API calls: {formatPercent(usagePercentage, { input: 'percent' })}
						</span>
						<span className="body-sm text-primary">
							{formatNumber(remaining)} <span className="text-tertiary">/{formatNumber(API_CREDITS_LIMIT)}</span>
						</span>
					</div>
					<div className="h-2 overflow-hidden rounded-full bg-surface-elevated-2">
						<div className="h-full rounded-full bg-brand" style={{ width: `${usagePercentage}%` }} />
					</div>
					<div className="flex items-center justify-between">
						<span className="body-sm text-tertiary">Rate limit:</span>
						<span className="body-sm text-primary">
							1,000 Requests<span className="text-tertiary">/minute</span>
						</span>
					</div>
				</div>
			</div>

			{/* Overage */}
			{overage && (
				<div className="flex flex-col gap-2 rounded-lg bg-surface-elevated-1 p-3">
					<div className="flex items-center justify-between gap-4">
						<span className="body-md text-primary">
							Allow extra usage charges{' '}
							<span className="text-tertiary">({overage.enabled ? 'Enabled' : 'Disabled'})</span>
						</span>
						<Switch
							label="Allow extra usage charges"
							hideLabel
							value="overage"
							checked={overage.enabled}
							onChange={overage.onToggle}
							isLoading={overage.isPending}
						/>
					</div>
					<p className="body-sm text-tertiary">
						When enabled, API usage beyond your plan's included limits continues uninterrupted and the additional usage
						is billed to your card. Pricing after included limits: $0.60 per 1,000 calls.
						<br />
						We will notify you via email if you approach your plan limits.
					</p>
					{overage.error ? (
						<p role="alert" className="body-sm text-error">
							{overage.error}
						</p>
					) : null}
				</div>
			)}

			{/* API Usage Breakdown */}
			<ApiUsageBreakdown usageStats={usageStats} isLoading={isUsageStatsLoading} isError={isUsageStatsError} />
		</div>
	)
}
