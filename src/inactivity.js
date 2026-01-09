const INACTIVITY_TIMEOUT = 10 * 60 * 1000 // 10 minutes in ms
let inactivityTimer = null

export function setupInactivityTimer(onTimeout) {
    function resetTimer() {
        if (inactivityTimer) {
            clearTimeout(inactivityTimer)
        }
        inactivityTimer = setTimeout(onTimeout, INACTIVITY_TIMEOUT)
    }

    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'].forEach(event => {
        document.addEventListener(event, resetTimer, { passive: true })
    })

    resetTimer()
}
