import { useEffect, useRef } from 'react'

let openOverlaysCount = 0
let previousBodyOverflow = ''

interface UseOverlayOptions {
  open: boolean
  onClose?: () => void
  closeOnEscape?: boolean
  containerRef: React.RefObject<HTMLElement | null>
}

export const useOverlay = ({
  open,
  onClose,
  closeOnEscape = true,
  containerRef,
}: UseOverlayOptions) => {
  const previousActiveElementRef = useRef<HTMLElement | null>(null)

  // 1. Manage Body Scroll Lock
  useEffect(() => {
    if (!open || typeof document === 'undefined') return

    if (openOverlaysCount === 0) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    openOverlaysCount += 1

    return () => {
      openOverlaysCount -= 1
      if (openOverlaysCount <= 0) {
        openOverlaysCount = 0
        document.body.style.overflow = previousBodyOverflow || ''
      }
    }
  }, [open])

  // 2. Focus Trap & Return Focus
  useEffect(() => {
    if (!open || typeof document === 'undefined') return

    previousActiveElementRef.current = document.activeElement as HTMLElement

    const container = containerRef.current
    if (!container) return

    const getFocusableElements = (): HTMLElement[] => {
      const selector =
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
        (el) => el.offsetParent !== null && !el.getAttribute('aria-hidden')
      )
    }

    // Set initial focus
    const focusable = getFocusableElements()
    const timer = setTimeout(() => {
      if (focusable.length > 0) {
        focusable[0].focus()
      } else {
        container.focus()
      }
    }, 50)

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape handler
      if (closeOnEscape && e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose?.()
        return
      }

      // Focus trap handler
      if (e.key === 'Tab') {
        const elements = getFocusableElements()
        if (elements.length === 0) {
          e.preventDefault()
          return
        }

        const firstElement = elements[0]
        const lastElement = elements[elements.length - 1]

        if (e.shiftKey) {
          if (document.activeElement === firstElement || document.activeElement === container) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('keydown', handleKeyDown)
      // Return focus to previous active element
      if (previousActiveElementRef.current && typeof previousActiveElementRef.current.focus === 'function') {
        previousActiveElementRef.current.focus()
      }
    }
  }, [open, closeOnEscape, onClose, containerRef])
}
