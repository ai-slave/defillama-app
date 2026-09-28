import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { InlineStatus } from '~/ui/Status'
import { migrateDashboardItems } from '../dashboardConfig/migrate'
import type { PersistedDashboardItemConfig } from '../dashboardConfig/persisted'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { createDashboardStreamLineParser } from '../dashboardStreamLines'
import type { Dashboard } from '../dashboardTypes'
import { restoreItemsAfterIterate, stripCustomDataRows } from '../dashboardVariables/resolve'
import { dashboardUrlKey } from '../services/DashboardAPI'
import { ProButton } from '../ui'

const EMPTY_DASHBOARD_ITEMS: Array<DashboardItemConfig> = []
const EMPTY_DASHBOARD_TAGS: Array<string> = []
const VISIBILITY_OPTIONS = [
	{ value: 'public', label: 'Public', icon: 'earth' },
	{ value: 'private', label: 'Private', icon: 'key' }
] as const

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
	}) => Promise<Dashboard | void>
}

export function GenerateDashboardModal(props: GenerateDashboardModalProps) {
	return <GenerateDashboardModalInner key={props.isOpen ? 'open' : 'closed'} {...props} />
}

function GenerateDashboardModalInner({
	isOpen,
	onClose,
	mode = 'create',
	existingDashboard,
	onGenerate
}: GenerateDashboardModalProps) {
	const router = useRouter()
	const { user, isAuthenticated, authorizedFetch } = useAuthContext()
	const formRef = useRef<HTMLFormElement>(null)
	const save = useMutation({
		mutationFn: onGenerate,
		onError: (error) => {
			if (!formRef.current?.isConnected) toast.error(error.message)
		}
	})
	const saveGeneratedDashboard = (payload: Parameters<GenerateDashboardModalProps['onGenerate']>[0]) => {
		save.mutate(payload, {
			onSuccess: (dashboard) => {
				if (dashboard) void router.push(`/pro/${dashboardUrlKey(dashboard)}`)
				onClose()
			}
		})
	}
	const generation = useMutation({
		mutationFn: async ({
			request,
			payload
		}: {
			request: DashboardCreatorRequest
			payload: Omit<Parameters<GenerateDashboardModalProps['onGenerate']>[0], 'items'>
		}) => {
			if (!isAuthenticated || !user?.id) throw new Error('Please sign in to generate dashboards')
			const response = await authorizedFetch(`${AI_SERVER}/dashboard-creator`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(request)
			})
			if (!response) throw new Error('Authentication failed. Please sign in again.')
			if (!response.ok) throw new Error('Failed to generate dashboard. Please try again.')
			const reader = response.body?.getReader()
			if (!reader) throw new Error('Failed to read response stream')
			const data = await readDashboardCreatorStream(reader)
			if (!data) throw new Error('Invalid response format from AI service')
			const aiGenerationContext = data.metadata?.sessionId
				? {
						sessionId: data.metadata.sessionId,
						mode: data.metadata.mode ?? mode,
						timestamp: new Date().toISOString(),
						prompt: request.message
					}
				: undefined
			return {
				...payload,
				items: restoreItemsAfterIterate(
					existingDashboard?.items ?? EMPTY_DASHBOARD_ITEMS,
					migrateDashboardItems(data.dashboardConfig.items)
				),
				...(aiGenerationContext ? { aiGenerationContext } : {})
			}
		},
		onError: (error) => {
			// Each opening owns its form. A request can still fail after navigating away.
			if (!formRef.current?.isConnected) toast.error(error.message)
		}
	})
	const pending = generation.isPending || save.isPending
	const pendingLabel = save.isPending ? 'Saving' : mode === 'iterate' ? 'Updating' : 'Generating'
	// Keep the generated payload intact until saved or explicitly discarded.
	const fieldsLocked = pending || !!generation.data
	const error = save.error ?? generation.error
	const [visibility, setVisibility] = useState<'private' | 'public'>('public')
	const [tags, setTags] = useState<Array<string>>([])
	const tagInputRef = useRef<HTMLInputElement>(null)
	const charCountRef = useRef<HTMLSpanElement>(null)

	const handleGenerate = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (pending) return
		if (generation.data) {
			saveGeneratedDashboard(generation.data)
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

		const requestBody: DashboardCreatorRequest =
			mode === 'iterate'
				? {
						message: aiDescription.trim(),
						mode: 'iterate',
						existingDashboard: {
							dashboardName: existingDashboard?.dashboardName ?? '',
							items: stripCustomDataRows(existingDashboard?.items ?? EMPTY_DASHBOARD_ITEMS),
							...(existingDashboard?.aiGenerated ? { aiGenerated: existingDashboard.aiGenerated } : {})
						}
					}
				: { message: aiDescription.trim(), dashboardName }

		generation.mutate(
			{
				request: requestBody,
				payload: {
					dashboardName: mode === 'iterate' ? (existingDashboard?.dashboardName ?? '') : dashboardName,
					visibility: mode === 'iterate' ? (existingDashboard?.visibility ?? 'private') : visibility,
					tags: mode === 'iterate' ? (existingDashboard?.tags ?? EMPTY_DASHBOARD_TAGS) : tags,
					description: mode === 'iterate' ? (existingDashboard?.description ?? '') : ''
				}
			},
			{
				onSuccess: saveGeneratedDashboard
			}
		)
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
		<Dialog size="md" scope="pro" open={isOpen} onClose={onClose} pending={pending} portal unmountOnHide>
			<form ref={formRef} onSubmit={handleGenerate} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader title={mode === 'iterate' ? 'Edit with LlamaAI' : 'Generate using LlamaAI'} />
				<DialogBody>
					<div className="space-y-6">
						{mode === 'create' ? (
							<div>
								<label
									htmlFor="generate-dashboard-name"
									className="mb-3 block text-sm font-medium text-pro-text-primary"
								>
									Dashboard Name
								</label>
								{/* Ariakit's autoFocus, so the dialog starts on the first field instead of the header ×. */}
								<Ariakit.Focusable
									autoFocus
									render={
										<input
											id="generate-dashboard-name"
											name="dashboardName"
											type="text"
											onInput={(e) => e.currentTarget.setCustomValidity('')}
											placeholder="e.g., Ethereum vs Arbitrum Analysis"
											className={`w-full rounded-md border border-pro-cards-border px-3 py-2 text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden ${fieldsLocked ? 'cursor-not-allowed opacity-50' : ''}`}
											readOnly={fieldsLocked}
											required
										/>
									}
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
							<Ariakit.Focusable
								autoFocus={mode === 'iterate'}
								render={
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
										className={`w-full resize-none rounded-md border border-pro-cards-border px-3 py-2 text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden ${fieldsLocked ? 'cursor-not-allowed opacity-50' : ''}`}
										readOnly={fieldsLocked}
										required
									/>
								}
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
								<Ariakit.RadioProvider
									value={visibility}
									setValue={(value) => setVisibility(value as 'public' | 'private')}
								>
									<Ariakit.RadioGroup className="flex gap-3" aria-labelledby="generate-dashboard-visibility">
										{VISIBILITY_OPTIONS.map((option) => (
											<label
												key={option.value}
												className={`relative flex-1 cursor-pointer rounded-md border px-4 py-3 text-center transition-colors has-focus-visible:focus-ring ${
													visibility === option.value
														? 'border-brand bg-pro-info-100/60 text-pro-text-primary'
														: 'border-pro-cards-border text-pro-text-secondary hover:text-pro-text-primary'
												} ${fieldsLocked ? 'cursor-not-allowed opacity-50' : ''}`}
											>
												<Ariakit.Radio
													value={option.value}
													className="sr-only"
													disabled={fieldsLocked}
													accessibleWhenDisabled
												/>
												<Icon name={option.icon} height={16} width={16} className="mr-2 inline" />
												{option.label}
											</label>
										))}
									</Ariakit.RadioGroup>
								</Ariakit.RadioProvider>
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
										className={`min-w-0 flex-1 rounded-md border border-pro-cards-border px-3 py-2 text-pro-text-primary placeholder:text-pro-text-tertiary focus:ring-1 focus:ring-brand focus:outline-hidden ${fieldsLocked ? 'cursor-not-allowed opacity-50' : ''}`}
										disabled={fieldsLocked}
									/>
									<ProButton type="button" onClick={handleAddTag} disabled={fieldsLocked} variant="secondary">
										Add Tag
									</ProButton>
								</div>

								<p className="mt-2 text-xs text-pro-text-tertiary">Press Enter to add tag</p>

								{tags.length > 0 ? (
									<div className="mt-3 flex flex-wrap gap-2">
										{tags.map((tag) => (
											<span
												key={tag}
												className="flex max-w-full items-center gap-1 rounded-md border border-pro-cards-border px-3 py-1 text-sm text-pro-text-secondary"
											>
												<span className="min-w-0 wrap-anywhere">{tag}</span>
												<button
													type="button"
													onClick={() => handleRemoveTag(tag)}
													aria-label={`Remove tag ${tag}`}
													className="hover:text-pro-info-400"
													disabled={fieldsLocked}
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

					{error ? (
						<InlineStatus variant="error">
							{error.message}{' '}
							{generation.data
								? 'Your generated dashboard is ready. Retry saving it without generating again.'
								: 'Your draft is still here; please try again.'}
						</InlineStatus>
					) : null}
				</DialogBody>
				<DialogFooter
					leading={
						generation.data && !pending ? (
							<Button
								type="button"
								variant="ghost"
								size="md"
								onClick={() => {
									generation.reset()
									save.reset()
								}}
							>
								Edit prompt and regenerate
							</Button>
						) : null
					}
					dismiss={
						<Button type="button" size="md" onClick={onClose} disabled={pending}>
							Cancel
						</Button>
					}
				>
					<Button type="submit" variant="primary" size="md" pendingLabel={pending ? `${pendingLabel}…` : null}>
						<Icon name="sparkles" height={16} width={16} />
						{generation.data ? 'Retry save' : mode === 'iterate' ? 'Edit Dashboard' : 'Generate Dashboard'}
					</Button>
				</DialogFooter>
				<span role="status" className="sr-only">
					{pending ? `${pendingLabel} dashboard` : ''}
				</span>
			</form>
		</Dialog>
	)
}
