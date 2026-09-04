'use client'

import { useEffect, useRef, useState } from 'react'

// A Server Action's state goes back to its initial value (usually
// `undefined`) on success, same as before it ever ran — so there's no way
// to tell "just succeeded" from "never submitted" from the state alone.
// This tracks the pending->settled transition to show a brief confirmation.
export function useActionSuccess(pending: boolean, hasError: boolean, durationMs = 2000) {
  const [show, setShow] = useState(false)
  const wasPending = useRef(false)

  useEffect(() => {
    if (wasPending.current && !pending && !hasError) {
      setShow(true)
      const timeout = setTimeout(() => setShow(false), durationMs)
      wasPending.current = pending
      return () => clearTimeout(timeout)
    }
    wasPending.current = pending
  }, [pending, hasError, durationMs])

  return show
}
