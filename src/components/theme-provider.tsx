/* eslint-disable react-refresh/only-export-components */
import * as React from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
}

const ThemeProviderContext = React.createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "blind-peering-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<Theme>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem(storageKey) as Theme) || defaultTheme
    }
    return defaultTheme
  })

  React.useEffect(() => {
    const root = window.document.documentElement
    const metaThemeColor = document.querySelector("meta[name='theme-color']")

    const updateTheme = () => {
      root.classList.remove("light", "dark")

      let appliedTheme: "dark" | "light" = "light"

      if (theme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
        root.classList.add(systemTheme)
        appliedTheme = systemTheme
      } else {
        root.classList.add(theme)
        appliedTheme = theme
      }

      // Update theme-color meta tag for mobile browsers and PWAs
      const themeColor = appliedTheme === "dark" ? "#252525" : "#ffffff"
      if (metaThemeColor) {
        metaThemeColor.setAttribute("content", themeColor)
      }

      // Update apple-mobile-web-app-status-bar-style for iOS
      const appleStatusBar = document.querySelector("meta[name='apple-mobile-web-app-status-bar-style']")
      if (appleStatusBar) {
        appleStatusBar.setAttribute("content", appliedTheme === "dark" ? "black-translucent" : "default")
      }
    }

    updateTheme()

    // Listen for system theme changes when theme is set to "system"
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      mediaQuery.addEventListener("change", updateTheme)
      return () => mediaQuery.removeEventListener("change", updateTheme)
    }
  }, [theme])

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = React.useContext(ThemeProviderContext)

  if (context === undefined) throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
