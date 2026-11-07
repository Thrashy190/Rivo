import type { Preview, Decorator } from '@storybook/react-vite'
import { useEffect, type ReactNode } from 'react'
import '../src/index.css'
import { SnackbarProvider } from '../src/context/SnackbarContext'
import { AuthProvider } from '../src/context/AuthContext'

function ThemeRoot({ theme, children }: { theme: string; children: ReactNode }) {
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
  }, [theme])

  return children
}

const withTheme: Decorator = (Story, context) => (
  <ThemeRoot theme={(context.globals.theme as string) ?? 'dark'}>
    <Story />
  </ThemeRoot>
)

// Components read the session and push notifications. Signed out, the auth
// provider makes no API calls.
const withProviders: Decorator = (Story) => (
  <SnackbarProvider>
    <AuthProvider>
      <Story />
    </AuthProvider>
  </SnackbarProvider>
)

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'circlehollow',
        items: [
          { value: 'dark', icon: 'moon', title: 'Dark' },
          { value: 'light', icon: 'sun', title: 'Light' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: 'dark',
  },
  decorators: [withTheme, withProviders],
  parameters: {
    backgrounds: { disable: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },
}

export default preview
