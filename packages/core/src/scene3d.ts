/// <reference lib="dom" />
/**
 * 3D scenes with three.js: a glTF model from the media library, or a generated shape, lit by a
 * studio environment. Loaded only by pages that have one (the scene runtime imports it on demand).
 */
import {
  ACESFilmicToneMapping,
  Box3,
  Color,
  DirectionalLight,
  Group,
  IcosahedronGeometry,
  type Material,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TorusKnotGeometry,
  Vector3,
  WebGLRenderer,
} from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { SceneConfig } from './page.ts'

function makeMaterial(kind: SceneConfig['material'], c2: Color, c3: Color): Material {
  switch (kind) {
    case 'glass':
      return new MeshPhysicalMaterial({
        color: c2,
        transmission: 1,
        roughness: 0.06,
        thickness: 1.4,
        ior: 1.45,
        metalness: 0,
      })
    case 'clay':
      return new MeshStandardMaterial({ color: c2, roughness: 0.92, metalness: 0 })
    case 'iridescent':
      return new MeshPhysicalMaterial({
        color: c2,
        metalness: 0.25,
        roughness: 0.22,
        iridescence: 1,
        iridescenceIOR: 1.35,
        sheen: 1,
        sheenColor: c3,
        clearcoat: 1,
      })
    case 'wire':
      return new MeshBasicMaterial({ color: c3, wireframe: true, transparent: true, opacity: 0.85 })
    default:
      return new MeshStandardMaterial({ color: c2, metalness: 1, roughness: 0.14 })
  }
}

function makeShape(shape: SceneConfig['shape'], material: Material): Object3D {
  switch (shape) {
    case 'knot':
      return new Mesh(new TorusKnotGeometry(0.85, 0.28, 320, 40), material)
    case 'torus':
      return new Mesh(new TorusGeometry(1, 0.38, 64, 160), material)
    case 'cube':
      return new Mesh(new RoundedBoxGeometry(1.5, 1.5, 1.5, 8, 0.22), material)
    case 'spheres': {
      const g = new Group()
      for (let i = 0; i < 7; i++) {
        const r = 0.22 + ((i * 37) % 10) / 30
        const m = new Mesh(new SphereGeometry(r, 48, 32), material)
        const a = (i / 7) * Math.PI * 2
        m.position.set(Math.cos(a) * 1.1, Math.sin(a * 1.7) * 0.6, Math.sin(a) * 0.8)
        g.add(m)
      }
      return g
    }
    case 'rings': {
      const g = new Group()
      for (let i = 0; i < 3; i++) {
        const m = new Mesh(new TorusGeometry(0.7 + i * 0.32, 0.045, 24, 160), material)
        m.rotation.set(i * 0.9, i * 0.5, 0)
        g.add(m)
      }
      return g
    }
    default: {
      // blob: an icosphere whose surface breathes (see the frame loop). Its faces don't share
      // vertices, so they are merged: otherwise recomputed normals shade every triangle flat.
      const sphere = new IcosahedronGeometry(1.15, 32)
      sphere.deleteAttribute('normal')
      sphere.deleteAttribute('uv')
      const geometry = mergeVertices(sphere)
      sphere.dispose()
      geometry.computeVertexNormals()
      return new Mesh(geometry, material)
    }
  }
}

/** Fits any model in a sphere of radius ~1.3 at the origin. */
function fit(object: Object3D) {
  const box = new Box3().setFromObject(object)
  const size = box.getSize(new Vector3()).length() || 1
  const center = box.getCenter(new Vector3())
  object.position.sub(center)
  const wrap = new Group()
  wrap.add(object)
  wrap.scale.setScalar(2.6 / size)
  return wrap
}

export function start3D(
  canvas: HTMLCanvasElement,
  cfg: SceneConfig,
  options: { scroller?: HTMLElement; reduced: boolean },
): () => void {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(1.75, devicePixelRatio || 1))
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  const [a, b, c] = cfg.colors ?? []
  const c1 = new Color(a ?? '#0b0a09')
  const c2 = new Color(b ?? '#e2a768')
  const c3 = new Color(c ?? '#f2ede4')
  if (cfg.transparent) renderer.setClearColor(0x000000, 0)
  else renderer.setClearColor(c1, 1)

  const scene = new Scene()
  const pmrem = new PMREMGenerator(renderer)
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = environment
  const key = new DirectionalLight(c3, 2.2)
  key.position.set(3, 4, 5)
  const rim = new DirectionalLight(c2, 3)
  rim.position.set(-4, -1, -3)
  scene.add(key, rim)

  const camera = new PerspectiveCamera(35, 1, 0.1, 100)
  camera.position.set(0, 0, 5.6 / Math.max(0.4, cfg.zoom ?? 1))

  const pivot = new Group()
  scene.add(pivot)
  const material = makeMaterial(cfg.material, c2, c3)
  let blob: { mesh: Mesh; base: Float32Array } | null = null

  if (cfg.preset === 'model' && cfg.model) {
    new GLTFLoader().load(
      cfg.model,
      (gltf) => {
        const model = gltf.scene
        if (cfg.material && cfg.material !== 'original')
          model.traverse((o) => {
            if ((o as Mesh).isMesh) (o as Mesh).material = material
          })
        pivot.add(fit(model))
        render(performance.now())
      },
      undefined,
      (error) => console.warn('Materialize: modello 3D non caricato', error),
    )
  } else {
    const shape = makeShape(cfg.shape, material)
    pivot.add(shape)
    if (!cfg.shape || cfg.shape === 'blob') {
      const mesh = shape as Mesh
      blob = { mesh, base: Float32Array.from(mesh.geometry.attributes.position?.array ?? []) }
    }
  }

  let mouse = { x: 0, y: 0 }
  let goal = { x: 0, y: 0 }
  let visible = false
  let frame = 0
  const start = performance.now()

  const size = () => {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    const ratio = renderer.getPixelRatio()
    if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  function render(now: number) {
    size()
    const t = options.reduced ? 2 : ((now - start) / 1000) * (cfg.speed ?? 1)
    mouse = { x: mouse.x + (goal.x - mouse.x) * 0.06, y: mouse.y + (goal.y - mouse.y) * 0.06 }
    const r = canvas.getBoundingClientRect()
    const v = options.scroller ? options.scroller.getBoundingClientRect() : { top: 0, height: innerHeight }
    const scroll = Math.min(1, Math.max(0, (v.top + v.height - r.top) / (v.height + r.height)))
    const react = cfg.mouse ?? 1
    pivot.rotation.y =
      t * 0.35 * (cfg.rotate ?? 1) + mouse.x * 0.6 * react + (scroll - 0.5) * Math.PI * (cfg.scroll ?? 1)
    pivot.rotation.x = mouse.y * 0.4 * react + Math.sin(t * 0.3) * 0.08
    pivot.position.y = Math.sin(t * 0.8) * 0.06
    if (blob) {
      const pos = blob.mesh.geometry.attributes.position
      if (pos) {
        const k = 0.18 * (cfg.intensity ?? 1)
        for (let i = 0; i < pos.count; i++) {
          const x = blob.base[i * 3] ?? 0
          const y = blob.base[i * 3 + 1] ?? 0
          const z = blob.base[i * 3 + 2] ?? 0
          const n = Math.sin(x * 2.1 + t * 1.3) * Math.sin(y * 2.4 + t * 1.1) * Math.sin(z * 1.9 + t * 0.9)
          const s = 1 + n * k
          pos.setXYZ(i, x * s, y * s, z * s)
        }
        pos.needsUpdate = true
        blob.mesh.geometry.computeVertexNormals()
      }
    }
    renderer.render(scene, camera)
  }

  const tick = (now: number) => {
    frame = 0
    render(now)
    if (visible && !options.reduced) frame = requestAnimationFrame(tick)
  }
  const io = new IntersectionObserver(
    ([e]) => {
      visible = !!e?.isIntersecting
      if (visible && !frame) frame = requestAnimationFrame(tick)
    },
    { root: options.scroller ?? null, rootMargin: '100px' },
  )
  io.observe(canvas)
  const onPointer = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    goal = { x: ((e.clientX - r.left) / r.width - 0.5) * 2, y: ((e.clientY - r.top) / r.height - 0.5) * 2 }
  }
  addEventListener('pointermove', onPointer, { passive: true })
  render(performance.now())
  canvas.dataset.mzReady = ''

  return () => {
    cancelAnimationFrame(frame)
    io.disconnect()
    removeEventListener('pointermove', onPointer)
    scene.traverse((o) => {
      const m = o as Mesh
      if (m.isMesh) m.geometry.dispose()
    })
    material.dispose()
    environment.dispose()
    pmrem.dispose()
    renderer.dispose()
  }
}
