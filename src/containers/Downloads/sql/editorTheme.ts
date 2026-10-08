/**
 * The Monaco themes for the SQL editor and notebook cells. Monaco cannot read `var()` and registers both themes up
 * front, so each colour is a copy of its token per mode; the contrast policy (rule 5) fails when a copy drifts.
 */

export const LIGHT_THEME_ID = 'llama-sql-light'
export const DARK_THEME_ID = 'llama-sql-dark'

const SQL_COLORS = {
	text: { light: ['--text-primary', '#090b0c'], dark: ['--text-primary', '#ffffff'] },
	secondary: { light: ['--text-secondary', '#484848'], dark: ['--text-secondary', '#c6c6c6'] },
	tertiary: { light: ['--text-tertiary', '#5e5e5e'], dark: ['--text-tertiary', '#989b9c'] },
	keyword: { light: ['--blue-11', '#145abe'], dark: ['--blue-11', '#599aff'] },
	predefined: { light: ['--violet-11', '#6f41c2'], dark: ['--violet-11', '#a884ff'] },
	number: { light: ['--emerald-9', '#007b45'], dark: ['--emerald-12', '#abf0c2'] },
	string: { light: ['--amber-9', '#9f5a00'], dark: ['--amber-12', '#ffdaba'] },
	surface: { light: ['--bg-surface', '#ffffff'], dark: ['--bg-surface', '#131516'] },
	overlay: { light: ['--bg-overlay', '#ffffff'], dark: ['--bg-overlay', '#181a1b'] },
	lineNumber: { light: ['--neutral-7', '#b3b3b3'], dark: ['--neutral-7', '#414345'] },
	brand: { light: ['--bg-brand', '#1f67d2'], dark: ['--bg-brand', '#1f67d2'] },
	brandMuted: { light: ['--bg-brand-muted', '#d0def3'], dark: ['--bg-brand-muted', '#1c2636'] },
	selection: { light: ['--blue-4', '#d0def3'], dark: ['--blue-7', '#28436e'] },
	inactiveSelection: { light: ['--blue-3', '#dde7f6'], dark: ['--blue-5', '#212f44'] },
	borderSubtle: { light: ['--border-subtle', '#090b0c0f'], dark: ['--border-subtle', '#ffffff0f'] },
	borderMedium: { light: ['--border-medium', '#090b0c1f'], dark: ['--border-medium', '#ffffff1f'] }
} as const

// The active line is the brand fill at a low alpha: 5% on white, 14% on the dark card.
const ACTIVE_LINE_ALPHA = { light: '0d', dark: '24' } as const

function sqlTheme(mode: 'light' | 'dark') {
	const color = (role: keyof typeof SQL_COLORS) => SQL_COLORS[role][mode][1]
	const token = (role: keyof typeof SQL_COLORS) => color(role).slice(1)
	return {
		base: mode === 'light' ? 'vs' : 'vs-dark',
		inherit: true,
		rules: [
			{ token: '', foreground: token('text') },
			{ token: 'keyword', foreground: token('keyword'), fontStyle: 'bold' },
			{ token: 'keyword.sql', foreground: token('keyword'), fontStyle: 'bold' },
			{ token: 'operator.sql', foreground: token('keyword') },
			{ token: 'predefined.sql', foreground: token('predefined') },
			{ token: 'identifier', foreground: token('text') },
			{ token: 'number', foreground: token('number') },
			{ token: 'number.sql', foreground: token('number') },
			{ token: 'string', foreground: token('string') },
			{ token: 'string.sql', foreground: token('string') },
			{ token: 'comment', foreground: token('tertiary'), fontStyle: 'italic' },
			{ token: 'delimiter', foreground: token('secondary') }
		],
		colors: {
			'editor.background': color('surface'),
			'editor.foreground': color('text'),
			'editorLineNumber.foreground': color('lineNumber'),
			'editorLineNumber.activeForeground': color('keyword'),
			'editor.lineHighlightBackground': `${color('brand')}${ACTIVE_LINE_ALPHA[mode]}`,
			'editor.lineHighlightBorder': '#00000000',
			'editorCursor.foreground': color('keyword'),
			'editorIndentGuide.background1': color('borderSubtle'),
			'editor.selectionBackground': color('selection'),
			'editor.inactiveSelectionBackground': color('inactiveSelection'),
			'editorGutter.background': color('surface'),
			'editorWidget.background': color('overlay'),
			'editorWidget.border': color('borderMedium'),
			'editorSuggestWidget.background': color('overlay'),
			'editorSuggestWidget.border': color('borderMedium'),
			'editorSuggestWidget.selectedBackground': color('brandMuted'),
			'editorSuggestWidget.selectedForeground': color('text'),
			'editorSuggestWidget.focusHighlightForeground': color('keyword')
		}
	}
}

export function defineSqlEditorThemes(monaco: any) {
	monaco.editor.defineTheme(LIGHT_THEME_ID, sqlTheme('light'))
	monaco.editor.defineTheme(DARK_THEME_ID, sqlTheme('dark'))
}
