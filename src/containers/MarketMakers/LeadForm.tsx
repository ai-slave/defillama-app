import * as Ariakit from '@ariakit/react'
import type { ReactNode } from 'react'
import { Button } from '~/ui/Button'
import { DialogBody, DialogFooter, DialogHeader } from '~/ui/Dialog'

export function LeadField({ label, error, children }: { label: string; error?: string | null; children: ReactNode }) {
	return (
		<label className="flex flex-col gap-1.5">
			<span className="label-sm text-primary">{label}</span>
			{children}
			{error ? <span className="body-sm text-data-down">{error}</span> : null}
		</label>
	)
}

/** The outcome step: the header names the outcome, one plain sentence says what happens next, and Done closes. */
export function LeadSuccess({ title, message }: { title: string; message: string }) {
	return (
		<>
			<DialogHeader title={title} />
			<DialogBody>
				<Ariakit.DialogDescription className="body-sm text-secondary">{message}</Ariakit.DialogDescription>
			</DialogBody>
			<DialogFooter>
				{/* The submit button that had focus is gone, so focus moves to the only action. */}
				<Ariakit.DialogDismiss autoFocus render={<Button type="button" variant="primary" size="md" />}>
					Done
				</Ariakit.DialogDismiss>
			</DialogFooter>
		</>
	)
}

export function LeadHoneypot({ value, onChange }: { value: string; onChange: (value: string) => void }) {
	return (
		<input
			type="text"
			name="hp"
			value={value}
			onChange={(e) => onChange(e.target.value)}
			tabIndex={-1}
			autoComplete="off"
			aria-hidden
			className="absolute -left-[9999px] h-0 w-0 opacity-0"
		/>
	)
}
