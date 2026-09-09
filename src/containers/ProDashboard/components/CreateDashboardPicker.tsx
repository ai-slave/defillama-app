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
import type { Dashboard } from '../dashboardTypes'
import { useDimensionProtocols } from '../hooks/useDimensionProtocols'
import { useProDashboardCatalog } from '../ProDashboardAPIContext'
import { dashboardUrlKey } from '../services/DashboardAPI'
import { DASHBOARD_TEMPLATES, generateTemplateCharts, getTemplateItems, type ChainCategoryData } from '../templates'
import type { ComparisonPreset } from './ComparisonWizard/types'

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
	}) => Promise<Dashboard>
	comparisonPreset?: ComparisonPreset | null
}

export function CreateDashboardPicker(props: CreateDashboardPickerProps) {
	const open = Ariakit.useStoreState(props.dialogStore, 'open')
	return <CreateDashboardPickerInner key={open ? 'open' : 'closed'} {...props} />
}

function CreateDashboardPickerInner({ dialogStore, onCreate, comparisonPreset }: CreateDashboardPickerProps) {
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
					.push(`/pro/${dashboardUrlKey(dashboard)}`)
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
			<BasicLink href={`/pro/${dashboardUrlKey(creation.data)}`} className="underline">
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
			<Ariakit.Dialog
				ref={dialogRef}
				store={dialogStore}
				className="dialog w-full max-w-lg gap-0 border pro-dashboard border-pro-cards-border bg-pro-cards-bg p-0 shadow-2xl"
			>
				<div className="flex items-center gap-2 border-b border-pro-cards-border px-6 py-4">
					<button
						type="button"
						aria-label="Back to dashboard choices"
						disabled={creation.isPending}
						onClick={handleBackToPicker}
						className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary disabled:opacity-50"
					>
						<Icon name="arrow-left" height={18} width={18} />
					</button>
					<Ariakit.DialogHeading className="text-lg font-semibold text-pro-text-primary">
						Create New Dashboard
					</Ariakit.DialogHeading>
				</div>
				<CreateDashboardModalContent onCreate={submitCreation} status={creation.status} />
				{creationFeedback}
			</Ariakit.Dialog>
		)
	}

	if (effectiveMode === 'comparison') {
		return (
			<Ariakit.Dialog
				ref={dialogRef}
				store={dialogStore}
				className="dialog w-full max-w-4xl gap-0 border pro-dashboard border-pro-cards-border bg-pro-cards-bg p-0 shadow-2xl"
			>
				<div className="flex items-center justify-between border-b border-pro-cards-border px-6 py-4">
					<div className="flex items-center gap-2">
						<button
							type="button"
							aria-label="Back to dashboard choices"
							disabled={creation.isPending}
							onClick={handleBackToPicker}
							className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary disabled:opacity-50"
						>
							<Icon name="arrow-left" height={18} width={18} />
						</button>
						<Ariakit.DialogHeading className="text-lg font-semibold text-pro-text-primary">
							Create Comparison Dashboard
						</Ariakit.DialogHeading>
					</div>
					<Ariakit.DialogDismiss
						aria-label="Close comparison creation"
						disabled={creation.isPending}
						onClick={handleClose}
						className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary disabled:opacity-50"
					>
						<Icon name="x" height={20} width={20} />
					</Ariakit.DialogDismiss>
				</div>
				<fieldset disabled={creation.isPending || creation.isSuccess} className="contents">
					<Suspense
						fallback={
							<div className="flex h-96 items-center justify-center">
								<div className="size-8 animate-spin rounded-full border-b-2 border-brand" />
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
			</Ariakit.Dialog>
		)
	}

	return (
		<Ariakit.Dialog
			ref={dialogRef}
			store={dialogStore}
			className="dialog w-full max-w-3xl gap-0 border pro-dashboard border-pro-cards-border bg-pro-cards-bg p-6 shadow-2xl"
		>
			<fieldset className="contents">
				<div className="mb-6 flex items-center justify-between">
					<Ariakit.DialogHeading className="text-xl font-semibold text-pro-text-primary">
						Create New Dashboard
					</Ariakit.DialogHeading>
					<Ariakit.DialogDismiss
						disabled={creation.isPending}
						accessibleWhenDisabled
						onClick={handleClose}
						className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary aria-disabled:opacity-50"
					>
						<Icon name="x" height={20} width={20} />
						<span className="sr-only">Close dialog</span>
					</Ariakit.DialogDismiss>
				</div>

				<p className="mb-6 text-sm text-pro-text-secondary">How would you like to create your dashboard?</p>

				<div className="grid gap-4 sm:grid-cols-2">
					<button
						type="button"
						disabled={creation.isPending || creation.isSuccess}
						onClick={() => {
							setComparisonPresetHandled(true)
							setMode('scratch')
						}}
						className="flex flex-col items-center gap-4 rounded-xl border-2 border-pro-cards-border bg-pro-cards-bg p-6 text-center transition-all hover:border-brand/40"
					>
						<div className="flex size-14 items-center justify-center rounded-2xl text-pro-text-secondary">
							<Icon name="file-plus" height={28} width={28} />
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
						className="flex flex-col items-center gap-4 rounded-xl border-2 border-pro-cards-border bg-pro-cards-bg p-6 text-center transition-all hover:border-brand/40"
					>
						<div className="flex size-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
							<Icon name="bar-chart-2" height={28} width={28} />
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
		</Ariakit.Dialog>
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
				const dimension = template.filter.metadataFlag
				const query = dimension ? dimensions[dimension] : template.type === 'chains' ? categories : undefined
				const needsCatalog = !dimension
				const queryMissing = query && query.data === undefined
				const catalogError = needsCatalog && protocolCatalog.status === 'error'
				const failed = catalogError || (queryMissing && query.isError && !query.isFetching)
				const loading = !failed && ((needsCatalog && protocolCatalog.status === 'loading') || queryMissing)
				const empty = !failed && !loading && selections[index].length === 0
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
							onCreate({
								dashboardName: template.name,
								visibility: hasActiveSubscription ? 'private' : 'public',
								tags: [],
								description: template.description,
								items: generateTemplateCharts(template, selections[index])
							})
						}}
						className={`rounded-lg border p-2.5 text-left transition-colors hover:border-brand/40 aria-disabled:cursor-not-allowed ${creating ? 'border-brand/40' : 'border-pro-cards-border aria-disabled:opacity-60'}`}
					>
						<span className="flex items-center gap-2 text-sm font-medium text-pro-text-primary">
							{template.name}
							{creating || loading ? <LoadingSpinner size={14} /> : null}
						</span>
						<span id={`${id}-${template.id}`} className="mt-0.5 block text-xs text-pro-text-tertiary">
							{template.description}
							<span role="status" className={failed ? 'block text-error' : 'block'}>
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
	status
}: {
	status: MutationStatus
	onCreate: (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: Array<string>
		description: string
	}) => void
}) {
	const id = useId()
	const { hasActiveSubscription } = useAuthContext()
	const [visibility, setVisibility] = useState<'private' | 'public'>('public')
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

		onCreate({ dashboardName, visibility, tags, description })
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
						onInput={(e) => e.currentTarget.setCustomValidity('')}
						placeholder="Enter dashboard name"
						className="w-full rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-3 py-2 placeholder:text-pro-text-tertiary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
						required
					/>
				</div>

				<div>
					<p id="create-dashboard-visibility" className="mb-3 block text-sm font-medium text-pro-text-primary">
						Visibility
					</p>
					<Ariakit.RadioProvider value={visibility} setValue={(value) => setVisibility(value as 'public' | 'private')}>
						<Ariakit.RadioGroup className="flex gap-3" aria-labelledby="create-dashboard-visibility">
							<label
								htmlFor={`${id}-public`}
								className={`relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-3 transition-colors has-focus-visible:focus-ring ${
									visibility === 'public'
										? 'border-brand bg-brand/10 font-medium text-brand'
										: 'border-pro-form-control-border text-pro-text-secondary hover:border-brand/40'
								}`}
							>
								<Ariakit.Radio id={`${id}-public`} value="public" className="sr-only" />
								<Icon name="earth" height={16} width={16} />
								Public
							</label>
							<label
								htmlFor={`${id}-private`}
								className={`relative flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border px-4 py-3 transition-colors has-focus-visible:focus-ring ${
									visibility === 'private'
										? 'border-brand bg-brand/10 font-medium text-brand'
										: !hasActiveSubscription
											? 'cursor-not-allowed border-pro-form-control-border text-pro-text-tertiary opacity-50'
											: 'border-pro-form-control-border text-pro-text-secondary hover:border-brand/40'
								}`}
							>
								<Ariakit.Radio
									id={`${id}-private`}
									value="private"
									disabled={!hasActiveSubscription}
									className="sr-only"
								/>
								<Icon name={hasActiveSubscription ? 'key' : 'file-lock-2'} height={16} width={16} />
								Private
								{!hasActiveSubscription ? <span className="text-xs opacity-70">(Pro)</span> : null}
							</label>
						</Ariakit.RadioGroup>
					</Ariakit.RadioProvider>
					{visibility === 'public' ? (
						<p className="mt-2 text-sm text-pro-text-tertiary">Public dashboards are visible in the Discover tab</p>
					) : null}
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
							className="flex-1 rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-3 py-2 placeholder:text-pro-text-tertiary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
						/>
						<button
							type="button"
							onClick={handleAddTag}
							className="rounded-md border border-brand/40 px-4 py-2 text-brand transition-colors hover:bg-brand/10"
						>
							Add Tag
						</button>
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
						maxLength={200}
						rows={3}
						className="w-full resize-none rounded-md border border-pro-form-control-border bg-surface-elevated-1 px-3 py-2 placeholder:text-pro-text-tertiary focus:border-brand focus:ring-1 focus:ring-brand focus:outline-hidden"
					/>
					<p className="mt-1 text-xs text-pro-text-tertiary">
						<span ref={charCountRef}>0</span>/200 characters
					</p>
				</div>
			</fieldset>

			<div className="mt-8 flex gap-3">
				<Ariakit.DialogDismiss
					type="button"
					disabled={status === 'pending'}
					className="flex-1 rounded-md border border-pro-form-control-border px-4 py-2 text-pro-text-secondary transition-colors hover:text-pro-text-primary disabled:opacity-50"
				>
					Cancel
				</Ariakit.DialogDismiss>
				<button
					type="submit"
					data-umami-event="dashboard-create"
					disabled={status === 'pending' || status === 'success'}
					className="flex flex-1 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 font-medium text-on-brand transition-colors hover:bg-brand/90 disabled:opacity-50"
				>
					{status === 'pending' ? (
						<LoadingSpinner size={16} />
					) : status === 'success' ? (
						<Icon name="check" height={16} width={16} />
					) : null}
					{status === 'pending' ? 'Creating…' : status === 'success' ? 'Created' : 'Create Dashboard'}
				</button>
			</div>
		</form>
	)
}
