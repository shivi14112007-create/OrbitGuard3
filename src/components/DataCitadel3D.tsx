import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html, Float } from "@react-three/drei";
import * as THREE from "three";

import { useCitadelMetrics } from "@/lib/citadel-metrics";

/**
 * A different 3D scene from the Command Center's orbit:
 * a floating "data citadel" — animated holographic towers on a
 * neon grid plane, each tower representing a report/metric.
 * Tower values come from the live Incident Store snapshot so every
 * simulation / defense action updates the scene in real time.
 */

function GridFloor() {
  const ref = useRef<THREE.GridHelper>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.04;
  });
  return (
    <gridHelper
      ref={ref}
      args={[18, 36, "#1d4ed8", "#1e3a8a"]}
      position={[0, -0.01, 0]}
    />
  );
}

function Tower({ x, z, value, color, label, display }: {
  x: number; z: number; value: number; color: string; label: string; display: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const height = 0.6 + value * 3.2;
  useFrame((state) => {
    if (ref.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.6 + x + z) * 0.04;
      ref.current.scale.y = pulse;
    }
  });
  return (
    <group position={[x, 0, z]}>
      {/* base ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[0.5, 0.6, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* tower */}
      <mesh ref={ref} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.32, 0.4, height, 6, 1, false]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.9}
          transparent
          opacity={0.78}
          metalness={0.6}
          roughness={0.25}
        />
      </mesh>
      {/* wireframe overlay */}
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.33, 0.41, height, 6, 6, false]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.35} />
      </mesh>
      {/* floating data orb */}
      <Float speed={2} rotationIntensity={0.4} floatIntensity={1.2}>
        <mesh position={[0, height + 0.5, 0]}>
          <icosahedronGeometry args={[0.16, 0]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.6} />
        </mesh>
      </Float>
      <Html distanceFactor={9} position={[0, height + 0.95, 0]} center>
        <div
          className="pointer-events-none whitespace-nowrap rounded border bg-background/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest backdrop-blur"
          style={{ borderColor: color, color }}
        >
          {label} · {display}
        </div>
      </Html>
    </group>
  );
}

function CoreHologram() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) {
      ref.current.rotation.y += dt * 0.5;
      ref.current.rotation.x += dt * 0.2;
    }
  });
  return (
    <group ref={ref} position={[0, 2.4, 0]}>
      <mesh>
        <octahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color="#22d3ee" emissive="#22d3ee" emissiveIntensity={1.2} wireframe />
      </mesh>
      <mesh>
        <octahedronGeometry args={[0.5, 0]} />
        <meshStandardMaterial color="#a78bfa" emissive="#a78bfa" emissiveIntensity={1.4} transparent opacity={0.5} />
      </mesh>
    </group>
  );
}

export function DataCitadel3D() {
  const { metrics } = useCitadelMetrics();
  const positions = useMemo(() => {
    const r = 3.2;
    return metrics.map((m, i) => {
      const a = (i / metrics.length) * Math.PI * 2;
      return { ...m, x: Math.cos(a) * r, z: Math.sin(a) * r };
    });
  }, [metrics]);

  return (
    <Canvas
      camera={{ position: [0, 4.2, 8.5], fov: 50 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#02030a"]} />
      <fog attach="fog" args={["#02030a", 8, 20]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[4, 6, 4]} intensity={1.1} color="#a5d8ff" />
      <pointLight position={[-4, 2, -3]} intensity={0.8} color="#a78bfa" />
      <Suspense fallback={null}>
        <Stars radius={60} depth={30} count={3500} factor={3} fade speed={0.8} />
        <GridFloor />
        <CoreHologram />
        {positions.map((p) => (
          <Tower key={p.label} {...p} />
        ))}
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={6}
        maxDistance={14}
        maxPolarAngle={Math.PI / 2.05}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </Canvas>
  );
}
