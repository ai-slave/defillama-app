import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery, type MutationStatus } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { Suspense, lazy, useId, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { BasicLink } from '~/components/Link'
import { fetchChainsByCategory as fetchChainsByCategoryApi } from '~/containers/Chains/api'
import { Icon } from '~/ui/Icon'
import { LoadingSpinner } from '~/ui/Loaders'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import {
	DASHBOARD_DESCRIPTION_MAX_LENGTH,
	DASHBOARD_NAME_MAX_LENGTH,
	type Dashboard,
	type DashboardTeam,
	type DashboardVariable
} from '../dashboardTypes'
import { useDimensionProtocols } from '../hooks/useDimensionProtocols'
import { useProDashboardCatalog } from '../ProDashboardAPIContext'
import { dashboardUrlKey } from '../services/DashboardAPI'
import { DASHBOARD_TEMPLATES, generateTemplateCharts, getTemplateItems, type ChainCategoryData } from '../templates'
import { ProButton, ProDialog, ProMeta, proInputStyles } from '../ui'
import type { ComparisonPreset } from './ComparisonWizard/types'

const ComparisonWizard = lazy(() => import('./ComparisonWizard').then((m) => ({ default: m.ComparisonWizard })))

type PickerMode = 'picker' | 'scratch' | 'comparison'

function visibilityCardStyles(selected: boolean) {
	return `relative flex-1 cursor-pointer rounded-md border px-4 py-3 text-center text-sm transition-colors has-focus-visible:focus-ring ${
		selected
			? 'border-brand bg-pro-info-100/60 text-pro-text-primary'
			: 'border-pro-cards-border text-pro-text-secondary hover:text-pro-text-primary'
	}`
}

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
	// The free-tier limit is refused before the request, so its message is the only thing that tells the
	// user why, and that retrying will not help.
	const creationFeedback = creation.isPending ? (
		<p role="status" className="px-6 py-3 text-sm">
			Creating dashboard…
		</p>
	) : creation.isSuccess ? (
		<p role="status" className="px-6 py-3 text-sm">
			Dashboard created.{' '}
			<BasicLink href={`/pro/${dashboardUrlKey(creation.data)}/edit`} className="underline">
				Open dashboard
			</BasicLink>
		</p>
	) : creation.isError ? (
		<p role="alert" className="px-6 py-3 text-sm text-error">
			{creation.error.message}
			<span className="block text-pro-text-tertiary">Your choices are still here.</span>
		</p>
	) : null
	const effectiveMode: PickerMode = comparisonPreset && !comparisonPresetHandled ? 'comparison' : mode

	const handleClose = () => {
		setMode('picker')
		setComparisonPresetHandled(false)
		dialogStore.toggle()
	}

	const handleBackToPicker = () => {
		setComparisonPresetHandled(true)
		setMode('picker')
	}

	if (effectiveMode === 'scratch') {
		return (
			<ProDialog
				ref={dialogRef}
				store={dialogStore}
				unmountOnHide={false}
				width="sm"
				heading="Create New Dashboard"
				bodyClassName="p-0"
				closeButtonProps={{ disabled: creation.isPending }}
				leading={
					<ProButton
						type="button"
						square
						size="md"
						variant="ghost"
						aria-label="Back to dashboard choices"
						disabled={creation.isPending}
						onClick={handleBackToPicker}
					>
						<Icon name="arrow-left" height={16} width={16} />
					</ProButton>
				}
			>
				<CreateDashboardModalContent onCreate={submitCreation} status={creation.status} team={team ?? null} />
				{creationFeedback}
			</ProDialog>
		)
	}

	if (effectiveMode === 'comparison') {
		return (
			<ProDialog
				ref={dialogRef}
				store={dialogStore}
				unmountOnHide={false}
				width="lg"
				heading="Create Comparison Dashboard"
				bodyClassName="p-0"
				closeButtonProps={{
					ariaLabel: 'Close comparison creation',
					disabled: creation.isPending,
					onClick: handleClose
				}}
				leading={
					<ProButton
						type="button"
						square
						size="md"
						variant="ghost"
						aria-label="Back to dashboard choices"
						disabled={creation.isPending}
						onClick={handleBackToPicker}
					>
						<Icon name="arrow-left" height={16} width={16} />
					</ProButton>
				}
			>
				<fieldset disabled={creation.isPending || creation.isSuccess} className="contents">
					<Suspense
						fallback={
							<div className="flex h-96 items-center justify-center">
								<LoadingSpinner size={32} />
							</div>
						}
					>
						<ComparisonWizard
							creationStatus={creation.status}
							onComplete={submitCreation}
							{...(comparisonPreset !== null ? { comparisonPreset } : {})}
						/>
					</Suspense>
				</fieldset>
				{creationFeedback}
			</ProDialog>
		)
	}

	return (
		<ProDialog
			ref={dialogRef}
			store={dialogStore}
			unmountOnHide={false}
			width="md"
			heading="Create New Dashboard"
			closeButtonProps={{
				disabled: creation.isPending,
				accessibleWhenDisabled: true,
				onClick: handleClose
			}}
		>
			<fieldset className="contents">
				<p className="mb-6 text-sm text-pro-text-secondary">How would you like to create your dashboard?</p>

				<div className="grid gap-4 sm:grid-cols-2">
					<button
						type="button"
						disabled={creation.isPending || creation.isSuccess}
						onClick={() => {
							setComparisonPresetHandled(true)
							setMode('scratch')
						}}
						className="flex flex-col items-center gap-4 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-5 text-center transition-colors hover:border-pro-accent/40"
					>
						<div className="flex size-10 items-center justify-center rounded-md bg-pro-info-100 text-pro-info-400">
							<Icon name="file-plus" height={20} width={20} />
						</div>
						<div>
							<h3 className="text-base font-semibold text-pro-text-primary">From Scratch</h3>
							<p className="mt-1 text-sm text-pro-text-tertiary">Create an empty dashboard and add charts manually</p>
						</div>
					</button>

					<button
						type="button"
						disabled={creation.isPending || creation.isSuccess}
						onClick={() => {
							setComparisonPresetHandled(true)
							setMode('comparison')
						}}
						className="flex flex-col items-center gap-4 rounded-lg border border-pro-cards-border bg-pro-cards-bg p-5 text-center transition-colors hover:border-pro-accent/40"
					>
						<div className="flex size-10 items-center justify-center rounded-md bg-pro-info-100 text-pro-info-400">
							<Icon name="bar-chart-2" height={20} width={20} />
						</div>
						<div>
							<h3 className="text-base font-semibold text-pro-text-primary">Comparison</h3>
							<p className="mt-1 text-sm text-pro-text-tertiary">Compare chains or protocols with pre-built charts</p>
						</div>
					</button>
				</div>

				<div className="mt-6 border-t border-pro-cards-border pt-6">
					<h3 className="mb-3 text-sm font-medium text-pro-text-secondary">Or use a template</h3>
					{open ? (
						<DashboardTemplates
							onCreate={submitCreation}
							pendingName={creation.isPending || creation.isSuccess ? creation.variables.dashboardName : null}
						/>
					) : null}
				</div>
			</fieldset>
			{creationFeedback}
		</ProDialog>
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

	return (
		<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
			{DASHBOARD_TEMPLATES.map((template, index) => {
				const creating = pendingName === template.name
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
				const catalogError = needsCatalog && protocolCatalog.status === 'error'
				const failed = catalogError || (queryMissing && query.isError && !query.isFetching)
				const loading = !failed && ((needsCatalog && protocolCatalog.status === 'loading') || queryMissing)
				const empty = !parameterized && !failed && !loading && selection.length === 0
				const status = creating
					? 'Creating dashboard…'
					: failed
						? 'Could not load template data. Retry'
						: loading
							? 'Loading template data…'
							: empty
								? 'No matching data available'
								: ''
				return (
					<Ariakit.Button
						key={template.id}
						type="button"
						aria-label={failed ? `Retry ${template.name}` : template.name}
						aria-describedby={`${id}-${template.id}`}
						aria-busy={creating}
						disabled={pendingName !== null || loading || empty}
						accessibleWhenDisabled
						onClick={() => {
							if (failed) {
								if (catalogError) protocolCatalog.retry()
								if (queryMissing && query.isError) void query.refetch()
								return
							}
							if (pendingName !== null || loading || empty) return
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
						className={`rounded-lg border p-3 text-left transition-colors hover:border-pro-accent/40 aria-disabled:cursor-not-allowed ${creating ? 'border-pro-accent/40' : 'border-pro-cards-border aria-disabled:opacity-60'}`}
					>
						<span className="flex items-center gap-2 text-sm font-medium text-pro-text-primary">
							{template.name}
							{creating || loading ? <LoadingSpinner size={14} /> : null}
						</span>
						<span id={`${id}-${template.id}`} className="mt-0.5 block">
							<ProMeta items={[template.description]} />
							<span role="status" className={`block text-xs ${failed ? 'text-error' : 'text-pro-text-tertiary'}`}>
								{status}
							</span>
						</span>
					</Ariakit.Button>
				)
			})}
		</div>
	)
}

function CreateDashboardModalContent({
	onCreate,
	status,
	team
}: {
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
	const tagInputRef = useRef<HTMLInputElement>(null)
	const charCountRef = useRef<HTMLSpanElement>(null)

	const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		const form = e.currentTarget
		const formData = new FormData(form)
		const dashboardNameValue = formData.get('dashboardName')
		const descriptionValue = formData.get('description')
		const dashboardName = typeof dashboardNameValue === 'string' ? dashboardNameValue.trim() : ''
		const description = typeof descriptionValue === 'string' ? descriptionValue.slice(0, 200) : ''

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

	const handleAddTag = () => {
		const input = tagInputRef.current
		if (!input) return
		const trimmedTag = input.value.trim().toLowerCase()
		if (trimmedTag) {
			setTags((prev) => (prev.includes(trimmedTag) ? prev : [...prev, trimmedTag]))
		}
		input.value = ''
	}

	const handleRemoveTag = (tag: string) => {
		setTags((prev) => prev.filter((t) => t !== tag))
	}

	const handleTagInputKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter') {
			e.preventDefault()
			handleAddTag()
		}
	}

	return (
		<form className="p-6" onSubmit={handleCreate}>
			<fieldset disabled={status === 'pending' || status === 'success'} className="space-y-6">
				<div>
					<label htmlFor="create-dashboard-name" className="mb-3 block text-sm font-medium text-pro-text-primary">
						Dashboard Name
					</label>
					<input
						id="create-dashboard-name"
						name="dashboardName"
						type="text"
						maxLength={DASHBOARD_NAME_MAX_LENGTH}
						onInput={(e) => e.currentTarget.setCustomValidity('')}
						placeholder="Enter dashboard name"
						className={proInputStyles}
						required
					/>
				</div>

				{team ? (
					<div>
						<p id="create-dashboard-owner" className="mb-3 block text-sm font-medium text-pro-text-primary">
							Create in
						</p>
						<Ariakit.RadioProvider value={createIn} setValue={(value) => setCreateIn(value as 'personal' | 'team')}>
							<Ariakit.RadioGroup className="flex gap-3" aria-labelledby="create-dashboard-owner">
								<label htmlFor={`${id}-personal`} className={visibilityCardStyles(createIn === 'personal')}>
									<Ariakit.Radio id={`${id}-personal`} value="personal" className="sr-only" />
									<Icon name="user" height={16} width={16} className="mr-2 inline" />
									My dashboards
								</label>
								<label
									htmlFor={`${id}-team`}
									className={`${visibilityCardStyles(createIn === 'team')} ${
										!canCreateInTeam ? 'cursor-not-allowed opacity-50' : ''
									}`}
								>
									<Ariakit.Radio id={`${id}-team`} value="team" disabled={!canCreateInTeam} className="sr-only" />
									<Icon name="users" height={16} width={16} className="mr-2 inline" />
									<span className="truncate">{team.name}</span>
									{!hasActiveSubscription ? <span className="ml-1 text-xs opacity-70">(Pro)</span> : null}
								</label>
							</Ariakit.RadioGroup>
						</Ariakit.RadioProvider>
						<p className="mt-2 text-sm text-pro-text-tertiary">
							{createIn === 'team' && canCreateInTeam
								? 'Teammates with a seat can edit it. It stays with the team if you leave.'
								: 'Only you can edit it. You can share it with your team later from Settings.'}
						</p>
					</div>
				) : null}

				<div>
					<p id="create-dashboard-visibility" className="mb-3 block text-sm font-medium text-pro-text-primary">
						Visibility
					</p>
					<Ariakit.RadioProvider value={visibility} setValue={(value) => setVisibility(value as 'public' | 'private')}>
						<Ariakit.RadioGroup className="flex gap-3" aria-labelledby="create-dashboard-visibility">
							<label htmlFor={`${id}-public`} className={visibilityCardStyles(visibility === 'public')}>
								<Ariakit.Radio id={`${id}-public`} value="public" className="sr-only" />
								<Icon name="earth" height={16} width={16} className="mr-2 inline" />
								Public
							</label>
							<label
								htmlFor={`${id}-private`}
								className={`${visibilityCardStyles(visibility === 'private')} ${
									!hasActiveSubscription ? 'cursor-not-allowed opacity-50' : ''
								}`}
							>
								<Ariakit.Radio
									id={`${id}-private`}
									value="private"
									disabled={!hasActiveSubscription}
									className="sr-only"
								/>
								<Icon
									name={hasActiveSubscription ? 'key' : 'file-lock-2'}
									height={16}
									width={16}
									className="mr-2 inline"
								/>
								Private
								{!hasActiveSubscription ? <span className="ml-1 text-xs opacity-70">(Pro)</span> : null}
							</label>
						</Ariakit.RadioGroup>
					</Ariakit.RadioProvider>
					<p className="mt-2 text-sm text-pro-text-tertiary">
						{visibility === 'public'
							? 'Listed in Discover.'
							: 'Only you can see it. Publish later from Share or Settings.'}
					</p>
					{!hasActiveSubscription ? (
						<p className="mt-2 text-xs text-pro-text-tertiary">Upgrade to Pro to create private dashboards</p>
					) : null}
				</div>

				<div>
					<label htmlFor="create-dashboard-tag-input" className="mb-3 block text-sm font-medium text-pro-text-primary">
						Tags
					</label>
					<div className="flex gap-2">
						<input
							id="create-dashboard-tag-input"
							ref={tagInputRef}
							type="text"
							onKeyDown={handleTagInputKeyDown}
							placeholder="Enter tag name"
							className={`${proInputStyles} min-w-0 flex-1`}
						/>
						<ProButton type="button" variant="secondary" onClick={handleAddTag}>
							Add Tag
						</ProButton>
					</div>
					<p className="mt-2 text-xs text-pro-text-tertiary">Press Enter to add tag</p>
					{tags.length > 0 ? (
						<div className="mt-3 flex flex-wrap gap-2">
							{tags.map((tag) => (
								<span
									key={tag}
									className="flex items-center gap-1 rounded-md border border-pro-cards-border px-3 py-1 text-sm text-pro-text-secondary"
								>
									{tag}
									<button
										type="button"
										onClick={() => handleRemoveTag(tag)}
										aria-label={`Remove tag ${tag}`}
										className="text-pro-text-tertiary hover:text-brand"
									>
										<Icon name="x" height={12} width={12} />
									</button>
								</span>
							))}
						</div>
					) : null}
				</div>

				<div>
					<label
						htmlFor="create-dashboard-description"
						className="mb-3 block text-sm font-medium text-pro-text-primary"
					>
						Description
					</label>
					<textarea
						id="create-dashboard-description"
						name="description"
						onInput={(e) => {
							if (charCountRef.current) charCountRef.current.textContent = String(e.currentTarget.value.length)
						}}
						placeholder="Describe your dashboard..."
						maxLength={DASHBOARD_DESCRIPTION_MAX_LENGTH}
						rows={3}
						className={`${proInputStyles} resize-none`}
					/>
					<p className="mt-1 text-xs text-pro-text-tertiary">
						<span ref={charCountRef}>0</span>/{DASHBOARD_DESCRIPTION_MAX_LENGTH} characters
					</p>
				</div>
			</fieldset>

			<div className="mt-8 flex gap-3">
				<Ariakit.DialogDismiss
					type="button"
					disabled={status === 'pending'}
					render={<ProButton variant="secondary" className="flex-1" />}
				>
					Cancel
				</Ariakit.DialogDismiss>
				<ProButton
					type="submit"
					variant="primary"
					className="flex-1"
					data-umami-event="dashboard-create"
					disabled={status === 'pending' || status === 'success'}
				>
					{status === 'pending' ? (
						<LoadingSpinner size={16} />
					) : status === 'success' ? (
						<Icon name="check" height={16} width={16} />
					) : null}
					{status === 'pending' ? 'Creating…' : status === 'success' ? 'Created' : 'Create Dashboard'}
				</ProButton>
			</div>
		</form>
	)
}
