export type StartNgStyle = {
  body?: string
  primaryColor?: string
  secondaryColor?: string
  skinColor?: string
  hairColor?: string
  hair?: string
  hat?: string
  accessory?: string
}

export type StartNgPlayer = {
  id?: number
  name?: string
  account?: string
  style?: StartNgStyle
  face?: string
}

export type StartNgResponse<T> = { type: string; requestId?: string } & T

export const STARTNG_ORIGIN = 'https://start.ng'
const STARTNG_CONNECT_URL = `${STARTNG_ORIGIN}/connect`
const REQUEST_TIMEOUT_MS = 15000

let requestCounter = 0
const pendingRequests = new Map<string, { expectedType: string; resolve: (value: any) => void; reject: (reason?: Error) => void; timeoutId: number }>()
let connectFrame: HTMLIFrameElement | null = null

function buildRequestId() {
  requestCounter += 1
  return `startng-${Date.now()}-${requestCounter}`
}

export function getStartNgSigninUrl() {
  return `https://start.ng/?return_to=${encodeURIComponent(`${location.origin}${location.pathname}`)}`
}

function ensureConnectFrame() {
  if (connectFrame) return connectFrame

  connectFrame = document.createElement('iframe')
  connectFrame.src = STARTNG_CONNECT_URL
  connectFrame.setAttribute('title', 'Start.ng connect')
  connectFrame.setAttribute('aria-hidden', 'true')
  connectFrame.style.position = 'absolute'
  connectFrame.style.width = '1px'
  connectFrame.style.height = '1px'
  connectFrame.style.opacity = '0'
  connectFrame.style.pointerEvents = 'none'
  connectFrame.style.border = '0'
  document.body.appendChild(connectFrame)

  window.addEventListener('message', (event) => {
    if (!connectFrame || event.source !== connectFrame.contentWindow) return
    if (event.origin !== STARTNG_ORIGIN) return

    const payload = event.data
    if (!payload || typeof payload !== 'object' || !payload.requestId) return

    const pending = pendingRequests.get(payload.requestId)
    if (!pending) return

    if (payload.type !== pending.expectedType) return

    clearTimeout(pending.timeoutId)
    pendingRequests.delete(payload.requestId)
    pending.resolve(payload)
  })

  return connectFrame
}

export function askStartNg<T = any>(payload: Record<string, any>, expectedType: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const host = window.location.hostname
    const isHostedGame = host.endsWith('.start.ng') || host === 'start.ng'
    if (!isHostedGame) {
      reject(new Error('Start.ng is unavailable outside the published game host.'))
      return
    }

    const frame = ensureConnectFrame()
    const requestId = buildRequestId()

    const timeoutId = window.setTimeout(() => {
      pendingRequests.delete(requestId)
      reject(new Error(`Start.ng request timed out for ${expectedType}`))
    }, REQUEST_TIMEOUT_MS)

    pendingRequests.set(requestId, {
      expectedType,
      resolve,
      reject,
      timeoutId,
    })

    const targetWindow = frame.contentWindow
    if (!targetWindow) {
      clearTimeout(timeoutId)
      pendingRequests.delete(requestId)
      reject(new Error('Start.ng connect iframe is unavailable'))
      return
    }

    targetWindow.postMessage({ ...payload, requestId, type: payload.type }, STARTNG_ORIGIN)
  })
}

export function getPlayerFromReply(reply?: Record<string, any>) {
  if (!reply) return null
  return reply.user ?? reply.guest ?? null
}

export function getDisplayName(player?: StartNgPlayer | null, guestName = 'Guest') {
  if (!player) return guestName
  return player.name || guestName
}

export function getPlayerAccount(player?: StartNgPlayer | null) {
  if (!player) return 'Guest'
  return player.account ? `@${player.account}` : 'Guest'
}

export function createStartNgLeaderboardPayload() {
  return {
    leaderboard: {
      stats: [
        { key: 'score', label: 'Score', order: 'highest' },
        { key: 'bullseyes', label: 'Bullseyes', order: 'highest' },
        { key: 'accuracy', label: 'Accuracy %', order: 'highest' },
      ],
    },
  }
}
