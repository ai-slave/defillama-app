import { useMutation, useQueryClient } from '@tanstack/react-query'
import Router from 'next/router'
import { memo, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { activateDashboardArtifacts, prepareDashboardArtifactSave } from '~/containers/LlamaAI/dashboardArtifactFlow'
import type { DashboardArtifact } from '~/containers/LlamaAI/types'
import { AppMetadataProvider } from '~/containers/ProDashboard/AppMetadataContext'
import { ChartGrid } from '~/containers/ProDashboard/components/ChartGrid'
import { ProDashboardAPIProvider } from '~/containers/ProDashboard/ProDashboardAPIContext'
import { dashboardAPI, dashboardUrlKey } from '~/containers/ProDashboard/services/DashboardAPI'
import { Button } from '~/ui/Button'
import { ConfirmDialog } from '~/ui/ConfirmDialog'
import { Icon } from '~/ui/Icon'
import { formatUsd } from '~/utils/numberFormat'

interface DashboardPanelProps {
	config: DashboardArtifact | null
	isOpen: boolean
	versions: Array<DashboardArtifact>
	versionIndex: number
	onVersionChange: (index: number) => void
	onClose: () => void
	onExited: () => void
	sessionId?: string | null
}

const NOOP = () => {}
const CREATE_FAILED = "Couldn't create the dashboard. Try again."
const USD_3DP = { minimumFractionDigits: 3, maximumFractionDigits: 3 }

function DashboardPanelInner({
	config,
	isOpen,
	versions,
	versionIndex,
	onVersionChange,
	onClose,
	onExited,
	sessionId
}: DashboardPanelProps) {
	const { authorizedFetch, isAuthenticated, user } = useAuthContext()
	const queryClient = useQueryClient()
	// Premium data bills every refresh, so saving it waits for the reader to accept the cost.
	const [confirmingCost, setConfirmingCost] = useState(false)
	const costConfirmRef = useRef<HTMLDivElement>(null)

	const enrichedItems = useMemo(() => {
		if (!config) return []
		const chartData = config.chartData
		if (!chartData) return config.items
		return config.items.map((item) => {
			if (item.kind === 'llamaai-chart' && item.chartRef && chartData[item.chartRef]) {
				const bundled = chartData[item.chartRef]
				return { ...item, inlineChartConfig: bundled.config, inlineChartData: { [item.chartRef]: bundled.data } }
			}
			return item
		})
	}, [config])

	const artifactSave = useMemo(
		() => (config ? prepareDashboardArtifactSave(config.items, config.artifactOutcomes) : null),
		[config]
	)

	const creation = useMutation({
		mutationFn: async () => {
			if (!config || !artifactSave) {
				throw new Error('No dashboard configuration')
			}

			const dashboard = await dashboardAPI.createDashboard(
				{
					items: artifactSave.items,
					dashboardName: config.dashboardName,
					timePeriod: (config.timePeriod as any) || '365d',
					visibility: 'private',
					tags: [],
					description: '',
					...(config.sourceDashboardId && { copySourceDashboardId: config.sourceDashboardId }),
					aiGenerated: sessionId
						? {
								[sessionId]: {
									mode: 'create' as const,
									timestamp: new Date().toISOString(),
									prompt: '',
									userId: user?.id || '',
									rated: false
								}
							}
						: null
				},
				authorizedFetch
			)
			let activationPending = false
			if (artifactSave.expectedItemIds.length > 0) {
				// A conditional cannot be lowered inside a try, and the cap does not depend on the request.
				const costCap = artifactSave.containsPremium ? artifactSave.estimatedMaxCostUsd : undefined
				try {
					await activateDashboardArtifacts(authorizedFetch, dashboard.id, artifactSave, costCap)
				} catch {
					activationPending = true
				}
			}
			return { dashboard, activationPending }
		},
		onSuccess: ({ dashboard, activationPending }) => {
			setConfirmingCost(false)
			// After the confirmation closes: nothing toasts over an open dialog.
			if (activationPending)
				toast.error('Dashboard saved, but refresh setup is pending. Your current chart snapshots are safe.')
			queryClient.setQueryData(
				['pro-dashboard', 'dashboard', dashboardUrlKey(dashboard), isAuthenticated, user?.id],
				dashboard
			)
			void Router.push(`/pro/${dashboardUrlKey(dashboard)}`)
		},
		// Hook-level so it survives the panel unmounting mid-request. The cost confirmation shows its own error while it is
		// on screen; a route change can remove it mid-save, so the check is the element, not the state that opened it.
		onError: (error) => {
			console.error('Failed to create dashboard:', error)
			if (!costConfirmRef.current?.isConnected) toast.error(CREATE_FAILED)
		}
	})
	const { isPending } = creation

	const handleCreateDashboard = () => {
		if (artifactSave?.containsPremium) {
			// A reopened confirmation starts without the last attempt's error.
			creation.reset()
			setConfirmingCost(true)
			return
		}
		creation.mutate()
	}

	const hasMultipleVersions = versions.length > 1

	return (
		<div
			className="shrink-0 overflow-hidden pl-2.5 duration-200 ease-out motion-safe:transition-[width] max-lg:hidden"
			style={{ width: isOpen ? 'min(50vw, 800px)' : '0px' }}
			onTransitionEnd={(event) => {
				if (!isOpen && event.target === event.currentTarget && event.propertyName === 'width') {
					onExited()
				}
			}}
		>
			{config ? (
				<div
					className="flex h-full flex-col rounded-lg border border-subtle bg-surface"
					style={{ width: 'min(50vw, 800px)', minWidth: '400px' }}
				>
					<div className="flex items-center justify-between border-b border-subtle px-4 py-3">
						<div className="flex items-center gap-2 overflow-hidden">
							<Icon name="layout-grid" className="size-4 shrink-0 text-link" />
							<span className="truncate label-md text-primary">{config.dashboardName}</span>
							<span className="shrink-0 body-sm text-tertiary">
								{config.items.length} {config.items.length === 1 ? 'item' : 'items'}
							</span>
						</div>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								size="md"
								variant="primary"
								onClick={handleCreateDashboard}
								pendingLabel={isPending ? 'Creating…' : null}
							>
								Create dashboard
							</Button>
							<Button
								type="button"
								size="md"
								variant="ghost"
								square
								onClick={onClose}
								aria-label="Close dashboard panel"
							>
								<Icon name="x" className="size-4" />
							</Button>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto overscroll-contain p-2.5 *:gap-2.5">
						<AppMetadataProvider>
							{/* The provider seeds its items once. Versions only append, so a version's place in the history
							    names it; versions of one artifact share its id. */}
							<ProDashboardAPIProvider key={`${config.id}:${versions.indexOf(config)}`} initialItems={enrichedItems}>
								<ChartGrid onAddChartClick={NOOP} />
							</ProDashboardAPIProvider>
						</AppMetadataProvider>
					</div>

					{hasMultipleVersions ? (
						<div className="flex items-center justify-center gap-3 border-t border-subtle px-4 py-2.5">
							<button
								type="button"
								onClick={() => onVersionChange(versionIndex - 1)}
								disabled={versionIndex === 0}
								aria-label="Previous version"
								className="flex size-6 items-center justify-center rounded-sm text-tertiary not-disabled:not-aria-disabled:hover:bg-hover-row disabled:opacity-30"
							>
								<Icon name="chevron-left" className="size-3.5" />
							</button>
							<span className="text-xs text-tertiary">
								Version {versionIndex + 1} of {versions.length}
							</span>
							<button
								type="button"
								onClick={() => onVersionChange(versionIndex + 1)}
								disabled={versionIndex === versions.length - 1}
								aria-label="Next version"
								className="flex size-6 items-center justify-center rounded-sm text-tertiary not-disabled:not-aria-disabled:hover:bg-hover-row disabled:opacity-30"
							>
								<Icon name="chevron-right" className="size-3.5" />
							</button>
						</div>
					) : null}
				</div>
			) : null}
			{artifactSave?.containsPremium ? (
				<ConfirmDialog
					ref={costConfirmRef}
					open={confirmingCost}
					onClose={() => setConfirmingCost(false)}
					tone="primary"
					title="Create a dashboard with premium data?"
					description={`Daily refreshes will bill your account up to ${formatUsd(artifactSave.estimatedMaxCostUsd, USD_3DP)} per refresh window.`}
					confirmLabel="Create dashboard"
					pendingLabel={isPending ? 'Creating…' : null}
					error={creation.error ? CREATE_FAILED : null}
					onConfirm={() => creation.mutate()}
					portal
					unmountOnHide
				/>
			) : null}
		</div>
	)
}

export const DashboardPanel = memo(DashboardPanelInner)
