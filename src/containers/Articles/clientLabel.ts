import type { ArticleClient } from './types'

export function articleClientLabel(client: ArticleClient): string {
	if (client.relation === 'sponsored') return `Sponsored by ${client.displayName}`
	if (client.relation === 'collaboration') return `In collaboration with ${client.displayName}`
	return client.displayName
}

export function researchClientHref(clientId: string): string {
	return `/research?client=${encodeURIComponent(clientId)}`
}
