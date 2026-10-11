/** Escape text before interpolating it into HTML (tooltip content, copied or exported HTML), in element text or a
    quoted attribute. The one HTML escape in the app; XML output keeps its own (`escapeXml`). */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
}
