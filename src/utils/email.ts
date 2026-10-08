// A deliverable-looking address: something@domain.tld. The server checks the same pattern.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** An email field's error (ui/Field.tsx), or null when the address looks deliverable. */
export function emailError(email: string): string | null {
	const trimmed = email.trim()
	if (!trimmed) return 'Enter an email address.'
	return EMAIL_PATTERN.test(trimmed) ? null : 'Enter a valid email address.'
}
