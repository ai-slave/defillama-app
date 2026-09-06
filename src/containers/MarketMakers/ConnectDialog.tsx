import * as Ariakit from '@ariakit/react'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { TokenLogo } from '~/components/TokenLogo'
import { searchTokens } from '~/containers/TokenSearch/search'
import type { TokenSearchResult } from '~/containers/TokenSearch/types'
import { useDebouncedValue } from '~/hooks/useDebounce'
import { Button } from '~/ui/Button'
import { Icon } from '~/ui/Icon'
import { Input, inputStyles } from '~/ui/Input'
import {
	popoverMobileDismissStyles,
	popoverMobileWrapperClassName,
	popoverRowWithBorderStyles,
	popoverSingleSelectCheckStyles,
	popoverSurfaceStyles
} from '~/ui/Popover'
import { SegmentedControl } from '~/ui/SegmentedControl'
import { requestLeadClickId, useSubmitLead } from './client'
import { LeadCancelButton, LeadDialog, LeadError, LeadField, LeadHoneypot, LeadSuccess } from './LeadDialog'
import { EMAIL_PATTERN } from './leadShared'

const INTEREST_OPTIONS = [
	{ value: 'engage-market-maker', label: 'Engage a Market Maker' },
	{ value: 'treasury-management', label: 'Treasury Management' },
	{ value: 'other', label: 'Other' }
] as const

const TOKEN_STATUS_OPTIONS = [
	{ value: 'pre-tge', label: 'Pre-TGE' },
	{ value: 'listed', label: 'Listed' },
	{ value: 'no-token', label: "I don't have a Token" }
] as const

type TokenStatus = (typeof TOKEN_STATUS_OPTIONS)[number]['value']

function InterestSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
	const selected = INTEREST_OPTIONS.find((option) => option.value === value)
	return (
		<Ariakit.ComboboxProvider selectedValue={value} setSelectedValue={onChange}>
			<Ariakit.ComboboxSelect className={`${inputStyles} flex w-full items-center justify-between gap-2`}>
				<span className={selected ? '' : 'text-tertiary'}>{selected?.label ?? 'Select an option'}</span>
				<Ariakit.ComboboxSelectArrow />
			</Ariakit.ComboboxSelect>
			<Ariakit.ComboboxPopover
				gutter={6}
				sameWidth
				wrapperProps={{ className: popoverMobileWrapperClassName }}
				className={`${popoverSurfaceStyles} z-50`}
				portal
			>
				<Ariakit.PopoverDismiss className={popoverMobileDismissStyles}>
					<Icon name="x" className="size-5" />
				</Ariakit.PopoverDismiss>
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
			</Ariakit.ComboboxPopover>
		</Ariakit.ComboboxProvider>
	)
}

function TokenCombobox({ onSelect, onManual }: { onSelect: (token: TokenSearchResult) => void; onManual: () => void }) {
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
				placeholder="Search your token by name or ticker"
				autoSelect
				className={`w-full ${inputStyles}`}
			/>
			<Ariakit.ComboboxPopover
				gutter={6}
				sameWidth
				className={`${popoverSurfaceStyles} z-50 max-h-[320px] overflow-y-auto`}
				portal
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
					<p className="px-3 py-2 body-sm text-tertiary">Start typing to search tokens</p>
				) : results.isPending ? (
					<p className="px-3 py-2 body-sm text-tertiary">Searching…</p>
				) : tokens.length === 0 ? (
					<p className="px-3 py-2 body-sm text-tertiary">No tokens found</p>
				) : null}
				<Ariakit.ComboboxItem
					setValueOnClick={false}
					hideOnClick
					onClick={onManual}
					className={`${popoverRowWithBorderStyles} text-link`}
				>
					My token does not appear in this list
				</Ariakit.ComboboxItem>
			</Ariakit.ComboboxPopover>
		</Ariakit.ComboboxProvider>
	)
}

export function ConnectDialog({
	open,
	onClose,
	marketMakerId,
	marketMakerName
}: {
	open: boolean
	onClose: () => void
	marketMakerId: string | null
	marketMakerName: string
}) {
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
	const clickIdRef = useRef<string | null>(null)
	const submit = useSubmitLead('connect')
	const resetSubmit = submit.reset

	useEffect(() => {
		if (!open) return
		// Opening the dialog restarts the form. The reset also clears refs (the captcha widget, the pending
		// click id) and starts a request, so it belongs after commit rather than in render.
		resetSubmit()
		// oxlint-disable-next-line react/set-state-in-effect -- see above
		setInterest('')
		setTokenStatus('pre-tge')
		setProjectName('')
		setTokenTicker('')
		setSelectedToken(null)
		setManualToken(false)
		setFullName('')
		setEmail('')
		setHoneypot('')
		setTouched({})
		setSubmitAttempted(false)
		clickIdRef.current = null
		let superseded = false
		requestLeadClickId('connect', marketMakerId).then((clickId) => {
			if (!superseded) clickIdRef.current = clickId
		})
		return () => {
			superseded = true
		}
	}, [open, marketMakerId, resetSubmit])

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

	const onSubmit = () => {
		if (submit.isPending) return
		if (!isValid) {
			setSubmitAttempted(true)
			return
		}
		submit.mutate({
			interest,
			token_status: tokenStatus,
			project_name: hasToken ? (listedToken?.name ?? projectName) : null,
			token_ticker: hasToken ? (listedToken?.symbol ?? tokenTicker) : null,
			coingecko_id: listedToken?.id ?? null,
			full_name: fullName,
			email: email.trim(),
			market_maker_id: marketMakerId,
			market_maker_name: marketMakerName,
			click_id: clickIdRef.current,
			source_url: typeof window === 'undefined' ? null : window.location.href,
			hp: honeypot
		})
	}

	const changeTokenStatus = (value: TokenStatus) => {
		setTokenStatus(value)
		setSelectedToken(null)
		setManualToken(false)
	}

	return (
		<LeadDialog
			open={open}
			onClose={onClose}
			title={`Get in touch with ${marketMakerName}`}
			showHeader={!submit.isSuccess}
			footer={
				submit.isSuccess ? null : (
					<>
						<LeadCancelButton />
						<Button type="button" variant="primary" size="md" disabled={submit.isPending} onClick={onSubmit}>
							{submit.isPending ? 'Submitting…' : 'Submit Request'}
						</Button>
					</>
				)
			}
		>
			{submit.isSuccess ? (
				<LeadSuccess
					title="Request received"
					message={`The Forgd team will review the details of your request, and will reach out via the provided contact information shortly to put you in contact with ${marketMakerName}.`}
					onClose={onClose}
				/>
			) : (
				<>
					<p className="body-sm text-secondary">
						Share your details below, and Forgd will put you in direct contact with them.
					</p>
					<LeadField label="What are you interested in?" error={showError('interest')}>
						<InterestSelect value={interest} onChange={setInterest} />
					</LeadField>
					<div className="flex flex-col gap-1.5">
						<span className="label-md text-primary">What is the status of your token?</span>
						<SegmentedControl
							value={tokenStatus}
							onValueChange={changeTokenStatus}
							options={TOKEN_STATUS_OPTIONS}
							label="Token status"
							variant="default"
							size="md"
							className="w-full!"
							buttonClassName="inline-flex flex-1 items-center justify-center"
						/>
					</div>
					{tokenStatus === 'listed' && !manualToken ? (
						<div className="flex flex-col gap-1.5">
							<span className="label-md text-primary">Your token</span>
							{selectedToken ? (
								<div className={`${inputStyles} flex items-center justify-between gap-2`}>
									<span className="flex min-w-0 items-center gap-2">
										<TokenLogo src={selectedToken.logo} size={20} />
										<span className="truncate">{selectedToken.name}</span>
										<span className="shrink-0 text-tertiary">{selectedToken.symbol}</span>
									</span>
									<button
										type="button"
										onClick={() => setSelectedToken(null)}
										aria-label="Change token"
										className="shrink-0 text-secondary hover:text-primary"
									>
										<Icon name="x" height={14} width={14} />
									</button>
								</div>
							) : (
								<TokenCombobox onSelect={setSelectedToken} onManual={() => setManualToken(true)} />
							)}
							{showError('token') ? <span className="body-sm text-error">{showError('token')}</span> : null}
						</div>
					) : null}
					{showManualFields ? (
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<LeadField label="Project Name" error={showError('projectName')}>
								<Input
									value={projectName}
									onChange={(e) => setProjectName(e.target.value)}
									onBlur={markTouched('projectName')}
									maxLength={200}
									placeholder="Project"
								/>
							</LeadField>
							<LeadField label="Token Ticker" error={showError('tokenTicker')}>
								<Input
									value={tokenTicker}
									onChange={(e) => setTokenTicker(e.target.value)}
									onBlur={markTouched('tokenTicker')}
									maxLength={32}
									placeholder="ABC"
								/>
							</LeadField>
						</div>
					) : null}
					{tokenStatus === 'listed' && manualToken ? (
						<button
							type="button"
							onClick={() => setManualToken(false)}
							className="w-fit body-sm text-link hover:underline"
						>
							Back to token search
						</button>
					) : null}
					<div className="flex flex-col gap-1.5 border-t border-subtle pt-4">
						<span className="label-sm text-tertiary">Contact Information</span>
						<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<LeadField label="Full Name" error={showError('fullName')}>
								<Input
									value={fullName}
									onChange={(e) => setFullName(e.target.value)}
									onBlur={markTouched('fullName')}
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
									maxLength={320}
									placeholder="you@project.xyz"
								/>
							</LeadField>
						</div>
					</div>
					<LeadHoneypot value={honeypot} onChange={setHoneypot} />
					{submit.isError ? (
						<LeadError
							message={submit.error instanceof Error ? submit.error.message : 'Failed to submit the request'}
						/>
					) : null}
				</>
			)}
		</LeadDialog>
	)
}
