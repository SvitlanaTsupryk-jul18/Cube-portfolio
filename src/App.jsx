import { Suspense, useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, useProgress, Edges, MeshPortalMaterial, CameraControls, Environment, useEnvironment } from '@react-three/drei'
import { useControls } from 'leva'
import { FaceInfo } from './FaceInfo'

// Resolve the model against Vite's base URL so it works from any sub-path
const MODEL_URL = `${import.meta.env.BASE_URL}aobox-transformed.glb`
// Same HDRI as drei's 'city' preset (Poly Haven, CC0), served locally instead of from a third-party CDN
const ENV_URL = `${import.meta.env.BASE_URL}hdr/potsdamer_platz_1k.hdr`

// Start fetching the model right away, before the Canvas mounts
useGLTF.preload(MODEL_URL)
useEnvironment.preload({ files: ENV_URL })

// Each face of the cube: rotation of the AO box, background color and the shape geometry shown inside the portal
const sides = [
  { rotation: [0, 0, 0], bg: 'orange', geometry: <torusGeometry args={[0.65, 0.3, 64]} /> },
  { rotation: [0, Math.PI, 0], bg: 'lightblue', geometry: <torusKnotGeometry args={[0.55, 0.2, 128, 32]} /> },
  { rotation: [0, Math.PI / 2, Math.PI / 2], bg: 'lightgreen', geometry: <boxGeometry args={[1.15, 1.15, 1.15]} /> },
  { rotation: [0, Math.PI / 2, -Math.PI / 2], bg: 'aquamarine', geometry: <octahedronGeometry /> },
  { rotation: [0, -Math.PI / 2, 0], bg: 'indianred', geometry: <icosahedronGeometry /> },
  { rotation: [0, Math.PI / 2, 0], bg: 'hotpink', geometry: <dodecahedronGeometry /> }
]

const HALF = Math.PI / 2
const FULL = Math.PI * 2

// Visiting order as indices into `sides` (BoxGeometry material order: +x, -x, +y, -y, +z, -z).
// Around the sides first (+z, +x, -z, -x), then the top (+y) and the bottom (-y). The 5 -> 6 step is a 180 degree flip over the cube
const FACE_ORDER = [4, 0, 5, 1, 2, 3]

// Camera [azimuth, polar] per step of FACE_ORDER. Azimuth is unwrapped (never jumps back) so the camera never spins the long way round
const STEP_ANGLES = [
  [0, HALF],
  [HALF, HALF],
  [Math.PI, HALF],
  [FULL - HALF, HALF],
  [FULL - HALF, 0],
  [FULL - HALF, Math.PI]
]

// Rotation that turns a plane (facing +z) to face outwards from each side, in `sides` order
const FACE_ROTATIONS = [
  [0, Math.PI / 2, 0],
  [0, -Math.PI / 2, 0],
  [-Math.PI / 2, 0, 0],
  [Math.PI / 2, 0, 0],
  [0, 0, 0],
  [0, Math.PI, 0]
]

// Cube size is the boxGeometry args in Scene (2 units, so a face is 2x2 and sits 1 unit from the center)
const CUBE_HALF = 1
const CAMERA_FOV = 75 // r3f default
const CAMERA_DIRECTION = new Vector3(-3, 0.5, 3).normalize()
// Share of the viewport a face should fill: nearly the full width on narrow screens, 3/4 of the height on wide ones
const FILL_WIDTH = 0.96
const FILL_HEIGHT = 0.6

// Camera distance from the cube center so that a face fills the shares above, whichever of width or height is the limit
const getCameraDistance = (width, height) => {
  const tan = Math.tan((CAMERA_FOV * Math.PI) / 360)
  const toFace = Math.max(CUBE_HALF / (FILL_WIDTH * tan * (width / height)), CUBE_HALF / (FILL_HEIGHT * tan))
  return CUBE_HALF + toFace
}

const useCameraDistance = () => {
  const [distance, setDistance] = useState(() => getCameraDistance(window.innerWidth, window.innerHeight))
  useEffect(() => {
    const onResize = () => setDistance(getCameraDistance(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return distance
}

export const App = () => {
  const controls = useRef()
  const distance = useCameraDistance()
  // Number of steps taken along FACE_ORDER; -1 until the first click, can go negative or past 6 (it wraps)
  const [step, setStep] = useState(-1)

  // Keep the cube size on screen when the window is resized or rotated
  useEffect(() => {
    controls.current?.dollyTo(distance, false)
  }, [distance])

  // Loading state is shown as a DOM overlay: drei's Html inside a Suspense fallback unmounts a React root mid-render and crashes
  const { progress } = useProgress()

  // Registered once here instead of once per side
  const { worldUnits } = useControls({ worldUnits: false })
  const { panelColor, panelOpacity, textColor } = useControls('Panels', {
    panelColor: { value: '#0a0a14', label: 'color' },
    textColor: { value: '#000000', label: 'text color' },
    panelOpacity: { value: 0, min: 0, max: 1, step: 0.01, label: 'opacity' }
  })

  // Orbit the camera to the face `delta` steps away along FACE_ORDER
  const turn = (delta) => {
    const next = step + delta
    const count = FACE_ORDER.length
    const [azimuth, polar] = STEP_ANGLES[((next % count) + count) % count]
    setStep(next)
    // Each full lap adds a full turn of azimuth to stay continuous
    controls.current?.rotateTo(azimuth + Math.floor(next / count) * Math.PI * 2, polar, true)
    controls.current?.dollyTo(distance, true)
  }
  const current = step < 0 ? null : (((step % FACE_ORDER.length) + FACE_ORDER.length) % FACE_ORDER.length) + 1

  return (
    <>
      <Canvas shadows="percentage" camera={{ position: CAMERA_DIRECTION.clone().multiplyScalar(distance).toArray() }}>
        <Suspense fallback={null}>
          <Scene worldUnits={worldUnits} panelColor={panelColor} panelOpacity={panelOpacity} textColor={textColor} />
        </Suspense>
        <CameraControls ref={controls} makeDefault smoothTime={0.5} />
      </Canvas>
      {progress < 100 && <div className="loading">Loading...</div>}
      <div className="face-nav">
        <button onClick={() => turn(-1)}>&larr; Prev face</button>
        <span className="face-nav-current">{current ? `Face ${current}` : 'Face -'}</span>
        <button onClick={() => turn(1)}>Next face &rarr;</button>
      </div>
    </>
  )
}

// Lives inside the Canvas so that useGLTF can suspend while the model loads
function Scene({ worldUnits, panelColor, panelOpacity, textColor }) {
  const { nodes } = useGLTF(MODEL_URL)
  // Loaded once and shared by all portals, so the HDR is fetched and prefiltered a single time instead of once per side
  const envMap = useEnvironment({ files: ENV_URL })
  return (
    <mesh castShadow receiveShadow>
      <boxGeometry args={[2, 2, 2]} />
      <Edges />
      {sides.map(({ geometry, ...props }, index) => (
        <Side key={index} index={index} worldUnits={worldUnits} aoBox={nodes.Cube} envMap={envMap} {...props}>
          {geometry}
        </Side>
      ))}
      {sides.map((_, index) => (
        <FaceInfo
          key={index}
          number={FACE_ORDER.indexOf(index) + 1}
          rotation={FACE_ROTATIONS[index]}
          color={panelColor}
          opacity={panelOpacity}
          textColor={textColor}
        />
      ))}
    </mesh>
  )
}

function Side({ rotation, bg, children, index, worldUnits, aoBox, envMap }) {
  const mesh = useRef()
  useFrame((state, delta) => {
    // Spin the shape on both axes
    mesh.current.rotation.x += delta
    mesh.current.rotation.y += delta
  })
  return (
    <MeshPortalMaterial worldUnits={worldUnits} attach={`material-${index}`}>
      {/* Everything in here is inside the portal and isolated from the canvas */}
      <ambientLight intensity={0.5} />
      <Environment map={envMap} />
      {/* A box with baked AO */}
      <mesh castShadow receiveShadow rotation={rotation} geometry={aoBox.geometry}>
        <meshStandardMaterial aoMapIntensity={1} aoMap={aoBox.material.aoMap} color={bg} />
        <spotLight castShadow color={bg} intensity={2} position={[10, 10, 10]} angle={0.15} penumbra={1} shadow-normalBias={0.05} shadow-bias={0.0001} />
      </mesh>
      {/* The shape */}
      <mesh castShadow receiveShadow ref={mesh}>
        {children}
        <meshLambertMaterial color={bg} />
      </mesh>
    </MeshPortalMaterial>
  )
}
