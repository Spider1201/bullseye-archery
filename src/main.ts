import './style.css'
import { ArcheryGame, type RoundSummary } from './game'
import { askStartNg, getDisplayName, getPlayerAccount, getPlayerFromReply, getStartNgSigninUrl } from './startng'
import { normalizeStyle, type PlayerStyle } from './character'

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('Missing app root')

app.innerHTML = `
  <div class="game-shell">
    <header class="hud-bar">
      <div class="player-panel" id="player-panel">
        <div class="avatar-badge" id="avatar-badge">G</div>
        <div>
          <div class="player-name" id="player-name">Guest</div>
          <div class="player-account" id="player-account">Guest</div>
        </div>
      </div>

      <div class="stats-strip">
        <div class="stat-pill">
          <span>Score</span>
          <strong id="score-value">0</strong>
        </div>
        <div class="stat-pill">
          <span>Arrows</span>
          <strong id="arrows-value">6</strong>
        </div>
        <div class="stat-pill">
          <span>Round</span>
          <strong id="round-value">1</strong>
        </div>
      </div>

      <div class="action-group">
        <button id="mute-button" class="hud-button" type="button">🔊 Sound</button>
        <button id="leaderboard-button" class="hud-button" type="button">Leaderboard</button>
        <button id="sign-in-button" class="hud-button primary" type="button">Sign in with Start.ng</button>
      </div>
    </header>

    <div id="game-root" aria-label="Archery game canvas"></div>

    <div id="crosshair" aria-hidden="true">
      <span></span>
      <span></span>
    </div>

    <div class="shoot-panel">
      <button id="shoot-button" class="shoot-button" type="button">Shoot</button>
    </div>

    <div id="toast" class="toast" aria-live="polite"></div>

    <section id="round-panel" class="modal hidden" aria-live="assertive">
      <div class="modal-card">
        <p class="eyebrow">Round complete</p>
        <h2>Archery results</h2>
        <div class="result-grid">
          <div>
            <span>Total score</span>
            <strong id="result-score">0</strong>
          </div>
          <div>
            <span>Bullseyes</span>
            <strong id="result-bulls">0</strong>
          </div>
          <div>
            <span>Accuracy</span>
            <strong id="result-accuracy">0%</strong>
          </div>
          <div>
            <span>Best</span>
            <strong id="result-rank">—</strong>
          </div>
        </div>
        <p id="result-message" class="message"></p>
        <div class="button-row">
          <button id="play-again-button" class="primary" type="button">Play Again</button>
          <button id="return-to-game-button" type="button">Back to range</button>
        </div>
      </div>
    </section>

    <section id="leaderboard-panel" class="modal hidden" aria-live="polite">
      <div class="modal-card leader-card">
        <div class="leader-header">
          <div>
            <p class="eyebrow">Start.ng leaderboard</p>
            <h2>Top archers</h2>
          </div>
          <button id="close-leaderboard-button" class="icon-button" type="button">×</button>
        </div>
        <ol id="leaderboard-list" class="leaderboard-list"></ol>
        <div class="button-row compact">
          <button id="leaderboard-return-button" class="primary" type="button">Return to game</button>
        </div>
      </div>
    </section>
  </div>
`

const scoreValue = document.querySelector('#score-value') as HTMLElement
const arrowsValue = document.querySelector('#arrows-value') as HTMLElement
const roundValue = document.querySelector('#round-value') as HTMLElement
const playerName = document.querySelector('#player-name') as HTMLElement
const playerAccount = document.querySelector('#player-account') as HTMLElement
const avatarBadge = document.querySelector('#avatar-badge') as HTMLElement
const shootButton = document.querySelector('#shoot-button') as HTMLButtonElement
const muteButton = document.querySelector('#mute-button') as HTMLButtonElement
const signInButton = document.querySelector('#sign-in-button') as HTMLButtonElement
const leaderboardButton = document.querySelector('#leaderboard-button') as HTMLButtonElement
const resultScore = document.querySelector('#result-score') as HTMLElement
const resultBulls = document.querySelector('#result-bulls') as HTMLElement
const resultAccuracy = document.querySelector('#result-accuracy') as HTMLElement
const resultRank = document.querySelector('#result-rank') as HTMLElement
const resultMessage = document.querySelector('#result-message') as HTMLElement
const roundPanel = document.querySelector('#round-panel') as HTMLElement
const leaderboardPanel = document.querySelector('#leaderboard-panel') as HTMLElement
const leaderboardList = document.querySelector('#leaderboard-list') as HTMLOListElement
const playAgainButton = document.querySelector('#play-again-button') as HTMLButtonElement
const returnToGameButton = document.querySelector('#return-to-game-button') as HTMLButtonElement
const closeLeaderboardButton = document.querySelector('#close-leaderboard-button') as HTMLButtonElement
const leaderboardReturnButton = document.querySelector('#leaderboard-return-button') as HTMLButtonElement

let currentPlayer: any = null
let currentStyle: Partial<PlayerStyle> = {}
let muted = false

const game = new ArcheryGame(document.querySelector('#game-root') as HTMLElement, {
  shootButton,
  onRoundEnd: async (summary) => {
    resultScore.textContent = summary.score.toString()
    resultBulls.textContent = summary.bulls.toString()
    resultAccuracy.textContent = `${summary.accuracy}%`
    resultRank.textContent = summary.rank ? `#${summary.rank}` : '—'

    const player = currentPlayer
    if (player) {
      try {
        const saved = await saveRunToStartNg(summary)
        if (saved) {
          resultRank.textContent = saved.rank ? `#${saved.rank}` : '—'
          resultMessage.textContent = saved.improved ? `New personal best! Rank #${saved.rank}.` : `Saved. Position #${saved.rank}.`
        } else {
          resultMessage.textContent = 'Guest mode active. Sign in to save your best score.'
        }
      } catch (error) {
        resultMessage.textContent = error instanceof Error ? error.message : 'Unable to save the score right now.'
      }
    } else {
      resultMessage.textContent = 'Guests can play for free, but they must sign in to save a leaderboard score.'
      resultRank.textContent = 'Guest'
    }

    roundPanel.classList.remove('hidden')
    populateLeaderboard()
  },
  onScoreUpdate: ({ score, arrowsLeft, bulls, shots, round }) => {
    scoreValue.textContent = score.toString()
    arrowsValue.textContent = arrowsLeft.toString()
    roundValue.textContent = round.toString()
    if (score > 0) {
      resultBulls.textContent = bulls.toString()
    }
    if (shots > 0) {
      resultAccuracy.textContent = `${Math.round((bulls / shots) * 100)}%`
    }
  },
})

function showToast(message: string) {
  const toast = document.querySelector('#toast') as HTMLElement
  toast.textContent = message
  toast.classList.add('visible')
  window.clearTimeout((showToast as any)._timer)
  ;(showToast as any)._timer = window.setTimeout(() => {
    toast.classList.remove('visible')
  }, 2200)
}

function updatePlayerDisplay(player: any) {
  currentPlayer = player
  const label = getDisplayName(player, 'Guest')
  playerName.textContent = label
  playerAccount.textContent = getPlayerAccount(player)
  avatarBadge.textContent = label.charAt(0).toUpperCase() || 'G'
  signInButton.hidden = !!player
  signInButton.textContent = player ? 'Signed in' : 'Sign in with Start.ng'
  if (player?.style) {
    currentStyle = normalizeStyle(player.style)
    game.setPlayerStyle(currentStyle)
  } else {
    currentStyle = normalizeStyle({
      body: 'female',
      primaryColor: '#7dd3fc',
      secondaryColor: '#1f2937',
      skinColor: '#d4a373',
      hairColor: '#331f15',
      hair: 'short',
      hat: 'none',
      accessory: 'none',
    })
    game.setPlayerStyle(currentStyle)
  }
}

async function refreshPlayerInfo() {
  try {
    const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user')
    const player = getPlayerFromReply(reply)
    updatePlayerDisplay(player)
    return player
  } catch (error) {
    updatePlayerDisplay(null)
    showToast('Start.ng is unavailable, so you are playing as a guest.')
    return null
  }
}

async function populateLeaderboard() {
  try {
    const reply = await askStartNg({ type: 'startng:leaderboard', limit: 5 }, 'startng:leaderboardData')
    const entries = reply?.entries ?? []
    renderLeaderboard(entries)
  } catch (error) {
    renderLeaderboard([])
  }
}

function renderLeaderboard(entries: any[]) {
  if (!entries.length) {
    leaderboardList.innerHTML = '<li class="empty">No scores yet. Sign in and make the first run.</li>'
    return
  }

  leaderboardList.innerHTML = entries
    .map((entry) => {
      const isCurrent = currentPlayer && entry.player_id === currentPlayer.id
      return `<li class="leader-row ${isCurrent ? 'current' : ''}"><span>#${entry.rank}</span><div><strong>${entry.name}</strong><small>${entry.stats?.score ?? entry.score}</small></div><b>${entry.stats?.score ?? entry.score}</b></li>`
    })
    .join('')
}

async function saveRunToStartNg(summary: RoundSummary): Promise<{ rank?: number; improved?: boolean } | null> {
  const player = currentPlayer
  if (!player) {
    return null
  }

  try {
    const stats = {
      score: Math.round(summary.score),
      bullseyes: Math.round(summary.bulls),
      accuracy: Math.round(summary.accuracy),
    }
    const reply = await askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved')
    const result = reply?.result ?? reply
    if (result?.ok === false) {
      showToast(result.error || 'Unable to save your score.')
      return null
    }
    const saved = { improved: Boolean(result?.improved), rank: Number(result?.rank ?? result?.best ?? 0) || undefined }
    showToast(saved.improved ? `New best! Rank #${saved.rank}.` : `Saved. Rank #${saved.rank || '—'}.`)
    return saved
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Score could not be saved.')
    return null
  }
}

function closeAllPanels() {
  roundPanel.classList.add('hidden')
  leaderboardPanel.classList.add('hidden')
}

function beginRound() {
  closeAllPanels()
  game.resetRound(true)
}

signInButton.addEventListener('click', () => {
  window.location.href = getStartNgSigninUrl()
})

muteButton.addEventListener('click', () => {
  muted = !muted
  muteButton.textContent = muted ? '🔇 Muted' : '🔊 Sound'
  showToast(muted ? 'Sound muted' : 'Sound on')
})

playAgainButton.addEventListener('click', beginRound)
returnToGameButton.addEventListener('click', closeAllPanels)
leaderboardButton.addEventListener('click', () => {
  populateLeaderboard()
  leaderboardPanel.classList.remove('hidden')
})
closeLeaderboardButton.addEventListener('click', () => leaderboardPanel.classList.add('hidden'))
leaderboardReturnButton.addEventListener('click', () => leaderboardPanel.classList.add('hidden'))

window.addEventListener('focus', () => {
  void refreshPlayerInfo()
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    void refreshPlayerInfo()
  }
})

void refreshPlayerInfo()
void populateLeaderboard()

window.addEventListener('pointerdown', (event) => {
  if (event.target instanceof HTMLElement && event.target.closest('#shoot-button')) return
  if (event.target instanceof HTMLElement && event.target.closest('.modal')) return
})
