"use client"

import { useRef, useCallback } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import * as THREE from "three"

const INITIAL_CAMERA_POSITION = new THREE.Vector3(3, 3, 3)
const INITIAL_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)

function Scene({
  controlsRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>
}) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#888888" />
      </mesh>
      <gridHelper args={[10, 10, "#cccccc", "#e5e5e5"]} />
      <OrbitControls ref={controlsRef} makeDefault />
    </>
  )
}

export default function Viewport3D() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  const handleResetCamera = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return

    controls.object.position.copy(INITIAL_CAMERA_POSITION)
    controls.target.copy(INITIAL_CAMERA_TARGET)
    controls.update()
  }, [])

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{
          position: [
            INITIAL_CAMERA_POSITION.x,
            INITIAL_CAMERA_POSITION.y,
            INITIAL_CAMERA_POSITION.z,
          ],
          fov: 50,
        }}
        style={{ background: "#fafafa" }}
      >
        <Scene controlsRef={controlsRef} />
      </Canvas>

      <button
        onClick={handleResetCamera}
        className="absolute bottom-3 right-3 rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent"
      >
        Reset camera
      </button>
    </div>
  )
}
