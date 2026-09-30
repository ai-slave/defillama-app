import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { Button } from '~/ui/Button'
import { Dialog, DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'
import { Icon } from '~/ui/Icon'
import { Input, textareaStyles } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { migrateDashboardItems } from '../dashboardConfig/migrate'
import type { PersistedDashboardItemConfig } from '../dashboardConfig/persisted'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { createDashboardStreamLineParser } from '../dashboardStreamLines'
import { DASHBOARD_NAME_MAX_LENGTH, type Dashboard } from '../dashboardTypes'
import { restoreItemsAfterIterate, stripCustomDataRows } from '../dashboardVariables/resolve'
import { dashboardUrlKey } from '../services/DashboardAPI'
import { dashboardFieldHintStyles, dashboardFieldLabelStyles, TagsField, VisibilityField } from './DashboardFormFields'

const EMPTY_DASHBOARD_ITEMS: Array<DashboardItemConfig> = []
const EMPTY_DASHBOARD_TAGS: Array<string> = []
const PROMPT_MAX_LENGTH = 5000
const UNEXPECTED_RESPONSE = 'LlamaAI sent an unexpected response.'

// fetch and stream reads reject with a TypeError ("Failed to fetch", "network error") when the connection fails.
function reportUnreachable(error: unknown): never {
	throw error instanceof TypeError ? new Error('Could not reach LlamaAI. Check your connection.') : error
}

// Server messages arrive with or without a full stop; the alert reads them as sentences.
function asSentence(message: string) {
	return /[.!?…]$/.test(message) ? message : `${message}.`
}

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
		else throw new Error(event.message || 'LlamaAI could not generate the dashboard.')
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
	const id = useId()
	const router = useRouter()
	const { user, isAuthenticated, authorizedFetch } = useAuthContext()
	const formRef = useRef<HTMLFormElement>(null)
	const save = useMutation({
		mutationFn: onGenerate,
		onError: (error) => {
			if (!formRef.current?.isConnected) toast.error(asSentence(error.message))
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
			if (!isAuthenticated || !user?.id) throw new Error('Sign in to generate dashboards.')
			const response = await authorizedFetch(`${AI_SERVER}/dashboard-creator`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(request)
			}).catch(reportUnreachable)
			if (!response) throw new Error('Authentication failed. Sign in again.')
			if (!response.ok) throw new Error('LlamaAI could not generate the dashboard.')
			const reader = response.body?.getReader()
			if (!reader) throw new Error(UNEXPECTED_RESPONSE)
			const data = await readDashboardCreatorStream(reader).catch(reportUnreachable)
			if (!data) throw new Error(UNEXPECTED_RESPONSE)
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
			if (!formRef.current?.isConnected) toast.error(asSentence(error.message))
		}
	})
	const pending = generation.isPending || save.isPending
	const pendingLabel = save.isPending ? 'Saving' : mode === 'iterate' ? 'Updating' : 'Generating'
	// Keep the generated payload intact until saved or explicitly discarded.
	const fieldsLocked = pending || !!generation.data
	const error = save.error ?? generation.error
	const [visibility, setVisibility] = useState<'private' | 'public'>('public')
	const [tags, setTags] = useState<Array<string>>([])
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
		if (aiDescription.length > PROMPT_MAX_LENGTH) {
			descInput?.setCustomValidity(`Description must be ${PROMPT_MAX_LENGTH} characters or less`)
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

	return (
		<Dialog size="md" scope="pro" open={isOpen} onClose={onClose} pending={pending} portal unmountOnHide>
			<form ref={formRef} onSubmit={handleGenerate} className="flex min-h-0 flex-auto flex-col">
				<DialogHeader title={mode === 'iterate' ? 'Edit with LlamaAI' : 'Generate using LlamaAI'} />
				<DialogBody>
					<div className="flex flex-col gap-4">
						{mode === 'create' ? (
							<div className="flex flex-col gap-1.5">
								<label htmlFor={`${id}-name`} className={dashboardFieldLabelStyles}>
									Dashboard name
								</label>
								{/* Ariakit's autoFocus, so the dialog starts on the first field instead of the header ×. */}
								<Ariakit.Focusable
									autoFocus
									render={
										<Input
											id={`${id}-name`}
											name="dashboardName"
											type="text"
											maxLength={DASHBOARD_NAME_MAX_LENGTH}
											onInput={(e) => e.currentTarget.setCustomValidity('')}
											placeholder="e.g. Ethereum vs Arbitrum"
											readOnly={fieldsLocked}
											required
										/>
									}
								/>
							</div>
						) : null}

						<div className="flex flex-col gap-1.5">
							<label htmlFor={`${id}-prompt`} className={dashboardFieldLabelStyles}>
								{mode === 'iterate'
									? 'Describe what you want to add or change'
									: 'Describe the dashboard you want to create'}
							</label>
							<Ariakit.Focusable
								autoFocus={mode === 'iterate'}
								render={
									<textarea
										id={`${id}-prompt`}
										name="aiDescription"
										onInput={(e) => {
											e.currentTarget.setCustomValidity('')
											if (charCountRef.current) charCountRef.current.textContent = String(e.currentTarget.value.length)
										}}
										placeholder={
											mode === 'iterate'
												? 'e.g. Add a chart of weekly DEX volume for the top 5 protocols, or remove the stablecoin chart and add a TVL comparison…'
												: 'e.g. Build a DeFi yields dashboard with the top earning protocols, comparing chains and showing historical performance…'
										}
										rows={4}
										aria-describedby={`${id}-prompt-hint`}
										className={`${textareaStyles} resize-none`}
										readOnly={fieldsLocked}
										required
									/>
								}
							/>
							<p id={`${id}-prompt-hint`} className={`flex justify-between gap-3 ${dashboardFieldHintStyles}`}>
								<span>
									{mode === 'iterate'
										? 'Be specific about what you want to add, remove or change.'
										: 'Be specific about the data, charts and insights you want to see.'}
								</span>
								<span className="shrink-0">
									<span ref={charCountRef}>0</span>/{PROMPT_MAX_LENGTH}
								</span>
							</p>
						</div>

						{mode === 'create' ? (
							<>
								<VisibilityField
									value={visibility}
									onChange={setVisibility}
									sharedWithTeam={false}
									disabled={fieldsLocked}
								/>
								<TagsField tags={tags} onChange={setTags} disabled={fieldsLocked} />
							</>
						) : null}
					</div>

					{error ? (
						<InlineStatus variant="error">
							{asSentence(error.message)}
							<span className="block">
								{generation.data
									? 'Your generated dashboard is ready. Retry saving it without generating again.'
									: 'Your draft is still here. Try again.'}
							</span>
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
						{generation.data ? 'Retry save' : mode === 'iterate' ? 'Edit dashboard' : 'Generate dashboard'}
					</Button>
				</DialogFooter>
				<span role="status" className="sr-only">
					{pending ? `${pendingLabel} dashboard` : ''}
				</span>
			</form>
		</Dialog>
	)
}
