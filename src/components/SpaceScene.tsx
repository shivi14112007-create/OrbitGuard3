import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import * as THREE from "three";

function Earth() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.08;
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1.6, 64, 64]} />
      <meshStandardMaterial
        color="#1e3a8a"
        emissive="#0b1e4d"
        emissiveIntensity={0.4}
        roughness={0.6}
        metalness={0.3}
        wireframe={false}
      />
      {/* atmosphere */}
      <mesh scale={1.06}>
        <sphereGeometry args={[1.6, 48, 48]} />
        <meshBasicMaterial color="#3b82f6" transparent opacity={0.12} side={THREE.BackSide} />
      </mesh>
      {/* grid overlay */}
      <mesh>
        <sphereGeometry args={[1.61, 32, 32]} />
        <meshBasicMaterial color="#60a5fa" wireframe transparent opacity={0.25} />
      </mesh>
    </mesh>
  );
}

function Satellite({ radius, speed, phase, tilt, label, color = "#22d3ee" }: {
  radius: number; speed: number; phase: number; tilt: number; label: string; color?: string;
}) {
  const group = useRef<THREE.Group>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + phase;
    if (group.current) {
      group.current.position.set(
        Math.cos(t) * radius,
        Math.sin(t) * radius * Math.sin(tilt),
        Math.sin(t) * radius * Math.cos(tilt),
      );
      group.current.rotation.y += 0.02;
    }
  });
  return (
    <group ref={group}>
      <mesh>
        <boxGeometry args={[0.12, 0.12, 0.18]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} metalness={0.8} roughness={0.3} />
      </mesh>
      {/* solar panels */}
      <mesh position={[-0.22, 0, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.14]} />
        <meshStandardMaterial color="#1e293b" emissive="#1d4ed8" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0.22, 0, 0]}>
        <boxGeometry args={[0.3, 0.02, 0.14]} />
        <meshStandardMaterial color="#1e293b" emissive="#1d4ed8" emissiveIntensity={0.3} />
      </mesh>
      <Html distanceFactor={8} position={[0, 0.18, 0]} center>
        <div className="pointer-events-none whitespace-nowrap rounded border border-primary/40 bg-background/70 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary backdrop-blur">
          {label}
        </div>
      </Html>
    </group>
  );
}

function Orbit({ radius, tilt }: { radius: number; tilt: number }) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 128; i++) {
      const a = (i / 128) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(a) * radius,
        Math.sin(a) * radius * Math.sin(tilt),
        Math.sin(a) * radius * Math.cos(tilt),
      ));
    }
    return pts;
  }, [radius, tilt]);
  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  return (
    <primitive object={new THREE.Line(geom, new THREE.LineBasicMaterial({ color: "#38bdf8", transparent: true, opacity: 0.25 }))} />
  );
}

const SATS = [
  { radius: 2.4, speed: 0.5, phase: 0.0, tilt: 0.2, label: "ISRO-CARTOSAT" },
  { radius: 2.8, speed: 0.4, phase: 1.2, tilt: 0.8, label: "GSAT-7A" },
  { radius: 3.2, speed: 0.35, phase: 2.3, tilt: 0.5, label: "RISAT-2B" },
  { radius: 2.6, speed: 0.55, phase: 3.4, tilt: 1.1, label: "INSAT-3DR", color: "#a78bfa" },
  { radius: 3.6, speed: 0.28, phase: 4.5, tilt: 0.3, label: "OCEANSAT-3", color: "#f472b6" },
  { radius: 3.0, speed: 0.45, phase: 5.6, tilt: 0.9, label: "NAVIC-1I" },
  { radius: 2.2, speed: 0.6, phase: 0.7, tilt: 1.3, label: "EOS-06", color: "#facc15" },
  { radius: 3.4, speed: 0.32, phase: 2.9, tilt: 0.6, label: "CHANDRA-PROBE", color: "#34d399" },
];

export function SpaceScene() {
  return (
    <Canvas
      camera={{ position: [0, 1.8, 6.5], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
      style={{ position: "absolute", inset: 0 }}
    >
      <color attach="background" args={["#02030a"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} color="#a5d8ff" />
      <pointLight position={[-5, -2, -3]} intensity={0.6} color="#7c3aed" />
      <Suspense fallback={null}>
        <Stars radius={80} depth={40} count={6000} factor={4} fade speed={1} />
        <Earth />
        {SATS.map((s, i) => (
          <group key={i}>
            <Orbit radius={s.radius} tilt={s.tilt} />
            <Satellite {...s} />
          </group>
        ))}
      </Suspense>
      <OrbitControls
        enablePan={false}
        enableZoom
        minDistance={4}
        maxDistance={12}
        autoRotate
        autoRotateSpeed={0.4}
      />
    </Canvas>
  );
}
