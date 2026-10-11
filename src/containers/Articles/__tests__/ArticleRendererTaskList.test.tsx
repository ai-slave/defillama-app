// @vitest-environment happy-dom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, test } from 'vitest'
import { accessibleName } from '~/utils/testing/accessibleName'
import { normalizeLocalArticleDocument } from '../document'
import { ArticleRenderer } from '../renderer/ArticleRenderer'

test('names each task checkbox by its own line, not by the subtasks nested under it', () => {
	const task = (text: string, checked: boolean, subtasks: Array<object> = []) => ({
		type: 'taskItem',
		attrs: { checked },
		content: [
			{ type: 'paragraph', content: [{ type: 'text', text }] },
			...(subtasks.length > 0 ? [{ type: 'taskList', content: subtasks }] : [])
		]
	})
	const normalized = normalizeLocalArticleDocument(
		{
			title: 'Launch checklist',
			status: 'published',
			contentJson: {
				type: 'doc',
				content: [
					{
						type: 'taskList',
						content: [task('Audit the vault', true, [task('Read the oracle', true)]), task('Ship the dashboard', false)]
					}
				]
			}
		},
		null,
		'2026-07-14T00:00:00.000Z'
	)
	expect(normalized.ok).toBe(true)
	if (!normalized.ok) return

	document.body.innerHTML = renderToStaticMarkup(
		<QueryClientProvider client={new QueryClient()}>
			<ArticleRenderer article={normalized.value} />
		</QueryClientProvider>
	)

	const boxes = [...document.querySelectorAll<HTMLInputElement>('input[type=checkbox]')]
	expect(boxes.map((box) => [accessibleName(box), box.checked])).toEqual([
		['Audit the vault', true],
		['Read the oracle', true],
		['Ship the dashboard', false]
	])
})
