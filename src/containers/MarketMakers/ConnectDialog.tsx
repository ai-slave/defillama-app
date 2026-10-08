import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { type RefObject, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { TokenLogo } from '~/components/TokenLogo'
import { searchTokens } from '~/containers/TokenSearch/search'
import type { TokenSearchResult } from '~/containers/TokenSearch/types'
import { useDebouncedValue } from '~/hooks/useDebounce'
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
import { keepFocus } from '~/ui/focus'
import { Icon } from '~/ui/Icon'
import { Input, inputStyles } from '~/ui/Input'
import { popoverRowWithBorderStyles, popoverSingleSelectCheckStyles } from '~/ui/Popover'
import { ComboboxSurface } from '~/ui/PopoverSurface'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { InlineStatus, LoadingIndicator } from '~/ui/Status'
import { Tooltip } from '~/ui/Tooltip'
import { useSubmitLead } from './client'
import { LeadField, LeadHoneypot, LeadSuccess } from './LeadForm'
import { EMAIL_PATTERN } from './leadShared'

const INTEREST_OPTIONS = [
	{ value: 'engage-market-maker', label: 'Engage a market maker' },
	{ value: 'treasury-management', label: 'Treasury management' },
	{ value: 'other', label: 'Other' }
] as const

const TOKEN_STATUS_OPTIONS = [
	{ value: 'pre-tge', label: 'Pre-TGE' },
	{ value: 'listed', label: 'Listed' },
	{ value: 'no-token', label: 'No token' }
] as const

type TokenStatus = (typeof TOKEN_STATUS_OPTIONS)[number]['value']

function InterestSelect({
	value,
	invalid,
	onChange
}: {
	value: string
	invalid: boolean
	onChange: (value: string) => void
}) {
	const selected = INTEREST_OPTIONS.find((option) => option.value === value)
	return (
		<Ariakit.ComboboxProvider selectedValue={value} setSelectedValue={onChange}>
			{/* The form's first field. */}
			<Ariakit.ComboboxSelect
				autoFocus
				aria-invalid={invalid}
				className={`${inputStyles} flex w-full items-center justify-between gap-2`}
			>
				<span className={selected ? '' : 'text-tertiary'}>{selected?.label ?? 'Select an option'}</span>
				<Ariakit.ComboboxSelectArrow />
			</Ariakit.ComboboxSelect>
			<ComboboxSurface variant="list" heading="Interest" sameWidth>
				{INTEREST_OPTIONS.map((option) => (
					<Ariakit.ComboboxItem key={option.value} value={option.value} className={popoverRowWithBorderStyles}>
						<span>{option.label}</span>
						<Ariakit.ComboboxItemSelected>
							{(isSelected) => (
								<span className={popoverSingleSelectCheckStyles(isSelected)}>
									<Icon name="check" className="size-3" />
								</span>
							)}
						</Ariakit.ComboboxItemSelected>
					</Ariakit.ComboboxItem>
				))}
			</ComboboxSurface>
		</Ariakit.ComboboxProvider>
	)
}

function TokenCombobox({
	inputRef,
	invalid,
	onSelect,
	onManual
}: {
	inputRef: RefObject<HTMLInputElement | null>
	invalid: boolean
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
				ref={inputRef}
				placeholder="Search your token by name or ticker"
				autoSelect
				aria-invalid={invalid}
				className={`w-full ${inputStyles}`}
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
					<div role="status" aria-live="polite" className="flex justify-center px-3 py-6">
						<LoadingIndicator label="Searching" />
					</div>
				) : results.isError ? (
					<p role="alert" className="px-3 py-6 text-center body-sm text-data-down">
						Couldn&apos;t search tokens.
					</p>
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
	const dialogRef = useRef<HTMLDivElement>(null)
	const [interest, setInterest] = useState('')
	const [tokenStatus, setTokenStatus] = useState<TokenStatus>('pre-tge')
	const [projectName, setProjectName] = useState('')
	const [tokenTicker, setTokenTicker] = useState('')
	const [selectedToken, setSelectedToken] = useState<TokenSearchResult | null>(null)
	const [manualToken, setManualToken] = useState(false)
	const [fullName, setFullName] = useState('')
	const [email, setEmail] = useState('')
	const [honeypot, setHoneypot] = useState('')
	const [touched, setTouched] = useState<Record<string, boolean>>({})
	const [submitAttempted, setSubmitAttempted] = useState(false)
	// Each token step replaces the control that was used: focus moves to the one that takes its place.
	const tokenSearchRef = useRef<HTMLInputElement>(null)
	const changeTokenRef = useRef<HTMLButtonElement>(null)
	const projectNameRef = useRef<HTMLInputElement>(null)

	const hasToken = tokenStatus !== 'no-token'
	const listedToken = tokenStatus === 'listed' ? selectedToken : null
	const showManualFields = tokenStatus === 'pre-tge' || (tokenStatus === 'listed' && manualToken)

	const errors: Record<string, string | null> = {
		interest: interest === '' ? 'Select an option' : null,
		token:
			tokenStatus === 'listed' && !selectedToken && !manualToken
				? 'Select your token, or choose “My token does not appear in this list”'
				: null,
		projectName: showManualFields && projectName.trim() === '' ? 'Project name is required' : null,
		tokenTicker: showManualFields && tokenTicker.trim() === '' ? 'Token ticker is required' : null,
		fullName: fullName.trim() === '' ? 'Full name is required' : null,
		email:
			email.trim() === ''
				? 'Email is required'
				: !EMAIL_PATTERN.test(email.trim())
					? 'Enter a valid email address'
					: null
	}
	const isValid = Object.values(errors).every((error) => error == null)
	const showError = (key: string) => (submitAttempted || touched[key] ? errors[key] : null)
	const markTouched = (key: string) => () => setTouched((prev) => ({ ...prev, [key]: true }))

	const dirty =
		interest !== '' ||
		tokenStatus !== 'pre-tge' ||
		projectName !== '' ||
		tokenTicker !== '' ||
		selectedToken !== null ||
		manualToken ||
		fullName !== '' ||
		email !== ''

	const onSubmit = () => {
		if (!isValid) {
			// The errors appear above, away from Submit, so focus moves to the first field that needs fixing.
			flushSync(() => setSubmitAttempted(true))
			dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
			return
		}
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

	const changeTokenStatus = (value: TokenStatus) => {
		setTokenStatus(value)
		setSelectedToken(null)
		setManualToken(false)
	}

	return (
		<Dialog ref={dialogRef} size="md" open={open} onClose={onClose} pending={submit.isPending} portal unmountOnHide>
			{submit.isSuccess ? (
				<LeadSuccess
					title="Request received"
					message={`The Forgd team will review your request and use the contact details you provided to put you in touch with ${marketMakerName}.`}
				/>
			) : (
				<>
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
						<LeadField label="What are you interested in?" error={showError('interest')}>
							<InterestSelect value={interest} invalid={showError('interest') != null} onChange={setInterest} />
						</LeadField>
						<div className="flex flex-col gap-1.5">
							<span className="label-sm text-primary">What is the status of your token?</span>
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
							<div className="flex flex-col gap-1.5">
								<span className="label-sm text-primary">Your token</span>
								{selectedToken ? (
									<div className={`${inputStyles} flex items-center justify-between gap-2`}>
										<span className="flex min-w-0 items-center gap-2">
											<TokenLogo src={selectedToken.logo} size={20} />
											<span className="truncate">{selectedToken.name}</span>
											<span className="shrink-0 text-tertiary">{selectedToken.symbol}</span>
										</span>
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
									</div>
								) : (
									<TokenCombobox
										inputRef={tokenSearchRef}
										invalid={showError('token') != null}
										onSelect={(token) =>
											keepFocus(
												() => setSelectedToken(token),
												() => changeTokenRef.current
											)
										}
										onManual={() =>
											keepFocus(
												() => setManualToken(true),
												() => projectNameRef.current
											)
										}
									/>
								)}
								{showError('token') ? <span className="body-sm text-error">{showError('token')}</span> : null}
							</div>
						) : null}
						{showManualFields ? (
							<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
								<LeadField label="Project name" error={showError('projectName')}>
									<Input
										ref={projectNameRef}
										value={projectName}
										onChange={(e) => setProjectName(e.target.value)}
										onBlur={markTouched('projectName')}
										aria-invalid={showError('projectName') != null}
										maxLength={200}
										placeholder="Project"
									/>
								</LeadField>
								<LeadField label="Token ticker" error={showError('tokenTicker')}>
									<Input
										value={tokenTicker}
										onChange={(e) => setTokenTicker(e.target.value)}
										onBlur={markTouched('tokenTicker')}
										aria-invalid={showError('tokenTicker') != null}
										maxLength={32}
										placeholder="ABC"
									/>
								</LeadField>
							</div>
						) : null}
						{tokenStatus === 'listed' && manualToken ? (
							<div className="body-sm">
								<Button
									variant="link"
									onClick={() =>
										keepFocus(
											() => setManualToken(false),
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
								<LeadField label="Full name" error={showError('fullName')}>
									<Input
										value={fullName}
										onChange={(e) => setFullName(e.target.value)}
										onBlur={markTouched('fullName')}
										aria-invalid={showError('fullName') != null}
										maxLength={200}
										placeholder="Your name"
									/>
								</LeadField>
								<LeadField label="Email" error={showError('email')}>
									<Input
										type="email"
										value={email}
										onChange={(e) => setEmail(e.target.value)}
										onBlur={markTouched('email')}
										aria-invalid={showError('email') != null}
										maxLength={320}
										placeholder="you@project.xyz"
									/>
								</LeadField>
							</div>
						</div>
						<LeadHoneypot value={honeypot} onChange={setHoneypot} />
						{failure ? <InlineStatus variant="error">{failure}</InlineStatus> : null}
					</DialogBody>
					<DialogFooter dismiss={<DialogCancelButton />}>
						<Button
							type="button"
							variant="primary"
							size="md"
							pendingLabel={submit.isPending ? 'Submitting…' : null}
							onClick={onSubmit}
						>
							Submit request
						</Button>
					</DialogFooter>
				</>
			)}
		</Dialog>
	)
}
