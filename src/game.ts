import * as THREE from 'three'
import { buildCharacter, type PlayerStyle } from './character'

export type RoundSummary = {
  score: number
  bulls: number
  shots: number
  accuracy: number
  improved?: boolean
  rank?: number
  saved: boolean
}

const GRASS_COLOR = '#6cbf54'
const SKY_COLOR = '#b8ebff'
const TARGET_STAND_COLOR = '#6d4d36'
const TARGET_RING_COLORS = ['#d24444', '#e6d85d', '#5bd777', '#3aa0ff']

export class ArcheryGame {
  private readonly scene: THREE.Scene
  private readonly camera: THREE.PerspectiveCamera
  private readonly renderer: THREE.WebGLRenderer
  private readonly shootButton: HTMLButtonElement
  private readonly targetGroup: THREE.Group
  private readonly archer: THREE.Group
  private readonly arrowGroup: THREE.Group
  private readonly viewportSize = new THREE.Vector2()
  private round = 1
  private arrowsLeft = 6
  private score = 0
  private bulls = 0
  private shots = 0
  private totalShots = 0
  private roundScore = 0
  private roundFinished = false
  private pointer = new THREE.Vector2(0, 0)
  private targetOrigin = new THREE.Vector3(0, 1.5, -20)
  private onRoundEnd: (summary: RoundSummary) => void
  private onScoreUpdate: (state: { score: number; arrowsLeft: number; bulls: number; shots: number; round: number }) => void

  constructor(container: HTMLElement, options: { onRoundEnd: (summary: RoundSummary) => void; onScoreUpdate: (state: { score: number; arrowsLeft: number; bulls: number; shots: number; round: number }) => void; style?: Partial<PlayerStyle>; shootButton: HTMLButtonElement }) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(SKY_COLOR)
    this.scene.fog = new THREE.Fog(SKY_COLOR, 18, 60)

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200)
    this.camera.position.set(0, 3.5, 8.5)
    this.camera.lookAt(0, 1.8, -15)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    container.appendChild(this.renderer.domElement)

    this.shootButton = options.shootButton
    this.onRoundEnd = options.onRoundEnd
    this.onScoreUpdate = options.onScoreUpdate

    this.scene.add(this.createLights())
    this.scene.add(this.createRange())

    this.targetGroup = new THREE.Group()
    this.scene.add(this.targetGroup)
    this.createTargetVisuals()

    this.archer = buildCharacter(options.style)
    this.archer.position.set(0, 0, 5.8)
    this.archer.rotation.y = THREE.MathUtils.degToRad(180)
    this.scene.add(this.archer)

    this.arrowGroup = new THREE.Group()
    this.scene.add(this.arrowGroup)

    this.bindEvents()
    this.resetRound(false)
    this.animate = this.animate.bind(this)
    this.animate()
  }

  setPlayerStyle(style: Partial<PlayerStyle>) {
    this.archer.clear()
    const nextArcher = buildCharacter(style)
    nextArcher.position.set(0, 0, 5.8)
    nextArcher.rotation.y = THREE.MathUtils.degToRad(180)
    this.archer.add(nextArcher)
    this.archer.position.set(0, 0, 5.8)
  }

  getTargetPosition() {
    return this.targetOrigin.clone()
  }

  setAimFromPointer(x: number, y: number) {
    this.pointer.set(x, y)
  }

  shoot() {
    if (this.roundFinished || this.arrowsLeft <= 0) return

    const muzzle = new THREE.Vector3(0.8, 2.2, 5.3)
    const aimPoint = new THREE.Vector3(
      this.pointer.x * 4.6,
      this.pointer.y * 2.6 + 2.3,
      -14,
    )
    const dir = aimPoint.clone().sub(muzzle).normalize()
    const arrow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 1.25, 8),
      new THREE.MeshStandardMaterial({ color: 0xe4d6a7, roughness: 0.7 }),
    )
    arrow.castShadow = true
    arrow.position.copy(muzzle)
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().normalize())
    this.arrowGroup.add(arrow)

    const velocity = dir.clone().multiplyScalar(28)
    const arrowData = { mesh: arrow, velocity, ttl: 4, hit: false }
    const activeArrows = (this as any).__arrows || []
    activeArrows.push(arrowData)
    ;(this as any).__arrows = activeArrows

    this.arrowsLeft -= 1
    this.totalShots += 1
    this.fireHudUpdate()
    this.shootButton.disabled = true
    window.setTimeout(() => {
      this.shootButton.disabled = false
    }, 220)
  }

  private animate() {
    requestAnimationFrame(this.animate)
    const activeArrows = (this as any).__arrows || []
    const activeList = [...activeArrows]

    for (const arrow of activeList) {
      arrow.mesh.position.addScaledVector(arrow.velocity, 0.016)
      arrow.velocity.y -= 0.18
      arrow.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), arrow.velocity.clone().normalize())
      arrow.ttl -= 0.016

      const targetPos = this.targetOrigin.clone()
      const distanceToTarget = arrow.mesh.position.distanceTo(targetPos)
      if (distanceToTarget < 2.2 && !arrow.hit) {
        arrow.hit = true
        this.resolveHit(arrow.mesh.position, targetPos)
      }

      if (arrow.ttl <= 0 || arrow.mesh.position.length() > 120) {
        this.arrowGroup.remove(arrow.mesh)
        activeArrows.splice(activeArrows.indexOf(arrow), 1)
      }
    }

    this.renderer.render(this.scene, this.camera)
    if (!this.roundFinished && this.arrowsLeft <= 0) {
      this.finishRound()
    }
  }

  private resolveHit(position: THREE.Vector3, targetPos: THREE.Vector3) {
    const diff = position.clone().sub(targetPos)
    const distance = diff.length()
    const rings = [0.18, 0.4, 0.74, 1.2]
    let points = 0
    let bull = false

    if (distance < rings[0]) {
      points = 150
      bull = true
    } else if (distance < rings[1]) {
      points = 110
    } else if (distance < rings[2]) {
      points = 70
    } else if (distance < rings[3]) {
      points = 35
    }

    this.score += points
    this.roundScore += points
    this.shots += 1
    if (bull) this.bulls += 1

    const flash = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(0.1, 0.18 + distance * 0.08), 10, 10),
      new THREE.MeshStandardMaterial({ color: bull ? 0xffd66b : 0x7df9a8, emissive: bull ? 0x9b6c00 : 0x1ca35c, emissiveIntensity: 0.5 }),
    )
    flash.position.copy(position.clone())
    this.scene.add(flash)
    window.setTimeout(() => this.scene.remove(flash), 250)

    const target = this.targetGroup.children[0] as THREE.Group
    target.children.forEach((child: THREE.Object3D) => {
      if ('material' in child && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial
        mat.emissive = new THREE.Color(bull ? '#ffd76b' : '#7ce7a0')
        mat.emissiveIntensity = 0.8
      }
    })
    window.setTimeout(() => {
      target.children.forEach((child: THREE.Object3D) => {
        if ('material' in child && child.material) {
          const mat = child.material as THREE.MeshStandardMaterial
          mat.emissive = new THREE.Color('#000000')
          mat.emissiveIntensity = 0
        }
      })
    }, 180)

    this.fireHudUpdate()
  }

  private finishRound() {
    if (this.roundFinished) return
    this.roundFinished = true
    const accuracy = this.totalShots > 0 ? Math.round((this.bulls / this.totalShots) * 100) : 0
    const summary: RoundSummary = {
      score: this.score,
      bulls: this.bulls,
      shots: this.totalShots,
      accuracy,
      saved: false,
    }
    this.onRoundEnd(summary)
  }

  resetRound(advanceRound = true) {
    this.roundFinished = false
    this.arrowsLeft = 6
    this.shots = 0
    this.roundScore = 0

    if (advanceRound) {
      this.round += 1
    }

    this.targetOrigin.set((Math.random() - 0.5) * 6, 1.5, -18 - (this.round * 3))
    this.targetGroup.position.copy(this.targetOrigin)
    this.targetGroup.rotation.y = (Math.random() - 0.5) * 0.8
    const currentTarget = this.targetGroup.children[0] as any
    currentTarget.position.set(0, 0, 0)

    const activeArrows = (this as any).__arrows || []
    for (const arrow of activeArrows) {
      this.arrowGroup.remove(arrow.mesh)
    }
    ;(this as any).__arrows = []

    this.fireHudUpdate()
  }

  private fireHudUpdate() {
    this.onScoreUpdate({
      score: this.score,
      arrowsLeft: this.arrowsLeft,
      bulls: this.bulls,
      shots: this.totalShots,
      round: this.round,
    })
  }

  private bindEvents() {
    window.addEventListener('resize', () => {
      this.viewportSize.set(window.innerWidth, window.innerHeight)
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })

    this.shootButton.addEventListener('click', () => {
      this.shoot()
    })

    window.addEventListener('pointermove', (event) => {
      this.pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      this.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
    })
  }

  private createLights() {
    const hemi = new THREE.HemisphereLight('#ecfeff', '#566f3c', 1.35)
    const sun = new THREE.DirectionalLight('#fff7d6', 1.5)
    sun.position.set(8, 15, 6)
    sun.castShadow = true
    sun.shadow.mapSize.width = 1024
    sun.shadow.mapSize.height = 1024
    sun.shadow.camera.left = -25
    sun.shadow.camera.right = 25
    sun.shadow.camera.top = 25
    sun.shadow.camera.bottom = -25
    return new THREE.Group().add(hemi, sun)
  }

  private createRange() {
    const range = new THREE.Group()

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(36, 72),
      new THREE.MeshStandardMaterial({ color: GRASS_COLOR, roughness: 0.95 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    range.add(ground)

    const path = new THREE.Mesh(
      new THREE.BoxGeometry(8, 0.05, 24),
      new THREE.MeshStandardMaterial({ color: '#d7c59f', roughness: 0.9 }),
    )
    path.position.set(0, 0.03, 3.6)
    path.receiveShadow = true
    range.add(path)

    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 2.2, 18),
      new THREE.MeshStandardMaterial({ color: TARGET_STAND_COLOR, roughness: 0.9 }),
    )
    stand.position.set(0, 1.1, -16)
    stand.castShadow = true
    stand.receiveShadow = true
    range.add(stand)

    for (let i = 0; i < 10; i += 1) {
      const treeTrunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.32, 1.8, 8),
        new THREE.MeshStandardMaterial({ color: '#7b4a2d', roughness: 0.9 }),
      )
      treeTrunk.position.set(-12 + i * 2.7, 0.9, -16 + (i % 2) * 6)
      treeTrunk.castShadow = true
      range.add(treeTrunk)

      const treeTop = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 14, 14),
        new THREE.MeshStandardMaterial({ color: '#2a7d4b', roughness: 0.85 }),
      )
      treeTop.position.set(treeTrunk.position.x, 2.4, treeTrunk.position.z)
      treeTop.castShadow = true
      range.add(treeTop)
    }

    return range
  }

  private createTargetVisuals() {
    const target = new THREE.Group()
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 1.6, 12),
      new THREE.MeshStandardMaterial({ color: '#7a5a43', roughness: 0.8 }),
    )
    stand.position.y = 0.8
    stand.castShadow = true
    target.add(stand)

    const board = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.8, 0.15, 28),
      new THREE.MeshStandardMaterial({ color: 0xf7f3ef, roughness: 0.8 }),
    )
    board.position.y = 1.7
    board.receiveShadow = true
    target.add(board)

    const ringData = [0.2, 0.5, 0.82, 1.2]
    for (let i = 0; i < ringData.length; i += 1) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(ringData[i], 0.08, 14, 36),
        new THREE.MeshStandardMaterial({ color: TARGET_RING_COLORS[i % TARGET_RING_COLORS.length], roughness: 0.5, emissive: 0x101010 }),
      )
      ring.rotation.x = Math.PI / 2
      ring.position.y = 1.7
      target.add(ring)
    }

    const bull = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 30),
      new THREE.MeshStandardMaterial({ color: '#f9e34d', roughness: 0.4, emissive: 0x604500, emissiveIntensity: 0.15 }),
    )
    bull.rotation.x = -Math.PI / 2
    bull.position.y = 1.7
    target.add(bull)

    target.position.copy(this.targetOrigin)
    target.rotation.y = Math.PI
    this.targetGroup.add(target)
  }
}

export function makeScoreSummary(score: number, bulls: number, shots: number) {
  const accuracy = shots > 0 ? Math.round((bulls / shots) * 100) : 0
  return { score, bulls, shots, accuracy }
}
