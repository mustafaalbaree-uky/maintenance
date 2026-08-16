// Holds the page at 1x on iOS.
//
// Safari has ignored `user-scalable=no` and `maximum-scale` in the viewport tag since
// iOS 10, so the meta tag alone does nothing there. What Safari does still honour is
// preventDefault on its own non standard gesture events, and on a second touch point in
// a touchmove. Both need `passive: false`, or the browser ignores the preventDefault.
//
// This does not touch the system wide accessibility zoom, which is the one that matters
// for someone who genuinely cannot read the screen.

export function lockZoom(): void {
  if (typeof document === 'undefined') return

  const stop = (e: Event) => e.preventDefault()

  // Safari only. Pinching fires these rather than a wheel event.
  document.addEventListener('gesturestart', stop, { passive: false })
  document.addEventListener('gesturechange', stop, { passive: false })
  document.addEventListener('gestureend', stop, { passive: false })

  // A second finger on the glass is a pinch in progress.
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault()
    },
    { passive: false },
  )

  // Double tap to zoom, for the corners `touch-action: manipulation` does not cover.
  let lastTouchEnd = 0
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) e.preventDefault()
      lastTouchEnd = now
    },
    { passive: false },
  )

  // Desktop browsers zoom on ctrl or cmd plus wheel.
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault()
    },
    { passive: false },
  )
}
