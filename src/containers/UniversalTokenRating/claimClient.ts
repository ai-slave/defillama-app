import type { UtrClaimDocument, UtrClaimPayload } from './claimRequest'

async function responseError(response: Response, fallback: string): Promise<Error> {
	if (response.status === 429) return new Error('Too many requests. Try again in a few minutes.')
	// A 4xx names what the claim service refused; a 5xx body is not written for readers.
	if (response.status >= 500) return new Error(fallback)
	const body = await response.json().catch(() => null)
	const message =
		body && typeof body === 'object'
			? typeof body.error === 'string'
				? body.error
				: typeof body.message === 'string'
					? body.message
					: null
			: null
	return new Error(message ?? fallback)
}

function isDocumentReceipt(value: unknown): value is UtrClaimDocument {
	if (!value || typeof value !== 'object') return false
	const receipt = value as Record<string, unknown>
	return (
		typeof receipt.key === 'string' &&
		Boolean(receipt.key) &&
		typeof receipt.fileName === 'string' &&
		Boolean(receipt.fileName) &&
		typeof receipt.mimeType === 'string' &&
		Boolean(receipt.mimeType) &&
		typeof receipt.sizeBytes === 'number' &&
		Number.isFinite(receipt.sizeBytes) &&
		receipt.sizeBytes >= 0 &&
		typeof receipt.signature === 'string' &&
		Boolean(receipt.signature)
	)
}

export async function uploadUtrClaimDocuments(files: ReadonlyArray<File>): Promise<Array<UtrClaimDocument>> {
	const body = new FormData()
	for (const file of files) body.append('file', file)
	const response = await fetch('/api/public/utr/claim/documents', { method: 'POST', body }).catch(() => {
		throw new Error("Couldn't upload supporting documents.")
	})
	if (!response.ok) throw await responseError(response, "Couldn't upload supporting documents.")
	const receipts = await response.json()
	if (!Array.isArray(receipts) || receipts.length !== files.length || !receipts.every(isDocumentReceipt)) {
		throw new Error("Couldn't upload supporting documents.")
	}
	return receipts
}

export async function submitUtrClaim(payload: UtrClaimPayload): Promise<{ id: string }> {
	const response = await fetch('/api/public/utr/claim', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	}).catch(() => {
		throw new Error("Couldn't submit the claim request.")
	})
	if (!response.ok) throw await responseError(response, "Couldn't submit the claim request.")
	const result = await response.json()
	if (!result || typeof result.id !== 'string') throw new Error("Couldn't submit the claim request.")
	return result
}
