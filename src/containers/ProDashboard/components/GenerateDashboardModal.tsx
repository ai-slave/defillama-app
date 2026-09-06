import * as Ariakit from '@ariakit/react'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { Icon } from '~/ui/Icon'
import { migrateDashboardItems } from '../dashboardConfig/migrate'
import type { PersistedDashboardItemConfig } from '../dashboardConfig/persisted'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { createDashboardStreamLineParser } from '../dashboardStreamLines'

const EMPTY_DASHBOARD_ITEMS: Array<DashboardItemConfig> = []
const EMPTY_DASHBOARD_TAGS: Array<string> = []

type AIGeneratedHistory = Record<
	string,
	{
		mode: 'create' | 'iterate'
		prompt: string
		rated: boolean
		rating?: number
		feedback?: string
		skipped?: boolean
		timestamp: string
		userId: string
	}
>

type DashboardCreatorRequest =
	| { message: string; dashboardName: string }
	| {
			message: string
			mode: 'iterate'
			existingDashboard: {
				dashboardName: string
				items: Array<DashboardItemConfig>
				aiGenerated?: AIGeneratedHistory
			}
	  }

interface DashboardCompleteEvent {
	type: 'dashboard_complete'
	dashboardConfig: { items: Array<PersistedDashboardItemConfig> }
	metadata?: { sessionId?: string; mode?: 'create' | 'iterate' }
}

interface DashboardErrorEvent {
	type: 'error'
	message?: string
}

type DashboardStreamEvent = DashboardCompleteEvent | DashboardErrorEvent

const parseDashboardStreamEvent = (line: string): DashboardStreamEvent => JSON.parse(line)

async function readDashboardCreatorStream(reader: ReadableStreamDefaultReader<Uint8Array>) {
	const completedDashboards: Array<DashboardCompleteEvent> = []
	const decoder = new TextDecoder()
	const lineParser = createDashboardStreamLineParser((line) => {
		if (!line.startsWith('data: ')) return
		let event: DashboardStreamEvent
		try {
			event = parseDashboardStreamEvent(line.slice(6))
		} catch {
			return
		}
		if (event.type === 'dashboard_complete') completedDashboards.push(event)
		else throw new Error(event.message || 'Failed to generate dashboard')
	})

	try {
		for (;;) {
			const { done, value } = await reader.read()
			if (done) {
				lineParser.push(decoder.decode())
				lineParser.finish()
				return completedDashboards.at(-1) ?? null
			}
			lineParser.push(decoder.decode(value, { stream: true }))
		}
	} finally {
		reader.releaseLock()
	}
}

interface GenerateDashboardModalProps {
	isOpen: boolean
	onClose: () => void
	mode?: 'create' | 'iterate'
	existingDashboard?: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: Array<string>
		description: string
		items: Array<DashboardItemConfig>
		aiGenerated?: AIGeneratedHistory
	}
	onGenerate: (data: {
		dashboardName: string
		visibility: 'private' | 'public'
		tags: Array<string>
		description: string
		items: Array<DashboardItemConfig>
		aiGenerationContext?: {
			sessionId: string
			mode: 'create' | 'iterate'
			timestamp: string
			prompt: string
		}
	}) => void
}

export function GenerateDashboardModal({
	isOpen,
	onClose,
	mode = 'create',
	existingDashboard,
	onGenerate
}: GenerateDashboardModalProps) {
	const { user, isAuthenticated, authorizedFetch } = useAuthContext()
	const [isLoading, setIsLoading] = useState(false)
	const [visibility, setVisibility] = useState<'private' | 'public'>('public')
	const [tags, setTags] = useState<Array<string>>([])
	const tagInputRef = useRef<HTMLInputElement>(null)
	const charCountRef = useRef<HTMLSpanElement>(null)

	const resetModalState = () => {
		setVisibility('public')
		setTags([])
	}

	const handleGenerate = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (!isAuthenticated || !user?.id) {
			toast.error('Please sign in to generate dashboards')
			return
		}

		const form = e.currentTarget
		const formData = new FormData(form)
		const dashboardNameValue = formData.get('dashboardName')
		const descriptionValue = formData.get('aiDescription')
		const dashboardName = typeof dashboardNameValue === 'string' ? dashboardNameValue.trim() : ''
		const aiDescription = typeof descriptionValue === 'string' ? descriptionValue : ''

		if (mode === 'create') {
			const nameElement = form.elements.namedItem('dashboardName')
			const nameInput = nameElement instanceof HTMLInputElement ? nameElement : null
			if (!dashboardName) {
				nameInput?.setCustomValidity('Dashboard name is required')
				nameInput?.reportValidity()
				return
			}
		}

		const descriptionElement = form.elements.namedItem('aiDescription')
		const descInput = descriptionElement instanceof HTMLTextAreaElement ? descriptionElement : null
		if (!aiDescription.trim()) {
			descInput?.setCustomValidity('Description is required')
			descInput?.reportValidity()
			return
		}
		if (aiDescription.trim().length < 20) {
			descInput?.setCustomValidity('Description must be at least 20 characters')
			descInput?.reportValidity()
			return
		}
		if (aiDescription.length > 5000) {
			descInput?.setCustomValidity('Description must be 5000 characters or less')
			descInput?.reportValidity()
			return
		}

		let existingItems = EMPTY_DASHBOARD_ITEMS
		if (mode === 'iterate' && existingDashboard && existingDashboard.items) {
			existingItems = existingDashboard.items
		}

		let requestBody: DashboardCreatorRequest
		if (mode === 'iterate') {
			let existingName = ''
			if (existingDashboard && existingDashboard.dashboardName) {
				existingName = existingDashboard.dashboardName
			}
			requestBody = {
				message: aiDescription.trim(),
				mode: 'iterate',
				existingDashboard: {
					dashboardName: existingName,
					items: existingItems,
					...(existingDashboard?.aiGenerated ? { aiGenerated: existingDashboard.aiGenerated } : {})
				}
			}
		} else {
			requestBody = {
				message: aiDescription.trim(),
				dashboardName
			}
		}

		let dashboardNameForGenerate = dashboardName
		if (mode === 'iterate') {
			dashboardNameForGenerate = ''
			if (existingDashboard && existingDashboard.dashboardName) {
				dashboardNameForGenerate = existingDashboard.dashboardName
			}
		}

		let visibilityForGenerate = visibility
		if (mode === 'iterate') {
			visibilityForGenerate = 'private'
			if (existingDashboard && existingDashboard.visibility) {
				visibilityForGenerate = existingDashboard.visibility
			}
		}

		let tagsForGenerate = tags
		if (mode === 'iterate') {
			tagsForGenerate = EMPTY_DASHBOARD_TAGS
			if (existingDashboard && existingDashboard.tags != null) {
				tagsForGenerate = existingDashboard.tags
			}
		}

		let descriptionForGenerate = ''
		if (mode === 'iterate' && existingDashboard && existingDashboard.description) {
			descriptionForGenerate = existingDashboard.description
		}

		setIsLoading(true)
		try {
			const response = await authorizedFetch(`${AI_SERVER}/dashboard-creator`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(requestBody)
			})

			if (!response) {
				toast.error('Authentication failed. Please sign in again.')
				return
			}
			if (!response.ok) {
				toast.error('Failed to generate dashboard. Please try again.')
				return
			}

			const reader = response.body?.getReader()
			if (!reader) {
				toast.error('Failed to read response stream')
				return
			}
			const data = await readDashboardCreatorStream(reader)
			if (!data) {
				toast.error('Invalid response format from AI service')
				return
			}

			const items = migrateDashboardItems(data.dashboardConfig.items)
			const sessionId = data.metadata?.sessionId
			const generationMode = data.metadata?.mode ?? mode
			const aiGenerationContext = sessionId
				? {
						sessionId,
						mode: generationMode,
						timestamp: new Date().toISOString(),
						prompt: aiDescription.trim()
					}
				: undefined

			onGenerate({
				dashboardName: dashboardNameForGenerate,
				visibility: visibilityForGenerate,
				tags: tagsForGenerate,
				description: descriptionForGenerate,
				items,
				...(aiGenerationContext ? { aiGenerationContext } : {})
			})

			resetModalState()
			onClose()
		} catch (error) {
			console.error('Failed to generate dashboard:', error)
			toast.error(error instanceof Error ? error.message : 'Failed to generate dashboard. Please try again.')
		} finally {
			setIsLoading(false)
		}
	}

	const handleClose = () => {
		if (!isLoading) {
			resetModalState()
			onClose()
		}
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
		<Ariakit.DialogProvider
			open={isOpen}
			setOpen={(open) => {
				if (!open) handleClose()
			}}
		>
			<Ariakit.Dialog
				className="dialog w-full max-w-lg gap-0 border pro-dashboard border-pro-cards-border bg-pro-cards-bg p-6 shadow-2xl"
				unmountOnHide
				portal
				hideOnInteractOutside
			>
				<div className="mb-6 flex items-center justify-between">
					<h2 className="text-xl font-semibold text-pro-text-primary">
						{mode === 'iterate' ? 'Edit with LlamaAI' : 'Generate using LlamaAI'}
					</h2>
					<Ariakit.DialogDismiss
						disabled={isLoading}
						className="rounded-md pro-hover-bg p-1 transition-colors disabled:opacity-50"
					>
						<Icon name="x" height={20} width={20} className="text-pro-text-secondary" />
						<span className="sr-only">Close dialog</span>
					</Ariakit.DialogDismiss>
				</div>

				<form
					onSubmit={(e) => {
						void handleGenerate(e)
					}}
				>
					<div className="space-y-6">
						{mode === 'create' ? (
							<div>
								<label
									htmlFor="generate-dashboard-name"
									className="mb-3 block text-sm font-medium text-pro-text-primary"
								>
									Dashboard Name
								</label>
								<input
									id="generate-dashboard-name"
									name="dashboardName"
									type="text"
									onInput={(e) => e.currentTarget.setCustomValidity('')}
									placeholder="e.g., Ethereum vs Arbitrum Analysis"
									className={`w-full rounded-md border pro-border px-3 py-2 text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
									disabled={isLoading}
									required
								/>
							</div>
						) : null}

						<div>
							<label
								htmlFor="generate-dashboard-description"
								className="mb-3 block text-sm font-medium text-pro-text-primary"
							>
								{mode === 'iterate'
									? 'Describe what you want to add or change'
									: 'Describe the dashboard you want to create'}
							</label>
							<textarea
								id="generate-dashboard-description"
								name="aiDescription"
								onInput={(e) => {
									e.currentTarget.setCustomValidity('')
									if (charCountRef.current) charCountRef.current.textContent = String(e.currentTarget.value.length)
								}}
								placeholder={
									mode === 'iterate'
										? 'e.g., Add a chart showing weekly DEX volume breakdown by top 5 protocols, or Remove the stablecoin chart and add TVL comparison...'
										: 'e.g., Build a DeFi yields dashboard with top earning protocols, comparing different chains and showing historical performance...'
								}
								rows={4}
								className={`w-full resize-none rounded-md border pro-border px-3 py-2 text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
								disabled={isLoading}
								required
							/>
							<p className="mt-1 text-xs text-pro-text-tertiary">
								{mode === 'iterate'
									? 'Be specific about what you want to add, remove, or modify'
									: 'Be specific about what data, charts, and insights you want to see'}{' '}
								(<span ref={charCountRef}>0</span>/5000)
							</p>
						</div>

						{mode === 'create' ? (
							<div>
								<p id="generate-dashboard-visibility" className="mb-3 block text-sm font-medium text-pro-text-primary">
									Visibility
								</p>
								<div className="flex gap-3" aria-labelledby="generate-dashboard-visibility">
									<button
										type="button"
										onClick={() => setVisibility('public')}
										disabled={isLoading}
										className={`flex-1 rounded-md border px-4 py-3 transition-colors ${
											visibility === 'public'
												? 'pro-btn-primary'
												: 'pro-border text-pro-text-secondary hover:text-pro-text-primary'
										} ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
									>
										<Icon name="earth" height={16} width={16} className="mr-2 inline" />
										Public
									</button>
									<button
										type="button"
										onClick={() => setVisibility('private')}
										disabled={isLoading}
										className={`flex-1 rounded-md border px-4 py-3 transition-colors ${
											visibility === 'private'
												? 'pro-btn-primary'
												: 'pro-border text-pro-text-secondary hover:text-pro-text-primary'
										} ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
									>
										<Icon name="key" height={16} width={16} className="mr-2 inline" />
										Private
									</button>
								</div>
								{visibility === 'public' ? (
									<p className="mt-2 text-sm text-pro-text-tertiary">
										Public dashboards are visible in the Discover tab
									</p>
								) : null}
							</div>
						) : null}

						{mode === 'create' ? (
							<div>
								<label
									htmlFor="generate-dashboard-tag-input"
									className="mb-3 block text-sm font-medium text-pro-text-primary"
								>
									Tags
								</label>
								<div className="flex gap-2">
									<input
										id="generate-dashboard-tag-input"
										ref={tagInputRef}
										type="text"
										onKeyDown={handleTagInputKeyDown}
										placeholder="Enter tag name"
										className={`flex-1 rounded-md border pro-border px-3 py-2 text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden ${isLoading ? 'cursor-not-allowed opacity-50' : ''}`}
										disabled={isLoading}
									/>
									<button
										type="button"
										onClick={handleAddTag}
										disabled={isLoading}
										className={`rounded-md border px-4 py-2 transition-colors ${
											!isLoading ? 'pro-btn-primary-outline' : 'cursor-not-allowed pro-border text-pro-text-tertiary'
										}`}
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
												className="flex items-center gap-1 rounded-md border pro-border px-3 py-1 text-sm text-pro-text-secondary"
											>
												{tag}
												<button
													type="button"
													onClick={() => handleRemoveTag(tag)}
													className="hover:text-pro-info-400"
													disabled={isLoading}
												>
													<Icon name="x" height={12} width={12} />
												</button>
											</span>
										))}
									</div>
								) : null}
							</div>
						) : null}
					</div>

					<div className="mt-8 flex gap-3">
						<Ariakit.DialogDismiss
							type="button"
							disabled={isLoading}
							className="flex-1 rounded-md border pro-border pro-hover-bg px-4 py-2 text-pro-text-secondary transition-colors hover:text-pro-text-primary disabled:opacity-50"
						>
							Cancel
						</Ariakit.DialogDismiss>
						<button
							type="submit"
							disabled={isLoading}
							className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 transition-colors ${
								!isLoading
									? 'animate-pro-glow pro-btn-primary'
									: 'cursor-not-allowed border pro-border text-pro-text-tertiary'
							}`}
						>
							{isLoading ? (
								<>
									<Icon name="sparkles" height={16} width={16} className="animate-spin" />
									{mode === 'iterate' ? 'Updating...' : 'Generating...'}
								</>
							) : (
								<>
									<Icon name="sparkles" height={16} width={16} />
									{mode === 'iterate' ? 'Edit Dashboard' : 'Generate Dashboard'}
								</>
							)}
						</button>
					</div>
				</form>
			</Ariakit.Dialog>
		</Ariakit.DialogProvider>
	)
}
