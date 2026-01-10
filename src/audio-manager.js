// Audio Manager for continuous background music playback
// Ambient classical piano - Satie, Debussy, Chopin, Ravel, etc.

const TRACKS = [
  'bach-goldberg-aria-da-capo.mp3',
  'bach-goldberg-aria.mp3',
  'bach-goldberg-var12.mp3',
  'bach-goldberg-var13.mp3',
  'bach-goldberg-var15.mp3',
  'bach-goldberg-var21.mp3',
  'bach-goldberg-var25.mp3',
  'brahms-intermezzo-a-major.mp3',
  'brahms-romanze-f-major.mp3',
  'debussy-clair-de-lune.mp3',
  'debussy-des-pas-sur-la-neige.mp3',
  'debussy-la-fille-aux-cheveux.mp3',
  'debussy-reflets-dans-leau.mp3',
  'grieg-cradle-song.mp3',
  'grieg-melodie-op38.mp3',
  'grieg-melodie-op47.mp3',
  'grieg-notturno.mp3',
  'satie-gnossienne-1-deleeuw.mp3',
  'satie-gnossienne-1.mp3',
  'satie-gnossienne-2.mp3',
  'satie-gnossienne-3-deleeuw.mp3',
  'satie-gnossienne-3.mp3',
  'satie-gnossienne-4.mp3',
  'satie-gnossienne-5.mp3',
  'satie-gnossienne-6.mp3',
  'satie-gymnopedie-1-deleeuw.mp3',
  'satie-gymnopedie-1.mp3',
  'satie-gymnopedie-2.mp3',
  'satie-gymnopedie-3-deleeuw.mp3',
  'satie-gymnopedie-3.mp3',
  'satie-petite-ouverture.mp3',
  'schumann-traumerei.mp3'
]

const STORAGE_KEY = 'timmons_audio_state'

class AudioManager {
  constructor() {
    this.audio = new Audio()
    this.audio.volume = 0.12
    this.shuffledTracks = []
    this.currentIndex = 0
    this.isPlaying = false
    this.hasUserInteracted = false
    this.displayElement = null

    this.init()
  }

  init() {
    this.restoreState()
    this.createDisplay()
    this.setupKeyboardShortcuts()

    this.audio.addEventListener('ended', () => this.playNext())
    this.audio.addEventListener('error', (e) => {
      console.warn('Audio error, skipping track:', e)
      this.playNext()
    })
    this.audio.addEventListener('play', () => this.updateDisplay())

    window.addEventListener('beforeunload', () => this.saveState())
    setInterval(() => this.saveState(), 1000)

    const startOnInteraction = () => {
      if (!this.hasUserInteracted) {
        this.hasUserInteracted = true
        this.play()
        document.removeEventListener('click', startOnInteraction)
        document.removeEventListener('touchstart', startOnInteraction)
        document.removeEventListener('keydown', startOnInteraction)
      }
    }

    document.addEventListener('click', startOnInteraction)
    document.addEventListener('touchstart', startOnInteraction)
    document.addEventListener('keydown', startOnInteraction)

    if (this.isPlaying) {
      this.audio.src = `/audio/${this.shuffledTracks[this.currentIndex]}`
      this.audio.play().catch(() => {})
    }

    this.updateDisplay()
  }

  createDisplay() {
    const display = document.createElement('div')
    display.id = 'now-playing'
    display.innerHTML = `
      <div class="now-playing-label">Photography Salon Soundtrack</div>
      <div class="now-playing-track"></div>
    `
    document.body.appendChild(display)
    this.displayElement = display

    const style = document.createElement('style')
    style.textContent = `
      #now-playing {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0, 0, 0, 0.7);
        color: rgba(255, 255, 255, 0.8);
        padding: 10px 14px;
        border-radius: 6px;
        font-family: 'Roboto Mono', monospace;
        font-size: 11px;
        z-index: 9999;
        max-width: 280px;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      #now-playing .now-playing-label {
        color: rgba(255, 255, 255, 0.4);
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 4px;
      }
      #now-playing .now-playing-track {
        color: rgba(255, 255, 255, 0.9);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `
    document.head.appendChild(style)
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!e.shiftKey) return

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault()
          this.volumeUp()
          break
        case 'ArrowDown':
          e.preventDefault()
          this.volumeDown()
          break
        case 'ArrowRight':
          e.preventDefault()
          this.playNext()
          break
        case 'ArrowLeft':
          e.preventDefault()
          this.playPrevious()
          break
      }
    })
  }

  formatTrackName(filename) {
    if (!filename) return 'Loading...'

    // Remove .mp3 extension
    let name = filename.replace('.mp3', '')

    // Remove performer suffix like "-deleeuw"
    name = name.replace(/-deleeuw$/, '')

    // Split by hyphen and capitalize
    const parts = name.split('-')

    // Capitalize first letter of each part
    const formatted = parts.map(part => {
      // Handle special cases
      if (part === 'var12') return 'Variation 12'
      if (part === 'var13') return 'Variation 13'
      if (part === 'var15') return 'Variation 15'
      if (part === 'var21') return 'Variation 21'
      if (part === 'var25') return 'Variation 25'
      if (part === 'op38') return 'Op. 38'
      if (part === 'op47') return 'Op. 47'

      return part.charAt(0).toUpperCase() + part.slice(1)
    }).join(' - ')

    return formatted
  }

  updateDisplay() {
    if (!this.displayElement) return
    const trackEl = this.displayElement.querySelector('.now-playing-track')
    const currentTrack = this.shuffledTracks[this.currentIndex]
    const formatted = this.formatTrackName(currentTrack)
    trackEl.textContent = formatted
    console.log(`🎵 Now playing: ${formatted}`)
  }

  shuffleTracks() {
    this.shuffledTracks = [...TRACKS]
    for (let i = this.shuffledTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[this.shuffledTracks[i], this.shuffledTracks[j]] =
        [this.shuffledTracks[j], this.shuffledTracks[i]]
    }
  }

  saveState() {
    if (!this.isPlaying) return
    const state = {
      shuffledTracks: this.shuffledTracks,
      currentIndex: this.currentIndex,
      currentTime: this.audio.currentTime,
      isPlaying: this.isPlaying,
      volume: this.audio.volume,
      timestamp: Date.now()
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }

  restoreState() {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        const state = JSON.parse(saved)
        if (Date.now() - state.timestamp < 5000) {
          this.shuffledTracks = state.shuffledTracks
          this.currentIndex = state.currentIndex
          this.isPlaying = state.isPlaying
          if (state.volume !== undefined) {
            this.audio.volume = state.volume
          }
          if (this.isPlaying && this.shuffledTracks[this.currentIndex]) {
            this.audio.src = `/audio/${this.shuffledTracks[this.currentIndex]}`
            this.audio.currentTime = state.currentTime || 0
          }
          return
        }
      } catch (e) {
        console.warn('Failed to restore audio state:', e)
      }
    }
    this.shuffleTracks()
    this.currentIndex = 0
    this.isPlaying = false
  }

  play() {
    if (this.shuffledTracks.length === 0) {
      this.shuffleTracks()
    }
    const track = this.shuffledTracks[this.currentIndex]
    if (!track) {
      this.currentIndex = 0
      this.shuffleTracks()
    }
    const newSrc = `/audio/${this.shuffledTracks[this.currentIndex]}`
    if (this.audio.src !== window.location.origin + newSrc) {
      this.audio.src = newSrc
    }
    this.isPlaying = true
    this.audio.play().catch(err => {
      console.warn('Playback failed:', err)
    })
    this.updateDisplay()
  }

  playNext() {
    this.currentIndex++
    if (this.currentIndex >= this.shuffledTracks.length) {
      this.shuffleTracks()
      this.currentIndex = 0
      console.log('🔄 Playlist complete, reshuffling and looping...')
    }
    if (this.isPlaying) {
      this.audio.src = `/audio/${this.shuffledTracks[this.currentIndex]}`
      this.audio.play().catch(err => {
        console.warn('Playback failed, retrying next track:', err)
        setTimeout(() => this.playNext(), 100)
      })
      this.updateDisplay()
    }
  }

  playPrevious() {
    this.currentIndex--
    if (this.currentIndex < 0) {
      this.currentIndex = this.shuffledTracks.length - 1
    }
    this.audio.src = `/audio/${this.shuffledTracks[this.currentIndex]}`
    this.audio.play().catch(err => {
      console.warn('Playback failed:', err)
    })
    this.updateDisplay()
  }

  volumeUp() {
    this.audio.volume = Math.min(1, this.audio.volume + 0.05)
    console.log(`🔊 Volume: ${Math.round(this.audio.volume * 100)}%`)
  }

  volumeDown() {
    this.audio.volume = Math.max(0, this.audio.volume - 0.05)
    console.log(`🔉 Volume: ${Math.round(this.audio.volume * 100)}%`)
  }

  pause() {
    this.isPlaying = false
    this.audio.pause()
  }

  setVolume(level) {
    this.audio.volume = Math.max(0, Math.min(1, level))
  }
}

const audioManager = new AudioManager()

export { audioManager }
