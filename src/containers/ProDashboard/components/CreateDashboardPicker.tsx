import * as Ariakit from '@ariakit/react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Suspense, lazy, useId, useMemo, useRef, useState } from 'react'
import { useAuthContext } from '~/auth'
import { fetchChainsByCategory as fetchChainsByCategoryApi } from '~/containers/Chains/api'
import { Icon } from '~/ui/Icon'
import { useAppMetadata } from '../AppMetadataContext'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { useDimensionProtocols } from '../hooks/useDimensionProtocols'
import { useProDashboardCatalog } from '../ProDashboardAPIContext'
import {
	DASHBOARD_TEMPLATES,
	generateTemplateCharts,
	type ChainCategoryData,
	type DashboardTemplate
} from '../templates'
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
	}) => Promise<void>
	comparisonPreset?: ComparisonPreset | null
}

async function fetchChainsByCategory(category: string): Promise<{ category: string; chains: Array<string> }> {
	return fetchChainsByCategoryApi(category)
		.then((data) => ({ category, chains: data.chainsUnique }))
		.catch(() => ({ category, chains: [] }))
}

export function CreateDashboardPicker(props: CreateDashboardPickerProps) {
	const open = Ariakit.useStoreState(props.dialogStore, 'open')
	return <CreateDashboardPickerInner key={open ? 'open' : 'closed'} {...props} />
}

function CreateDashboardPickerInner({ dialogStore, onCreate, comparisonPreset }: CreateDashboardPickerProps) {
	const [mode, setMode] = useState<PickerMode>('picker')
	const creation = useMutation({
		mutationFn: (data: Parameters<CreateDashboardPickerProps['onCreate']>[0]) => onCreate(data)
	})
	const submitCreation = (data: Parameters<CreateDashboardPickerProps['onCreate']>[0]) => {
		if (creation.isPending) return
		creation.mutate(data, {
			onSuccess: () => {
				dialogStore.hide()
				setMode('picker')
				setComparisonPresetHandled(false)
			}
		})
	}
	const [comparisonPresetHandled, setComparisonPresetHandled] = useState(false)
	const { hasActiveSubscription } = useAuthContext()
	const { protocols, chains } = useProDashboardCatalog()
	const { protocolsBySlug } = useAppMetadata()

	const { data: chainCategoriesData } = useQuery({
		queryKey: ['pro-dashboard', 'chain-categories-for-templates'],
		queryFn: async () => {
			const categoriesToFetch = ['Rollup']
			const results = await Promise.all(categoriesToFetch.map((category) => fetchChainsByCategory(category)))
			return results
		},
		staleTime: 60 * 60 * 1000
	})

	const chainCategoryData = useMemo<ChainCategoryData>(() => {
		const chainsInCategory = new Map<string, Set<string>>()
		if (chainCategoriesData) {
			for (const { category, chains: categoryChains } of chainCategoriesData) {
				chainsInCategory.set(category, new Set(categoryChains))
			}
		}
		return { chainsInCategory }
	}, [chainCategoriesData])

	const { dimensionProtocols } = useDimensionProtocols()
	const effectiveMode: PickerMode = comparisonPreset && !comparisonPresetHandled ? 'comparison' : mode

	const handleClose = () => {
		setMode('picker')
		setComparisonPresetHandled(false)
		dialogStore.toggle()
	}

	const handleCreateFromScratch = (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: Array<string>
		description: string
	}) => {
		submitCreation(data)
	}

	const handleCreateComparison = (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: Array<string>
		description: string
		items: Array<DashboardItemConfig>
	}) => {
		submitCreation(data)
	}

	const handleBackToPicker = () => {
		setComparisonPresetHandled(true)
		setMode('picker')
	}

	const handleCreateFromTemplate = (template: DashboardTemplate) => {
		const items = generateTemplateCharts(
			template,
			protocols,
			chains,
			protocolsBySlug,
			chainCategoryData,
			dimensionProtocols
		)

		submitCreation({
			dashboardName: template.name,
			visibility: hasActiveSubscription ? 'private' : 'public',
			tags: [],
			description: template.description,
			items
		})
	}

	if (effectiveMode === 'scratch') {
		return (
			<Ariakit.Dialog
				store={dialogStore}
				className="dialog w-full max-w-lg gap-0 border pro-dashboard border-pro-cards-border bg-pro-cards-bg p-0 shadow-2xl"
			>
				<fieldset disabled={creation.isPending} className="contents">
					<div className="flex items-center gap-2 border-b border-pro-cards-border px-6 py-4">
						<button
							type="button"
							aria-label="Back to dashboard choices"
							onClick={handleBackToPicker}
							className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary"
						>
							<Icon name="arrow-left" height={18} width={18} />
						</button>
						<Ariakit.DialogHeading className="text-lg font-semibold text-pro-text-primary">
							Create New Dashboard
						</Ariakit.DialogHeading>
					</div>
					<CreateDashboardModalContent onCreate={handleCreateFromScratch} />
				</fieldset>
				{creation.isPending ? (
					<p role="status" className="px-6 py-3 text-sm">
						Creating dashboard…
					</p>
				) : null}
				{creation.isError ? (
					<p role="alert" className="px-6 py-3 text-sm text-error">
						Could not create the dashboard. Your choices are still here; please try again.
					</p>
				) : null}
			</Ariakit.Dialog>
		)
	}

	if (effectiveMode === 'comparison') {
		return (
			<Ariakit.Dialog
				store={dialogStore}
				className="dialog w-full max-w-4xl gap-0 border pro-dashboard border-pro-cards-border bg-pro-cards-bg p-0 shadow-2xl"
			>
				<fieldset disabled={creation.isPending} className="contents">
					<div className="flex items-center justify-between border-b border-pro-cards-border px-6 py-4">
						<div className="flex items-center gap-2">
							<button
								type="button"
								aria-label="Back to dashboard choices"
								onClick={handleBackToPicker}
								className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary"
							>
								<Icon name="arrow-left" height={18} width={18} />
							</button>
							<Ariakit.DialogHeading className="text-lg font-semibold text-pro-text-primary">
								Create Comparison Dashboard
							</Ariakit.DialogHeading>
						</div>
						<Ariakit.DialogDismiss
							onClick={handleClose}
							className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary"
						>
							<Icon name="x" height={20} width={20} />
						</Ariakit.DialogDismiss>
					</div>
					<Suspense
						fallback={
							<div className="flex h-96 items-center justify-center">
								<div className="size-8 animate-spin rounded-full border-b-2 border-brand" />
							</div>
						}
					>
						<ComparisonWizard
							onComplete={handleCreateComparison}
							{...(comparisonPreset !== null ? { comparisonPreset } : {})}
						/>
					</Suspense>
				</fieldset>
				{creation.isPending ? (
					<p role="status" className="px-6 py-3 text-sm">
						Creating dashboard…
					</p>
				) : null}
				{creation.isError ? (
					<p role="alert" className="px-6 py-3 text-sm text-error">
						Could not create the dashboard. Your choices are still here; please try again.
					</p>
				) : null}
			</Ariakit.Dialog>
		)
	}

	return (
		<Ariakit.Dialog
			store={dialogStore}
			className="dialog w-full max-w-3xl gap-0 border pro-dashboard border-pro-cards-border bg-pro-cards-bg p-6 shadow-2xl"
		>
			<fieldset disabled={creation.isPending} className="contents">
				<div className="mb-6 flex items-center justify-between">
					<Ariakit.DialogHeading className="text-xl font-semibold text-pro-text-primary">
						Create New Dashboard
					</Ariakit.DialogHeading>
					<Ariakit.DialogDismiss
						onClick={handleClose}
						className="rounded-md p-1 text-pro-text-tertiary transition-colors hover:text-pro-text-primary"
					>
						<Icon name="x" height={20} width={20} />
						<span className="sr-only">Close dialog</span>
					</Ariakit.DialogDismiss>
				</div>

				<p className="mb-6 text-sm text-pro-text-secondary">How would you like to create your dashboard?</p>

				<div className="grid gap-4 sm:grid-cols-2">
					<button
						type="button"
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
					<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
						{DASHBOARD_TEMPLATES.map((template) => (
							<button
								key={template.id}
								type="button"
								onClick={() => handleCreateFromTemplate(template)}
								className="rounded-lg border border-pro-cards-border p-2.5 text-left transition-colors hover:border-brand/40"
							>
								<div className="text-sm font-medium text-pro-text-primary">{template.name}</div>
								<div className="mt-0.5 line-clamp-1 text-xs text-pro-text-tertiary">{template.description}</div>
							</button>
						))}
					</div>
				</div>
			</fieldset>
			{creation.isPending ? (
				<p role="status" className="px-6 py-3 text-sm">
					Creating dashboard…
				</p>
			) : null}
			{creation.isError ? (
				<p role="alert" className="px-6 py-3 text-sm text-error">
					Could not create the dashboard. Your choices are still here; please try again.
				</p>
			) : null}
		</Ariakit.Dialog>
	)
}

function CreateDashboardModalContent({
	onCreate
}: {
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
			<div className="space-y-6">
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
			</div>

			<div className="mt-8 flex gap-3">
				<Ariakit.DialogDismiss
					type="button"
					className="flex-1 rounded-md border border-pro-form-control-border px-4 py-2 text-pro-text-secondary transition-colors hover:text-pro-text-primary"
				>
					Cancel
				</Ariakit.DialogDismiss>
				<button
					type="submit"
					data-umami-event="dashboard-create"
					className="flex-1 rounded-md bg-brand px-4 py-2 font-medium text-on-brand transition-colors hover:bg-brand/90"
				>
					Create Dashboard
				</button>
			</div>
		</form>
	)
}
