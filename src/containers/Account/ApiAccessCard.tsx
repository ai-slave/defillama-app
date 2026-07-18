import { useState } from 'react'
import toast from 'react-hot-toast'
import { Icon } from '~/ui/Icon'
import { ApiUsageBreakdown } from './ApiUsageBreakdown'
import { ToggleSwitch } from './ToggleSwitch'

const API_CREDITS_LIMIT = 1_000_000

interface ApiAccessCardProps {
	apiKey: string | null
	credits: number | null
	usageStats: any
	isUsageStatsLoading: boolean
	isUsageStatsError: boolean
	onRegenerateKey: () => void
	isRegenerateLoading?: boolean
	canManageOverage?: boolean
	isOverageEnabled?: boolean
	onToggleOverage?: () => void
	isOverageToggleLoading?: boolean
}

export function ApiAccessCard({
	apiKey,
	credits,
	usageStats,
	isUsageStatsLoading,
	isUsageStatsError,
	onRegenerateKey,
	isRegenerateLoading,
	canManageOverage,
	isOverageEnabled,
	onToggleOverage,
	isOverageToggleLoading
}: ApiAccessCardProps) {
	const [copied, setCopied] = useState(false)
	const [showKey, setShowKey] = useState(false)

	const remaining = credits ?? 0
	const usagePercentage = ((remaining / API_CREDITS_LIMIT) * 100).toFixed(1)

	const handleCopy = () => {
		if (apiKey) {
			navigator.clipboard.writeText(apiKey)
			setCopied(true)
			toast.success('API key copied to clipboard')
			setTimeout(() => setCopied(false), 2000)
		}
	}

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
					<button
						onClick={onRegenerateKey}
						disabled={isRegenerateLoading}
						className="flex h-11 items-center gap-2 rounded-lg bg-sub-brand-primary px-6 text-sm font-medium text-on-brand disabled:opacity-50"
					>
						<Icon name="key" height={16} width={16} />
						{isRegenerateLoading ? 'Generating...' : 'Generate API Key'}
					</button>
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
				<div className="flex items-center justify-between">
					<span className="text-sm text-sub-text-primary">Your API Key</span>
					<div className="flex gap-2">
						<button
							onClick={() => setShowKey((v) => !v)}
							disabled={!apiKey}
							className="flex h-6 items-center gap-1 rounded-md border border-sub-border-muted px-2 text-[10px] leading-3 font-medium text-sub-text-primary disabled:opacity-50 dark:border-sub-border-strong"
							aria-label={showKey ? 'Hide API key' : 'Show API key'}
						>
							<Icon name={showKey ? 'eye-off' : 'eye'} height={12} width={12} />
							{showKey ? 'Hide' : 'Show'}
						</button>
						<button
							onClick={handleCopy}
							disabled={!apiKey}
							className="flex h-6 items-center gap-1 rounded-md border border-sub-border-muted px-2 text-[10px] leading-3 font-medium text-sub-text-primary disabled:opacity-50 dark:border-sub-border-strong"
						>
							<Icon name="copy" height={12} width={12} />
							{copied ? 'Copied' : 'Copy'}
						</button>
						<button
							onClick={() => {
								if (
									window.confirm(
										'Regenerating will invalidate your current API key. All existing integrations will stop working. Continue?'
									)
								) {
									onRegenerateKey()
								}
							}}
							disabled={isRegenerateLoading}
							className="flex h-6 items-center gap-1 rounded-md border border-sub-border-muted px-2 text-[10px] leading-3 font-medium text-sub-text-primary disabled:opacity-50 dark:border-sub-border-strong"
						>
							<Icon name="repeat" height={12} width={12} />
							{isRegenerateLoading ? 'Regenerating...' : 'Regenerate'}
						</button>
					</div>
				</div>
				<div className="rounded-lg bg-sub-surface-panel px-3 py-2.5 dark:bg-sub-dark-page">
					<code className="font-mono text-xs leading-5 break-all text-sub-text-muted">
						{!apiKey ? '...' : showKey ? apiKey : '•'.repeat(apiKey.length)}
					</code>
				</div>
			</div>

			{/* API Usage */}
			<div className="flex flex-col gap-4 rounded-lg bg-sub-surface-panel p-3 dark:bg-sub-dark-page">
				<span className="text-sm text-sub-text-primary">API Usage</span>
				<div className="flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<span className="text-xs text-sub-text-muted">Remaining API Calls: {usagePercentage}%</span>
						<span className="text-xs text-sub-text-primary">
							{remaining.toLocaleString()}{' '}
							<span className="text-sub-text-muted">/{API_CREDITS_LIMIT.toLocaleString()}</span>
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
				</div>
			)}

			{/* API Usage Breakdown */}
			<ApiUsageBreakdown usageStats={usageStats} isLoading={isUsageStatsLoading} isError={isUsageStatsError} />
		</div>
	)
}
