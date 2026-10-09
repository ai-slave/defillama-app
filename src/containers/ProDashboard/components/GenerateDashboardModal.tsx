import * as Ariakit from '@ariakit/react'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import { useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuthContext } from '~/auth'
import { AI_SERVER } from '~/constants'
import { Button } from '~/ui/Button'
import {
	Dialog,
	DialogBody,
	DialogCancelButton,
	DialogDiscardGuard,
	DialogFooter,
	DialogHeader,
	useOpeningKey
} from '~/ui/Dialog'
import { Field } from '~/ui/Field'
import { showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, Textarea } from '~/ui/Input'
import { InlineStatus } from '~/ui/Status'
import { migrateDashboardItems } from '../dashboardConfig/migrate'
import type { PersistedDashboardItemConfig } from '../dashboardConfig/persisted'
import type { DashboardItemConfig } from '../dashboardItemConfig'
import { createDashboardStreamLineParser } from '../dashboardStreamLines'
import {
	type AIGeneratedData,
	DASHBOARD_NAME_MAX_LENGTH,
	type Dashboard,
	type GeneratedDashboardInput
} from '../dashboardTypes'
import { restoreItemsAfterIterate, stripCustomDataRows } from '../dashboardVariables/resolve'
import { type DashboardSaveNotices, showDashboardSaveNotices } from '../hooks/useDashboardAPI'
import { dashboardUrlKey } from '../services/DashboardAPI'
import { TagsField, VisibilityField } from './DashboardFormFields'

const EMPTY_DASHBOARD_ITEMS: Array<DashboardItemConfig> = []
const EMPTY_DASHBOARD_TAGS: Array<string> = []
const PROMPT_MAX_LENGTH = 5000
const PROMPT_MIN_LENGTH = 20
const UNEXPECTED_RESPONSE = 'LlamaAI sent an unexpected response.'

// fetch and stream reads reject with a TypeError ("Failed to fetch", "network error") when the connection fails.
function reportUnreachable(error: unknown): never {
	throw error instanceof TypeError ? new Error('Could not reach LlamaAI. Check your connection.') : error
}

// Server messages arrive with or without a full stop; the alert reads them as sentences.
function asSentence(message: string) {
	return /[.!?…]$/.test(message) ? message : `${message}.`
}

type DashboardCreatorRequest =
	| { message: string; dashboardName: string }
	| {
			message: string
			mode: 'iterate'
			existingDashboard: {
				dashboardName: string
				items: Array<DashboardItemConfig>
				aiGenerated?: AIGeneratedData
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

/** What a finished save reports once the dialog has closed: the created dashboard to open, or an edit's notices. */
type GenerateDashboardOutcome = { created: Dashboard } | { notices: DashboardSaveNotices }

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
		aiGenerated?: AIGeneratedData
	}
	onGenerate: (data: GeneratedDashboardInput) => Promise<GenerateDashboardOutcome>
}

export function GenerateDashboardModal(props: GenerateDashboardModalProps) {
	return <GenerateDashboardModalInner key={useOpeningKey(props.isOpen)} {...props} />
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
	const promptRef = useRef<HTMLTextAreaElement>(null)
	// The last failed generation or save, not the mutations' own errors: those clear as soon as a retry starts.
	const [error, setError] = useState<string | null>(null)
	const showError = (failure: Error) => {
		if (formRef.current?.isConnected) setError(asSentence(failure.message))
		else toast.error(asSentence(failure.message))
	}
	const save = useMutation({ mutationFn: onGenerate, onError: showError })
	const saveGeneratedDashboard = (payload: GeneratedDashboardInput) => {
		save.mutate(payload, {
			// Close first, so the notices never toast over the dialog.
			onSuccess: (outcome) => {
				onClose()
				if ('created' in outcome) void router.push(`/pro/${dashboardUrlKey(outcome.created)}`)
				else showDashboardSaveNotices(outcome.notices)
			}
		})
	}
	const generation = useMutation({
		mutationFn: async ({
			request,
			payload
		}: {
			request: DashboardCreatorRequest
			payload: Omit<GeneratedDashboardInput, 'items'>
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
		// A generation that lands answers any earlier failure; its save reports its own.
		onSuccess: () => setError(null),
		// Each opening owns its form. A request can still fail after navigating away.
		onError: showError
	})
	const pending = generation.isPending || save.isPending
	const pendingLabel = save.isPending ? 'Saving' : mode === 'iterate' ? 'Updating' : 'Generating'
	// Keep the generated payload intact until saved or explicitly discarded.
	const fieldsLocked = pending || !!generation.data
	const [visibility, setVisibility] = useState<'private' | 'public'>('public')
	const [tags, setTags] = useState<Array<string>>([])
	const [name, setName] = useState('')
	const [prompt, setPrompt] = useState('')
	const [submitted, setSubmitted] = useState(false)
	const dashboardName = name.trim()
	const message = prompt.trim()
	// The name field is only rendered in create mode.
	const nameError = mode === 'create' && !dashboardName ? 'Enter a dashboard name.' : null
	const promptError = !message
		? 'Enter a description.'
		: message.length < PROMPT_MIN_LENGTH
			? `Enter at least ${PROMPT_MIN_LENGTH} characters.`
			: prompt.length > PROMPT_MAX_LENGTH
				? `Enter ${PROMPT_MAX_LENGTH} characters or fewer.`
				: null

	const handleGenerate = (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		if (generation.data) {
			saveGeneratedDashboard(generation.data)
			return
		}
		if (nameError || promptError) return showFieldErrors(e.currentTarget, () => setSubmitted(true))

		const requestBody: DashboardCreatorRequest =
			mode === 'iterate'
				? {
						message,
						mode: 'iterate',
						existingDashboard: {
							dashboardName: existingDashboard?.dashboardName ?? '',
							items: stripCustomDataRows(existingDashboard?.items ?? EMPTY_DASHBOARD_ITEMS),
							...(existingDashboard?.aiGenerated ? { aiGenerated: existingDashboard.aiGenerated } : {})
						}
					}
				: { message, dashboardName }

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
		<Dialog size="md" open={isOpen} onClose={onClose} pending={pending} portal unmountOnHide>
			<form ref={formRef} noValidate onSubmit={handleGenerate} className="flex min-h-0 flex-auto flex-col">
				<DialogDiscardGuard
					when={name !== '' || prompt !== '' || tags.length > 0 || !!generation.data}
					title={generation.data ? 'Discard the generated dashboard?' : 'Discard this prompt?'}
					description={
						generation.data
							? 'The generated dashboard is not saved yet. Leaving discards it.'
							: 'Leaving discards what you typed.'
					}
				/>
				<DialogHeader title={mode === 'iterate' ? 'Edit with LlamaAI' : 'Generate using LlamaAI'} />
				<DialogBody>
					<div className="flex flex-col gap-4">
						{mode === 'create' ? (
							<Field label="Dashboard name" error={submitted ? nameError : null}>
								{(control) => (
									// Ariakit's autoFocus, so the dialog starts on the first field instead of the header ×.
									<Ariakit.Focusable
										autoFocus
										render={
											<Input
												{...control}
												name="dashboardName"
												type="text"
												maxLength={DASHBOARD_NAME_MAX_LENGTH}
												value={name}
												onChange={(e) => setName(e.target.value)}
												placeholder="e.g. Ethereum vs Arbitrum"
												readOnly={fieldsLocked}
												required
											/>
										}
									/>
								)}
							</Field>
						) : null}

						<Field
							label={
								mode === 'iterate'
									? 'Describe what you want to add or change'
									: 'Describe the dashboard you want to create'
							}
							hint={
								<span className="flex justify-between gap-3">
									<span>
										{mode === 'iterate'
											? 'Be specific about what you want to add, remove or change.'
											: 'Be specific about the data, charts and insights you want to see.'}
									</span>
									<span className="shrink-0">
										{prompt.length}/{PROMPT_MAX_LENGTH}
									</span>
								</span>
							}
							error={submitted ? promptError : null}
						>
							{(control) => (
								<Ariakit.Focusable
									autoFocus={mode === 'iterate'}
									render={
										<Textarea
											{...control}
											ref={promptRef}
											name="aiDescription"
											value={prompt}
											onChange={(e) => setPrompt(e.target.value)}
											placeholder={
												mode === 'iterate'
													? 'e.g. Add a chart of weekly DEX volume for the top 5 protocols, or remove the stablecoin chart and add a TVL comparison…'
													: 'e.g. Build a DeFi yields dashboard with the top earning protocols, comparing chains and showing historical performance…'
											}
											rows={4}
											className="resize-none"
											readOnly={fieldsLocked}
											required
										/>
									}
								/>
							)}
						</Field>

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
							{error}
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
									setError(null)
									// This button leaves with the result; the prompt it unlocks is what the reader edits next.
									promptRef.current?.focus()
								}}
							>
								Edit prompt and regenerate
							</Button>
						) : null
					}
					dismiss={<DialogCancelButton />}
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
