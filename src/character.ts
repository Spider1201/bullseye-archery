import * as THREE from 'three'

const FALLBACK_STYLE = {
  body: 'female',
  primaryColor: '#84cc16',
  secondaryColor: '#273c4c',
  skinColor: '#d4a373',
  hairColor: '#201a1a',
  hair: 'braids',
  hat: 'none',
  accessory: 'backpack',
}

export type PlayerStyle = typeof FALLBACK_STYLE

function parseHex(hex: string | undefined, fallback: string) {
  const value = (hex ?? fallback).trim()
  if (/^#[0-9a-fA-F]{3,6}$/.test(value)) return value
  return fallback
}

export function normalizeStyle(style: Partial<PlayerStyle> | undefined) {
  const resolved = { ...FALLBACK_STYLE, ...(style ?? {}) }
  return {
    ...resolved,
    primaryColor: parseHex(resolved.primaryColor, FALLBACK_STYLE.primaryColor),
    secondaryColor: parseHex(resolved.secondaryColor, FALLBACK_STYLE.secondaryColor),
    skinColor: parseHex(resolved.skinColor, FALLBACK_STYLE.skinColor),
    hairColor: parseHex(resolved.hairColor, FALLBACK_STYLE.hairColor),
  }
}

function createMaterial(hex: string, roughness = 0.75, metalness = 0.08) {
  const normalizedHex = /^#/.test(hex) ? hex : `#${hex}`
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(normalizedHex),
    roughness,
    metalness,
  })
}

function addHair(group: THREE.Group, style: PlayerStyle, head: THREE.Mesh) {
  const hairColor = new THREE.Color(style.hairColor)
  const hairMaterial = createMaterial(hairColor.getHexString(), 0.9, 0.15)

  switch (style.hair) {
    case 'short': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 18, 0, Math.PI * 2, 0, Math.PI / 2), hairMaterial)
      cap.scale.set(1.08, 0.7, 1.08)
      cap.position.set(0, 0.4, -0.02)
      group.add(cap)
      break
    }
    case 'afro': {
      const afro = new THREE.Mesh(new THREE.SphereGeometry(0.52, 18, 18), hairMaterial)
      afro.scale.set(1.2, 1.1, 1.1)
      afro.position.set(0, 0.58, 0.02)
      group.add(afro)
      break
    }
    case 'braids': {
      const braidMaterial = createMaterial(style.hairColor, 0.9, 0.15)
      for (let i = -1; i <= 1; i += 2) {
        const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.8, 8), braidMaterial)
        braid.rotation.z = THREE.MathUtils.degToRad(i * 20)
        braid.position.set(i * 0.34, -0.05, 0.1)
        group.add(braid)
      }
      break
    }
    case 'bun': {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), hairMaterial)
      bun.position.set(0, 0.65, -0.35)
      group.add(bun)
      break
    }
    case 'ponytail': {
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.8, 10), hairMaterial)
      tail.rotation.z = THREE.MathUtils.degToRad(90)
      tail.position.set(0.3, 0.35, -0.4)
      group.add(tail)
      break
    }
    case 'dreads': {
      for (let i = 0; i < 5; i += 1) {
        const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 8), hairMaterial)
        dread.rotation.z = THREE.MathUtils.degToRad((i - 2) * 18)
        dread.position.set((i - 2) * 0.13, 0.1, 0.12)
        group.add(dread)
      }
      break
    }
    default:
      break
  }

  if (style.hair === 'bald') {
    head.position.y = 0.15
  }
}

function addHat(group: THREE.Group, style: PlayerStyle) {
  const hat = style.hat ?? 'none'
  if (hat === 'none') return

  const color = new THREE.Color(style.primaryColor)
  const material = createMaterial(color.getHexString(), 0.9, 0.1)

  if (hat === 'cap') {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.42, 0.18, 18), material)
    cap.position.set(0, 0.72, 0.02)
    cap.rotation.x = Math.PI / 6
    group.add(cap)
  }

  if (hat === 'beanie') {
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), material)
    beanie.scale.set(1.15, 0.8, 1.15)
    beanie.position.set(0, 0.72, 0.05)
    group.add(beanie)
  }

  if (hat === 'tophat') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 24), material)
    brim.position.set(0, 0.54, 0)
    group.add(brim)

    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.52, 12), material)
    top.position.set(0, 1, 0)
    group.add(top)
  }

  if (hat === 'crown') {
    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 5), material)
    crown.rotation.y = Math.PI / 5
    crown.position.set(0, 0.88, 0.02)
    group.add(crown)
  }
}

function addAccessory(group: THREE.Group, style: PlayerStyle) {
  const accessory = style.accessory ?? 'none'

  if (accessory === 'glasses') {
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.7 })
    const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.04), frameMaterial)
    const rightFrame = leftFrame.clone()
    leftFrame.position.set(-0.16, 0.12, 0.33)
    rightFrame.position.set(0.16, 0.12, 0.33)
    group.add(leftFrame, rightFrame)
  }

  if (accessory === 'earrings') {
    const metal = new THREE.MeshStandardMaterial({ color: 0xf4d35e, roughness: 0.45, metalness: 0.9 })
    const left = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 8, 12), metal)
    const right = left.clone()
    left.position.set(-0.34, 0.04, 0.08)
    right.position.set(0.34, 0.04, 0.08)
    group.add(left, right)
  }

  if (accessory === 'beard') {
    const beardMaterial = createMaterial(style.hairColor, 0.85, 0.12)
    const beard = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.38, 12), beardMaterial)
    beard.position.set(0, -0.18, 0.15)
    beard.rotation.x = Math.PI / 2.2
    group.add(beard)
  }

  if (accessory === 'scarf') {
    const scarfMaterial = createMaterial(style.primaryColor, 0.8, 0.25)
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.09, 10, 18), scarfMaterial)
    scarf.rotation.x = Math.PI / 2
    scarf.position.set(0, 0.02, 0.18)
    group.add(scarf)
  }

  if (accessory === 'backpack') {
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.18), createMaterial(style.secondaryColor, 0.9, 0.15))
    pack.position.set(0, 0.05, -0.46)
    group.add(pack)
  }
}

export function buildCharacter(style?: Partial<PlayerStyle>) {
  const normalized = normalizeStyle(style)
  const root = new THREE.Group()

  const skinMaterial = createMaterial(normalized.skinColor, 0.7, 0.15)
  const clothingMaterial = createMaterial(normalized.primaryColor, 0.8, 0.1)
  const pantsMaterial = createMaterial(normalized.secondaryColor, 0.9, 0.1)

  const torsoGroup = new THREE.Group()
  root.add(torsoGroup)

  const torso = new THREE.Mesh(
    normalized.body === 'male' ? new THREE.BoxGeometry(0.8, 1.1, 0.44) : new THREE.CylinderGeometry(0.42, 0.46, 1.08, 18),
    clothingMaterial,
  )
  torso.position.y = 1.2
  torsoGroup.add(torso)

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.2, 12), skinMaterial)
  neck.position.y = 1.86
  torsoGroup.add(neck)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 24), skinMaterial)
  head.position.y = 2.42
  torsoGroup.add(head)

  const leftArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.7, 6, 10), clothingMaterial)
  leftArm.position.set(-0.58, 1.25, 0.02)
  leftArm.rotation.z = THREE.MathUtils.degToRad(18)
  torsoGroup.add(leftArm)

  const rightArm = leftArm.clone()
  rightArm.position.x = 0.58
  rightArm.rotation.z = THREE.MathUtils.degToRad(-18)
  torsoGroup.add(rightArm)

  const leftLeg = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.78, 8, 12), pantsMaterial)
  leftLeg.position.set(-0.2, 0.22, 0)
  torsoGroup.add(leftLeg)

  const rightLeg = leftLeg.clone()
  rightLeg.position.x = 0.2
  torsoGroup.add(rightLeg)

  addHair(torsoGroup, normalized, head)
  addHat(torsoGroup, normalized)
  addAccessory(torsoGroup, normalized)

  // Add a front-facing bow to the archer when used as the player character.
  const bow = new THREE.Group()
  const bowMaterial = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.85 })
  const bowBody = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 8, 16, Math.PI), bowMaterial)
  bowBody.rotation.z = Math.PI / 2
  bowBody.position.set(0.76, 1.15, 0.55)
  bow.add(bowBody)
  root.add(bow)

  const arrow = new THREE.Group()
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), new THREE.MeshStandardMaterial({ color: 0xf3f0e6 }))
  shaft.rotation.z = Math.PI / 2
  shaft.position.set(1.3, 1.15, 0.6)
  arrow.add(shaft)
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xd7b377 }))
  tip.rotation.z = -Math.PI / 2
  tip.position.set(1.82, 1.15, 0.6)
  arrow.add(tip)
  root.add(arrow)

  root.scale.setScalar(1.2)
  return root
}

export const DEFAULT_STYLE = FALLBACK_STYLE
