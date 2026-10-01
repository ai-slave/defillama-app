import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery, type MutationStatus } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { Suspense, lazy, useId, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { fetchChainsByCategory as fetchChainsByCategoryApi } from '~/containers/Chains/api'
import { Button } from '~/ui/Button'
import { Dialog, DialogBackButton, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { LoadingSpinner } from '~/ui/Loaders'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import {
	DASHBOARD_NAME_MAX_LENGTH,
	type Dashboard,
	type DashboardTeam,
	type DashboardVariable
} from '../dashboardTypes'
import { useDimensionProtocols } from '../hooks/useDimensionProtocols'
import { useFreeTierStatus } from '../hooks/useFreeTierStatus'
import { useProDashboardCatalog } from '../ProDashboardAPIContext'
import { dashboardUrlKey } from '../services/DashboardAPI'
import { DASHBOARD_TEMPLATES, generateTemplateCharts, getTemplateItems, type ChainCategoryData } from '../templates'
import type { ComparisonPreset } from './ComparisonWizard/types'
import {
	dashboardFieldHintStyles,
	dashboardFieldLabelStyles,
	DescriptionField,
	TagsField,
	VisibilityField
} from './DashboardFormFields'

const ComparisonWizard = lazy(() => import('./ComparisonWizard').then((m) => ({ default: m.ComparisonWizard })))

type PickerMode = 'picker' | 'scratch' | 'comparison'

interface CreateDashboardPickerProps {
	dialogStore: Ariakit.DialogStore
	onCreate: (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: Array<string>
		description: string
		items?: Array<DashboardItemConfig>
		variables?: Array<DashboardVariable>
		teamId?: string
	}) => Promise<Dashboard>
	comparisonPreset?: ComparisonPreset | null
	/** The viewer's team; enables "Create in" on the blank dashboard form. */
	team?: DashboardTeam | null
}

export function CreateDashboardPicker(props: CreateDashboardPickerProps) {
	const open = Ariakit.useStoreState(props.dialogStore, 'open')
	return <CreateDashboardPickerInner key={open ? 'open' : 'closed'} {...props} />
}

function CreateDashboardPickerInner({ dialogStore, onCreate, comparisonPreset, team }: CreateDashboardPickerProps) {
	const router = useRouter()
	const open = Ariakit.useStoreState(dialogStore, 'open')
	const [mode, setMode] = useState<PickerMode>('picker')
	// The keyed picker gives each opening its own feedback lifetime.
	const dialogRef = useRef<HTMLDivElement>(null)
	const creation = useMutation({
		mutationFn: (data: Parameters<CreateDashboardPickerProps['onCreate']>[0]) => onCreate(data),
		onError: (error) => {
			if (!dialogRef.current?.isConnected) toast.error(error.message)
		}
	})
	const submitCreation = (data: Parameters<CreateDashboardPickerProps['onCreate']>[0]) => {
		if (creation.isPending || creation.isSuccess) return
		creation.mutate(data, {
			onSuccess: (dashboard) => {
				// Keep the saved link visible if navigation is cancelled or fails, without allowing a duplicate creation.
				void router
					.push(`/pro/${dashboardUrlKey(dashboard)}/edit`)
					.catch(() => false)
					.then((navigated) => {
						if (navigated && dialogRef.current?.isConnected) dialogStore.hide()
					})
			}
		})
	}
	const [comparisonPresetHandled, setComparisonPresetHandled] = useState(false)
	const formId = useId()
	const pending = creation.isPending
	const locked = creation.isPending
	// The pending state lives on the button that started it; this region only announces it.
	const announcement = (
		<span role="status" className="sr-only">
			{pending ? 'Creating dashboard…' : creation.isSuccess ? 'Dashboard created.' : ''}
		</span>
	)
	// The free-tier limit is refused before the request, so its message is the only thing that tells the
	// user why; a retry cannot succeed, so it offers the upgrade instead of keeping the draft for one.
	const { isAtDashboardLimit } = useFreeTierStatus()
	const creationFeedback = creation.isError ? (
		<InlineStatus variant="error">
			{isAtDashboardLimit ? (
				<div className="flex flex-wrap items-center justify-between gap-2">
					<span>{creation.error.message}</span>
					<Button
						as={BasicLink}
						variant="primary"
						size="sm"
						href="/subscription"
						data-umami-event="dashboard-limit-upgrade"
					>
						Upgrade to Pro
					</Button>
				</div>
			) : (
				<>
					{creation.error.message}
					<span className="block">Your choices are still here.</span>
				</>
			)}
		</InlineStatus>
	) : null
	const effectiveMode: PickerMode = comparisonPreset && !comparisonPresetHandled ? 'comparison' : mode

	const handleBackToPicker = () => {
		setComparisonPresetHandled(true)
		setMode('picker')
	}

	// Creation navigates to the new dashboard; this step shows while that runs, or when it fails,
	// and replaces the form so nothing can create a second dashboard.
	if (creation.isSuccess) {
		return (
			<Dialog ref={dialogRef} store={dialogStore} size="sm" scope="pro" portal unmountOnHide>
				<DialogHeader title="Dashboard created" />
				<DialogBody>
					<Ariakit.DialogDescription className="body-sm text-secondary">
						Your dashboard is saved.
					</Ariakit.DialogDescription>
				</DialogBody>
				<DialogFooter
					dismiss={
						<Ariakit.DialogDismiss type="button" render={<Button size="md" />}>
							Close
						</Ariakit.DialogDismiss>
					}
				>
					<Button
						as={BasicLink}
						href={`/pro/${dashboardUrlKey(creation.data)}/edit`}
						variant="primary"
						size="md"
						autoFocus
					>
						Open dashboard
					</Button>
				</DialogFooter>
				{announcement}
			</Dialog>
		)
	}

	// Every step renders the same Dialog, so switching steps keeps one open surface; closing remounts the
	// keyed picker, which resets the step.
	if (effectiveMode === 'scratch') {
		return (
			<Dialog ref={dialogRef} store={dialogStore} size="sm" scope="pro" pending={pending} portal unmountOnHide>
				<DialogHeader
					title="Create new dashboard"
					leading={<DialogBackButton label="Back to dashboard choices" onClick={handleBackToPicker} />}
				/>
				<DialogBody>
					<CreateDashboardModalContent
						formId={formId}
						onCreate={submitCreation}
						status={creation.status}
						team={team ?? null}
					/>
					{creationFeedback}
				</DialogBody>
				<DialogFooter
					dismiss={
						<Ariakit.DialogDismiss type="button" disabled={pending} render={<Button size="md" />}>
							Cancel
						</Ariakit.DialogDismiss>
					}
				>
					<Button
						type="submit"
						form={formId}
						variant="primary"
						size="md"
						data-umami-event="dashboard-create"
						pendingLabel={pending ? 'Creating…' : null}
					>
						Create dashboard
					</Button>
				</DialogFooter>
				{announcement}
			</Dialog>
		)
	}

	if (effectiveMode === 'comparison') {
		return (
			<Dialog
				ref={dialogRef}
				store={dialogStore}
				size="lg"
				fullSheet
				scope="pro"
				pending={pending}
				portal
				unmountOnHide
			>
				{/* The footer's Back leads out of the wizard from its first step, so the header has no second back. */}
				<DialogHeader title="Create comparison dashboard" />
				<fieldset disabled={locked} className="contents">
					<Suspense
						fallback={
							<DialogBody>
								<div role="status" aria-live="polite" className="flex h-96 items-center justify-center">
									<LoadingIndicator label="Loading comparison builder" />
								</div>
							</DialogBody>
						}
					>
						<ComparisonWizard
							creationStatus={creation.status}
							onComplete={submitCreation}
							onExit={handleBackToPicker}
							feedback={creationFeedback}
							{...(comparisonPreset !== null ? { comparisonPreset } : {})}
						/>
					</Suspense>
				</fieldset>
				{announcement}
			</Dialog>
		)
	}

	return (
		<Dialog ref={dialogRef} store={dialogStore} size="lg" scope="pro" pending={pending} portal unmountOnHide>
			<DialogHeader title="Create new dashboard" />
			<DialogBody>
				<fieldset className="contents">
					<Ariakit.DialogDescription className="body-sm text-secondary">
						How would you like to create your dashboard?
					</Ariakit.DialogDescription>

					<div className="grid gap-4 sm:grid-cols-2">
						<button
							type="button"
							disabled={locked}
							onClick={() => {
								setComparisonPresetHandled(true)
								setMode('scratch')
							}}
							className="flex flex-col items-center gap-4 rounded-lg border border-subtle bg-surface p-5 text-center transition-colors hover:border-pro-accent/40"
						>
							<div className="flex size-10 items-center justify-center rounded-md bg-brand-muted text-link-on-tint">
								<Icon name="file-plus" height={20} width={20} />
							</div>
							<div>
								<span className="block label-md text-primary">From scratch</span>
								<span className="mt-1 block body-sm text-tertiary">
									Create an empty dashboard and add charts manually
								</span>
							</div>
						</button>

						<button
							type="button"
							disabled={locked}
							onClick={() => {
								setComparisonPresetHandled(true)
								setMode('comparison')
							}}
							className="flex flex-col items-center gap-4 rounded-lg border border-subtle bg-surface p-5 text-center transition-colors hover:border-pro-accent/40"
						>
							<div className="flex size-10 items-center justify-center rounded-md bg-brand-muted text-link-on-tint">
								<Icon name="bar-chart-2" height={20} width={20} />
							</div>
							<div>
								<span className="block label-md text-primary">Comparison</span>
								<span className="mt-1 block body-sm text-tertiary">
									Compare chains or protocols with pre-built charts
								</span>
							</div>
						</button>
					</div>

					<div className="border-t border-subtle pt-4">
						<h3 className="mb-3 label-sm text-secondary">Or use a template</h3>
						{open ? (
							<DashboardTemplates
								onCreate={submitCreation}
								pendingName={locked ? creation.variables.dashboardName : null}
							/>
						) : null}
					</div>
				</fieldset>
				{creationFeedback}
			</DialogBody>
			{announcement}
		</Dialog>
	)
}

function DashboardTemplates({
	onCreate,
	pendingName
}: {
	pendingName: string | null
	onCreate: (data: Parameters<CreateDashboardPickerProps['onCreate']>[0]) => void
}) {
	const id = useId()
	const listRef = useRef<HTMLDivElement>(null)
	const { hasActiveSubscription } = useAuthContext()
	const { protocols, chains, protocolCatalog } = useProDashboardCatalog()
	const categories = useQuery({
		queryKey: ['pro-dashboard', 'chain-category-for-templates', 'Rollup'],
		queryFn: () => fetchChainsByCategoryApi('Rollup'),
		staleTime: 60 * 60 * 1000,
		retry: 1
	})
	const dimensions = useDimensionProtocols()
	const categoryData = categories.data
	const perps = dimensions.perps.data
	const dexs = dimensions.dexs.data
	const dexAggregators = dimensions.dexAggregators.data
	const selections = useMemo(() => {
		const chainCategoryData: ChainCategoryData = {
			chainsInCategory: new Map(categoryData ? [['Rollup', new Set(categoryData.chainsUnique)]] : [])
		}
		return DASHBOARD_TEMPLATES.map((template) =>
			getTemplateItems(template, protocols, chains, chainCategoryData, {
				perps: perps?.protocols,
				dexs: dexs?.protocols,
				dexAggregators: dexAggregators?.protocols
			})
		)
	}, [protocols, chains, categoryData, perps, dexs, dexAggregators])
	const sourceQueries = [categories, dimensions.perps, dimensions.dexs, dimensions.dexAggregators]

	const cards = DASHBOARD_TEMPLATES.map((template, index) => {
		const parameterized = template.parameterized === true
		const selection = selections[index] ?? []
		const dimension = parameterized ? undefined : template.filter.metadataFlag
		const query = parameterized
			? undefined
			: dimension
				? dimensions[dimension]
				: template.type === 'chains'
					? categories
					: undefined
		const needsCatalog = !parameterized && !dimension
		const queryMissing = query && query.data === undefined
		const failed =
			(needsCatalog && protocolCatalog.status === 'error') || (queryMissing && query.isError && !query.isFetching)
		const loading = !failed && ((needsCatalog && protocolCatalog.status === 'loading') || queryMissing)
		const empty = !parameterized && !failed && !loading && selection.length === 0
		return { template, selection, failed: !!failed, loading: !!loading, empty }
	})
	const anyFailed = cards.some((card) => card.failed)

	// One failure notice covers every template it blocks; the cards stay listed but cannot start.
	const retry = () => {
		if (protocolCatalog.status === 'error') protocolCatalog.retry()
		for (const query of sourceQueries) {
			if (query.data === undefined && query.isError) void query.refetch()
		}
		// The notice leaves while the data reloads, so focus moves to the templates that replace it.
		listRef.current?.focus()
	}

	return (
		<div className="flex flex-col gap-3">
			{anyFailed ? (
				<InlineStatus variant="error">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span>Could not load template data.</span>
						<Button type="button" size="sm" onClick={retry}>
							Try again
						</Button>
					</div>
				</InlineStatus>
			) : null}
			<div
				ref={listRef}
				role="group"
				aria-label="Templates"
				tabIndex={-1}
				className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
			>
				{cards.map(({ template, selection, failed, loading, empty }) => {
					const creating = pendingName === template.name
					const unavailable = pendingName !== null || failed || loading || empty
					const status = creating
						? 'Creating dashboard…'
						: loading
							? 'Loading template data…'
							: empty
								? 'No matching data available.'
								: ''
					return (
						<Ariakit.Button
							key={template.id}
							type="button"
							aria-label={template.name}
							aria-describedby={`${id}-${template.id}`}
							aria-busy={creating}
							disabled={unavailable}
							accessibleWhenDisabled
							onClick={() => {
								if (unavailable) return
								const generated = generateTemplateCharts(template, selection)
								onCreate({
									dashboardName: template.name,
									visibility: hasActiveSubscription ? 'private' : 'public',
									tags: [],
									description: template.description,
									items: generated.items,
									variables: generated.variables
								})
							}}
							className={`rounded-lg border p-3 text-left transition-colors hover:border-pro-accent/40 aria-disabled:cursor-not-allowed ${creating ? 'border-pro-accent/40' : 'border-subtle aria-disabled:opacity-60'}`}
						>
							<span className="flex items-center gap-2 label-md text-primary">
								{template.name}
								{creating || loading ? <LoadingSpinner size={14} /> : null}
							</span>
							<span id={`${id}-${template.id}`} className="mt-0.5 block body-sm text-tertiary">
								<span className="block">{template.description}</span>
								<span role="status" className="block">
									{status}
								</span>
							</span>
						</Ariakit.Button>
					)
				})}
			</div>
		</div>
	)
}

// The form owns its fields; its submit button sits in the dialog footer and joins it through `form={formId}`.
function CreateDashboardModalContent({
	formId,
	onCreate,
	status,
	team
}: {
	formId: string
	status: MutationStatus
	onCreate: (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: Array<string>
		description: string
		teamId?: string
	}) => void
	team: DashboardTeam | null
}) {
	const id = useId()
	const { hasActiveSubscription } = useAuthContext()
	const [visibility, setVisibility] = useState<'private' | 'public'>(hasActiveSubscription ? 'private' : 'public')
	const canCreateInTeam = !!team && hasActiveSubscription
	const [createIn, setCreateIn] = useState<'personal' | 'team'>('personal')
	const [tags, setTags] = useState<Array<string>>([])
	const [description, setDescription] = useState('')

	const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		const form = e.currentTarget
		const dashboardNameValue = new FormData(form).get('dashboardName')
		const dashboardName = typeof dashboardNameValue === 'string' ? dashboardNameValue.trim() : ''

		const nameElement = form.elements.namedItem('dashboardName')
		const nameInput = nameElement instanceof HTMLInputElement ? nameElement : null
		if (!dashboardName) {
			nameInput?.setCustomValidity('Dashboard name is required')
			nameInput?.reportValidity()
			return
		}

		onCreate({
			dashboardName,
			visibility,
			tags,
			description,
			...(canCreateInTeam && createIn === 'team' && team ? { teamId: team.id } : {})
		})
	}

	return (
		<form id={formId} onSubmit={handleCreate}>
			<fieldset disabled={status === 'pending' || status === 'success'} className="flex flex-col gap-4">
				<div className="flex flex-col gap-1.5">
					<label htmlFor={`${id}-name`} className={dashboardFieldLabelStyles}>
						Dashboard name
					</label>
					{/* Ariakit's autoFocus, so the step starts on the name instead of the header controls. */}
					<Ariakit.Focusable
						autoFocus
						render={
							<Input
								id={`${id}-name`}
								name="dashboardName"
								type="text"
								maxLength={DASHBOARD_NAME_MAX_LENGTH}
								onInput={(e) => e.currentTarget.setCustomValidity('')}
								placeholder="Enter dashboard name"
								required
							/>
						}
					/>
				</div>

				{team ? (
					<div className="flex flex-col gap-1.5">
						<p id={`${id}-owner`} className={dashboardFieldLabelStyles}>
							Create in
						</p>
						<SegmentedControl
							aria-labelledby={`${id}-owner`}
							label="Create in"
							variant="field"
							size="md"
							value={createIn}
							onValueChange={(value) => setCreateIn(value)}
							options={[
								{
									value: 'personal',
									label: (
										<>
											<Icon name="user" height={14} width={14} />
											My dashboards
										</>
									)
								},
								{
									value: 'team',
									disabled: !canCreateInTeam,
									label: (
										<>
											<Icon name="users" height={14} width={14} />
											<span className="truncate">{team.name}</span>
											{hasActiveSubscription ? null : '(Pro)'}
										</>
									)
								}
							]}
						/>
						<p className={dashboardFieldHintStyles}>
							{createIn === 'team' && canCreateInTeam
								? 'Teammates with a seat can edit it. It stays with the team if you leave.'
								: canCreateInTeam
									? 'Only you can edit it. You can share it with your team later from Settings.'
									: 'Only you can edit it. Team dashboards need a seat or Pro.'}
						</p>
					</div>
				) : null}

				<VisibilityField
					value={visibility}
					onChange={setVisibility}
					sharedWithTeam={canCreateInTeam && createIn === 'team'}
				/>
				<TagsField tags={tags} onChange={setTags} />
				<DescriptionField value={description} onChange={setDescription} />
			</fieldset>
		</form>
	)
}
