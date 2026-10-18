import { useRef } from 'react'
import { Vector3 } from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { IntroInfo, AboutInfo, ExperienceInfo, ProjectsInfo, ContactsInfo, SkillsInfo } from './faceContent'

// Content by face number (1-based)
const CONTENT = [IntroInfo, AboutInfo, ExperienceInfo, ProjectsInfo, ContactsInfo, SkillsInfo]

// Titles by face number; the first face is the intro and has none
const TITLES = [null, 'About me', 'Experience', 'Projects', 'Contacts', 'Skills']

// In-plane turn (radians, counter-clockwise seen from outside) per face number, so the text is upright when the camera arrives
// at the top and bottom faces from the side
const SPIN = { 5: -Math.PI / 2, 6: Math.PI / 2 }

const tmpPosition = new Vector3()
const tmpNormal = new Vector3()
const tmpToCamera = new Vector3()

// A transparent HTML plane floating just above a face, exactly the size of it. `rotation` turns the plane to face outwards
export function FaceInfo({ number, rotation, color, opacity, textColor }) {
  const group = useRef()
  const panel = useRef()
  const Content = CONTENT[number - 1]

  // Show the panel only while its face looks towards the camera
  useFrame(({ camera }) => {
    if (!group.current || !panel.current) return
    group.current.getWorldPosition(tmpPosition)
    group.current.getWorldDirection(tmpNormal)
    tmpToCamera.copy(camera.position).sub(tmpPosition).normalize()
    panel.current.classList.toggle('visible', tmpNormal.dot(tmpToCamera) > 0.15)
  })

  return (
    <group ref={group} rotation={rotation}>
      {/* distanceFactor 5/3 makes 1 unit = 240px, so the 480px panel is exactly 2 units: the size of a cube face */}
      <group rotation={[0, 0, SPIN[number] ?? 0]}>
        <Html transform center distanceFactor={5 / 3} position={[0, 0, 1.01]} pointerEvents="none">
          <div ref={panel} className="face-panel" style={{ color: textColor, background: `color-mix(in srgb, ${color} ${opacity * 100}%, transparent)` }}>
            {TITLES[number - 1] && <h2 className="panel-title">{TITLES[number - 1]}</h2>}
            <Content />
          </div>
        </Html>
      </group>
    </group>
  )
}
