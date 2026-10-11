import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { type RefObject, useRef, useState } from 'react'
import { Select } from '~/components/Select/Select'
import { TokenLogo } from '~/components/TokenLogo'
import { searchTokens } from '~/containers/TokenSearch/search'
import type { TokenSearchResult } from '~/containers/TokenSearch/types'
import { useDebouncedValue } from '~/hooks/useDebounce'
import type { FormSubmitEvent } from '~/types/forms'
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
import { Field, type FieldControlProps } from '~/ui/Field'
import { keepFocus, showFieldErrors } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input } from '~/ui/Input'
import { ListLoading } from '~/ui/NoResults'
import { popoverRowWithBorderStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { ErrorLine, InlineStatus } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { emailError } from '~/utils/email'
import { useSubmitLead } from './client'
import { LeadHoneypot, LeadSuccess } from './LeadForm'

const INTEREST_OPTIONS = [
	{ key: 'engage-market-maker', name: 'Engage a market maker' },
	{ key: 'treasury-management', name: 'Treasury management' },
	{ key: 'other', name: 'Other' }
]

const TOKEN_STATUS_OPTIONS = [
	{ value: 'pre-tge', label: 'Pre-TGE' },
	{ value: 'listed', label: 'Listed' },
	{ value: 'no-token', label: 'No token' }
] as const

type TokenStatus = (typeof TOKEN_STATUS_OPTIONS)[number]['value']

function TokenCombobox({
	control,
	inputRef,
	onSelect,
	onManual
}: {
	control: FieldControlProps
	inputRef: RefObject<HTMLInputElement | null>
	onSelect: (token: TokenSearchResult) => void
	onManual: () => void
}) {
	const [query, setQuery] = useState('')
	const debouncedQuery = useDebouncedValue(query, 200)
	const results = useQuery({
		queryKey: ['mm-token-search', debouncedQuery],
		queryFn: () => searchTokens(debouncedQuery),
		enabled: debouncedQuery.trim().length > 0,
		staleTime: 5 * 60 * 1000,
		refetchOnWindowFocus: false
	})
	const tokens = (results.data ?? []).slice(0, 8)

	return (
		<Ariakit.ComboboxProvider inputValue={query} setInputValue={setQuery}>
			<Ariakit.Combobox
				{...control}
				ref={inputRef}
				placeholder="Search your token by name or ticker"
				autoSelect
				render={<Input className="w-full" />}
			/>
			<ComboboxSurface
				variant="search-results"
				sameWidth
				className="max-h-[min(320px,var(--popover-available-height))]"
			>
				{tokens.map((token) => (
					<Ariakit.ComboboxItem
						key={token.searchId}
						value={token.name}
						setValueOnClick={false}
						hideOnClick
						onClick={() => onSelect(token)}
						className={popoverRowWithBorderStyles}
					>
						<span className="flex min-w-0 items-center gap-2">
							<TokenLogo src={token.logo} size={20} />
							<span className="truncate">{token.name}</span>
							<span className="shrink-0 text-tertiary">{token.symbol}</span>
						</span>
					</Ariakit.ComboboxItem>
				))}
				{debouncedQuery.trim().length === 0 ? (
					<p className="px-3 py-6 text-center body-sm text-tertiary">Start typing to search tokens</p>
				) : results.isPending ? (
					<ListLoading label="Searching" />
				) : results.isError ? (
					<ErrorLine inset="menuRow">Couldn&apos;t search tokens. Edit the search to try again.</ErrorLine>
				) : tokens.length === 0 ? (
					<p role="status" className="px-3 py-6 text-center body-sm text-tertiary">
						No tokens found
					</p>
				) : null}
				<Ariakit.ComboboxItem
					setValueOnClick={false}
					hideOnClick
					onClick={onManual}
					className={`${popoverRowWithBorderStyles} text-link`}
				>
					My token does not appear in this list
				</Ariakit.ComboboxItem>
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}

export function ConnectDialog({
	open,
	onClose,
	...form
}: {
	open: boolean
	onClose: () => void
	marketMakerId: string | null
	marketMakerName: string
	/** Recorded by the click that opened this form; null until that request answers, or if it failed. */
	clickId: string | null
}) {
	// One form per opening: a new opening starts a new request, and the dialog locks while one runs.
	const key = useOpeningKey(open)
	return <ConnectForm key={key} open={open} onClose={onClose} {...form} />
}

function ConnectForm({
	open,
	onClose,
	marketMakerId,
	marketMakerName,
	clickId
}: {
	open: boolean
	onClose: () => void
	marketMakerId: string | null
	marketMakerName: string
	clickId: string | null
}) {
	const submit = useSubmitLead('connect')
	// The last failure, kept while a retry runs: the mutation clears its own error when the retry starts.
	const [failure, setFailure] = useState<string | null>(null)
	const [interest, setInterest] = useState('')
	const [tokenStatus, setTokenStatus] = useState<TokenStatus>('pre-tge')
	const [projectName, setProjectName] = useState('')
	const [tokenTicker, setTokenTicker] = useState('')
	const [selectedToken, setSelectedToken] = useState<TokenSearchResult | null>(null)
	const [manualToken, setManualToken] = useState(false)
	const [fullName, setFullName] = useState('')
	const [email, setEmail] = useState('')
	const [honeypot, setHoneypot] = useState('')
	const [submitted, setSubmitted] = useState(false)
	// Each token step replaces the control that was used: focus moves to the one that takes its place.
	const tokenSearchRef = useRef<HTMLInputElement>(null)
	const changeTokenRef = useRef<HTMLButtonElement>(null)
	const projectNameRef = useRef<HTMLInputElement>(null)

	const hasToken = tokenStatus !== 'no-token'
	const listedToken = tokenStatus === 'listed' ? selectedToken : null
	const showManualFields = tokenStatus === 'pre-tge' || (tokenStatus === 'listed' && manualToken)

	const errors = {
		interest: interest === '' ? 'Choose what you are interested in.' : null,
		token:
			tokenStatus === 'listed' && !selectedToken && !manualToken
				? 'Choose your token, or “My token does not appear in this list”.'
				: null,
		projectName: showManualFields && projectName.trim() === '' ? 'Enter the project name.' : null,
		tokenTicker: showManualFields && tokenTicker.trim() === '' ? 'Enter the token ticker.' : null,
		fullName: fullName.trim() === '' ? 'Enter your full name.' : null,
		email: emailError(email)
	}

	const dirty =
		interest !== '' ||
		tokenStatus !== 'pre-tge' ||
		projectName !== '' ||
		tokenTicker !== '' ||
		selectedToken !== null ||
		manualToken ||
		fullName !== '' ||
		email !== ''

	const onSubmit = (event: FormSubmitEvent) => {
		event.preventDefault()
		if (submit.isPending) return
		if (Object.values(errors).some(Boolean)) return showFieldErrors(event.currentTarget, () => setSubmitted(true))
		submit.mutate(
			{
				interest,
				token_status: tokenStatus,
				project_name: hasToken ? (listedToken?.name ?? projectName) : null,
				token_ticker: hasToken ? (listedToken?.symbol ?? tokenTicker) : null,
				coingecko_id: listedToken?.id ?? null,
				full_name: fullName,
				email: email.trim(),
				market_maker_id: marketMakerId,
				market_maker_name: marketMakerName,
				click_id: clickId,
				source_url: typeof window === 'undefined' ? null : window.location.href,
				hp: honeypot
			},
			{ onError: (error) => setFailure(error.message) }
		)
	}

	// Each token step asks a new question with empty fields, so it opens without the last submit's errors; they
	// return on the next submit.
	const changeTokenStatus = (value: TokenStatus) => {
		setTokenStatus(value)
		setSelectedToken(null)
		setManualToken(false)
		setSubmitted(false)
	}
	const showManualToken = (manual: boolean) => {
		setManualToken(manual)
		setSubmitted(false)
	}

	return (
		<Dialog size="md" open={open} onClose={onClose} pending={submit.isPending} portal unmountOnHide>
			{submit.isSuccess ? (
				<LeadSuccess
					title="Request received"
					message={`The Forgd team will review your request and use the contact details you provided to put you in touch with ${marketMakerName}.`}
				/>
			) : (
				<form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-auto flex-col">
					<DialogDiscardGuard
						when={dirty}
						title="Discard this request?"
						description="The details you entered are lost."
					/>
					<DialogHeader title={`Get in touch with ${marketMakerName}`} />
					<DialogBody>
						<p className="body-sm text-secondary">
							Share your details and Forgd will put you in direct contact with {marketMakerName}.
						</p>
						<Field label="What are you interested in?" error={submitted ? errors.interest : null}>
							{(control) => (
								<Select
									heading="Interest"
									allValues={INTEREST_OPTIONS}
									selectedValues={interest}
									setSelectedValues={setInterest}
									label={INTEREST_OPTIONS.find((option) => option.key === interest)?.name ?? 'Select an option'}
									labelType="none"
									variant="input"
									size="md"
									className="w-full"
									// The form's first field. Select names its trigger with an aria-label, which would hide the
									// Field's label.
									triggerProps={{ ...control, autoFocus: true }}
								/>
							)}
						</Field>
						<div className="flex flex-col gap-1">
							<span className="label-sm text-secondary">What is the status of your token?</span>
							<SegmentedControl
								value={tokenStatus}
								onValueChange={changeTokenStatus}
								options={TOKEN_STATUS_OPTIONS}
								label="Token status"
								variant="default"
								size="md"
								className="w-full!"
								buttonClassName="inline-flex flex-1 basis-0 items-center justify-center"
							/>
						</div>
						{tokenStatus === 'listed' && !manualToken ? (
							<Field label="Your token" error={submitted ? errors.token : null}>
								{(control) =>
									selectedToken ? (
										<Input
											{...control}
											readOnly
											value={selectedToken.name}
											className="w-full"
											prefix={<TokenLogo src={selectedToken.logo} size={20} />}
											suffix={
												<span className="flex items-center gap-2">
													{selectedToken.symbol}
													<Tooltip
														content="Change token"
														render={
															<Button
																ref={changeTokenRef}
																variant="ghost"
																size="sm"
																square
																onClick={() =>
																	keepFocus(
																		() => setSelectedToken(null),
																		() => tokenSearchRef.current
																	)
																}
																aria-label="Change token"
															/>
														}
													>
														<Icon name="x" className="size-4" />
													</Tooltip>
												</span>
											}
										/>
									) : (
										<TokenCombobox
											control={control}
											inputRef={tokenSearchRef}
											onSelect={(token) =>
												keepFocus(
													() => setSelectedToken(token),
													() => changeTokenRef.current
												)
											}
											onManual={() =>
												keepFocus(
													() => showManualToken(true),
													() => projectNameRef.current
												)
											}
										/>
									)
								}
							</Field>
						) : null}
						{showManualFields ? (
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<Field label="Project name" error={submitted ? errors.projectName : null}>
									{(control) => (
										<Input
											{...control}
											ref={projectNameRef}
											value={projectName}
											onChange={(e) => setProjectName(e.target.value)}
											maxLength={200}
											placeholder="Project"
										/>
									)}
								</Field>
								<Field label="Token ticker" error={submitted ? errors.tokenTicker : null}>
									{(control) => (
										<Input
											{...control}
											value={tokenTicker}
											onChange={(e) => setTokenTicker(e.target.value)}
											maxLength={32}
											placeholder="ABC"
										/>
									)}
								</Field>
							</div>
						) : null}
						{tokenStatus === 'listed' && manualToken ? (
							<div className="body-sm">
								<Button
									variant="link"
									onClick={() =>
										keepFocus(
											() => showManualToken(false),
											() => tokenSearchRef.current
										)
									}
								>
									<Icon name="arrow-left" className="size-3.5" />
									Back to token search
								</Button>
							</div>
						) : null}
						<div className="flex flex-col gap-1.5 border-t border-subtle pt-4">
							<span className="label-sm text-tertiary">Contact information</span>
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<Field label="Full name" error={submitted ? errors.fullName : null}>
									{(control) => (
										<Input
											{...control}
											value={fullName}
											onChange={(e) => setFullName(e.target.value)}
											maxLength={200}
											placeholder="Your name"
										/>
									)}
								</Field>
								<Field label="Email" error={submitted ? errors.email : null}>
									{(control) => (
										<Input
											{...control}
											type="email"
											required
											value={email}
											onChange={(e) => setEmail(e.target.value)}
											maxLength={320}
											placeholder="you@project.xyz"
										/>
									)}
								</Field>
							</div>
						</div>
						<LeadHoneypot value={honeypot} onChange={setHoneypot} />
						{failure ? <InlineStatus variant="error">{failure}</InlineStatus> : null}
					</DialogBody>
					<DialogFooter dismiss={<DialogCancelButton />}>
						<Button type="submit" variant="primary" size="md" pendingLabel="Submitting…" pending={submit.isPending}>
							Submit request
						</Button>
					</DialogFooter>
				</form>
			)}
		</Dialog>
	)
}
