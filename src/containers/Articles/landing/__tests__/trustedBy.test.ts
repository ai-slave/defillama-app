import { describe, expect, test } from 'vitest'
import type { SocialMention } from '~/containers/Articles/types'
import { chunkMentions } from '../utils'

const mention = (id: string): SocialMention => ({
	id,
	quote: `q-${id}`,
	username: `u-${id}`,
	socialMediaName: 'X',
	socialMediaLink: 'https://x.com/x',
	xPostId: '1',
	sortOrder: 0,
	enabled: true,
	createdAt: '',
	updatedAt: ''
})

describe('chunkMentions', () => {
	test('groups mentions into blocks of three, keeping a partial final block', () => {
		const mentions = [1, 2, 3, 4, 5, 6, 7].map((n) => mention(String(n)))
		expect(chunkMentions(mentions).map((block) => block.map((item) => item.id))).toEqual([
			['1', '2', '3'],
			['4', '5', '6'],
			['7']
		])
	})
})
