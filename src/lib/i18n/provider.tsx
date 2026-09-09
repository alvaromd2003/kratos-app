'use client'

import { createContext, useContext } from 'react'
import { interpolate, type Locale } from './config'

type Dict = Record<string, string>
type Vars = Record<string, string | number>

const LocaleContext = createContext<{ locale: Locale; t: (key: string, vars?: Vars) => string }>({
  locale: 'es',
  t: (key) => key,
})

// dict already holds only the one active locale's strings (chosen
// server-side before render) — t() is a plain lookup plus {placeholder}
// substitution, no client-side locale-switching logic needed since
// changing language re-sets a cookie and reloads the page.
export function LocaleProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale
  dict: Dict
  children: React.ReactNode
}) {
  function t(key: string, vars?: Vars): string {
    return interpolate(dict[key] ?? key, vars)
  }
  return <LocaleContext.Provider value={{ locale, t }}>{children}</LocaleContext.Provider>
}

export function useLocale() {
  return useContext(LocaleContext)
}
