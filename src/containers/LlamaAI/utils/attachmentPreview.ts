export const ATTACHMENT_PREVIEW_BYTES = 64 * 1024

export interface AttachmentPreview {
	content: string
	filename: string
	isPasted?: boolean
	truncated?: boolean
	original?: Blob | string
}

export async function readFilePreview(file: File): Promise<AttachmentPreview> {
	const truncated = file.size > ATTACHMENT_PREVIEW_BYTES
	const bytes = await file.slice(0, ATTACHMENT_PREVIEW_BYTES).arrayBuffer()
	return {
		content: new TextDecoder().decode(bytes, { stream: truncated }),
		filename: file.name,
		truncated,
		original: file
	}
}

export async function readUrlPreview(url: string, filename: string): Promise<AttachmentPreview> {
	const response = await fetch(url)
	if (!response.ok || !response.body) throw new Error("Couldn't load the attachment.")
	const reader = response.body.getReader()
	// Read one extra byte to distinguish an exact-size file from a truncated preview, then stop
	// the download. The original URL remains available for downloading the complete file.
	const bytes = new Uint8Array(ATTACHMENT_PREVIEW_BYTES + 1)
	let length = 0
	try {
		while (length < bytes.length) {
			const { done, value } = await reader.read()
			if (done) break
			const part = value.subarray(0, bytes.length - length)
			bytes.set(part, length)
			length += part.length
		}
	} finally {
		await reader.cancel()
	}
	const truncated = length > ATTACHMENT_PREVIEW_BYTES
	return {
		content: new TextDecoder().decode(bytes.subarray(0, Math.min(length, ATTACHMENT_PREVIEW_BYTES)), {
			stream: truncated
		}),
		filename,
		truncated,
		original: url
	}
}
