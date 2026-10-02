import { AI_SERVER } from '~/constants'
import { fetchWithPoolingOnServer } from '~/utils/http-client'

export interface DailyBriefBullet {
	text: string
	question: string
}

export interface DailyBrief {
	date: string
	headline: string
	summary: string
	sections: Array<{ id: string; title: string; bullets: Array<DailyBriefBullet> }>
	generatedAt: string
}

/** The homepage brief, or null when there is none to show: the card renders only for a brief with sections. */
export async function fetchDailyBrief(): Promise<DailyBrief | null> {
	try {
		const res = await fetchWithPoolingOnServer(`${AI_SERVER}/daily-brief`, { timeout: 5000 })
		if (!res.ok) return null
		const brief = await res.json()
		// The page build must not fail on the AI server, so a malformed brief is dropped like a missing one.
		return Array.isArray(brief?.sections) && brief.sections.length > 0 ? brief : null
	} catch {
		return null
	}
}
