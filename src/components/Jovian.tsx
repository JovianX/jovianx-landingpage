import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { planetRadius } from "../layout";

const VERT = `
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = `
  uniform sampler2D map;
  uniform vec3 lightDir;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float lambert = clamp(dot(normal, normalize(lightDir)), 0.0, 1.0);
    float facing = clamp(dot(normal, viewDir), 0.0, 1.0);
    float shade = 0.1 + 0.9 * pow(lambert, 0.8);
    float limb = mix(0.42, 1.0, pow(facing, 0.8));
    vec3 tex = texture2D(map, vUv).rgb;
    vec3 color = tex * shade * mix(0.18, 1.0, limb);
    gl_FragColor = linearToOutputTexel(vec4(color, 1.0));
  }
`;

const STOPS: Array<[number, [number, number, number]]> = [
  [0, [206, 190, 166]],
  [0.05, [228, 210, 182]],
  [0.08, [168, 112, 68]],
  [0.11, [242, 232, 214]],
  [0.135, [146, 90, 54]],
  [0.16, [214, 176, 128]],
  [0.19, [236, 220, 196]],
  [0.215, [132, 74, 46]],
  [0.245, [196, 142, 92]],
  [0.275, [244, 232, 212]],
  [0.305, [160, 98, 58]],
  [0.335, [112, 62, 40]],
  [0.37, [226, 204, 168]],
  [0.41, [176, 114, 70]],
  [0.46, [236, 216, 184]],
  [0.52, [150, 88, 52]],
  [0.6, [214, 174, 128]],
  [0.7, [164, 110, 70]],
  [0.82, [210, 176, 136]],
  [1, [188, 156, 120]],
];

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function noise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function sample(lat: number) {
  let index = 0;
  while (index < STOPS.length - 2 && STOPS[index + 1][0] < lat) index += 1;
  const [start, from] = STOPS[index];
  const [end, to] = STOPS[index + 1];
  const t = Math.max(0, Math.min(1, (lat - start) / (end - start)));
  const sharp = 0.5 + 0.5 * Math.tanh((t - 0.5) * 7);
  return [
    from[0] + (to[0] - from[0]) * sharp,
    from[1] + (to[1] - from[1]) * sharp,
    from[2] + (to[2] - from[2]) * sharp,
  ] as const;
}

function paintJovian() {
  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const image = ctx.createImageData(width, height);
  const data = image.data;
  for (let y = 0; y < height; y += 1) {
    const lat = y / height;
    for (let x = 0; x < width; x += 1) {
      const angle = (x / width) * Math.PI * 2;
      const nx = Math.cos(angle);
      const nz = Math.sin(angle);
      const shear = noise(nx * 2.4, lat * 6) * 0.62 + noise(nz * 2.4, lat * 6) * 0.38 - 0.5;
      const filament =
        noise(nx * 7.5 + lat * 3, lat * 64) * 0.62 + noise(nz * 7.5, lat * 64) * 0.38 - 0.5;
      const polar = Math.pow(Math.max(0, 1 - lat * 8), 2);
      const [r, g, b] = sample(lat + shear * 0.012 * (1 - polar));
      const grain = (filament * 42 + shear * 16) * (1 - polar);
      const i = (y * width + x) * 4;
      data[i] = Math.max(0, Math.min(255, r + grain));
      data[i + 1] = Math.max(0, Math.min(255, g + grain * 0.82));
      data[i + 2] = Math.max(0, Math.min(255, b + grain * 0.5));
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  storm(ctx, width * 0.25, height * 0.3, 54, 26, "#9a3a28", "#e2b090");
  storm(ctx, width * 0.72, height * 0.2, 22, 12, "#f4efe6", "#d2b48a");
  return canvas;
}

function storm(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  core: string,
  edge: string,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  ctx.globalCompositeOperation = "soft-light";
  ctx.globalAlpha = 0.85;
  const glow = ctx.createRadialGradient(-rx * 0.2, 0, ry * 0.15, 0, 0, rx);
  glow.addColorStop(0, core);
  glow.addColorStop(0.7, edge);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function useStill() {
  const [still, setStill] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setStill(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return still;
}

function Body() {
  const spin = useRef<THREE.Group>(null);
  const still = useStill();
  const viewport = useThree((state) => state.viewport);
  const gl = useThree((state) => state.gl);
  const texture = useMemo(() => {
    const map = new THREE.CanvasTexture(paintJovian());
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = gl.capabilities.getMaxAnisotropy();
    map.generateMipmaps = false;
    map.minFilter = THREE.LinearFilter;
    map.magFilter = THREE.LinearFilter;
    return map;
  }, [gl]);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          map: { value: texture },
          lightDir: { value: new THREE.Vector3(0.12, 0.92, 0.42).normalize() },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
      }),
    [texture],
  );

  useEffect(
    () => () => {
      texture.dispose();
      material.dispose();
    },
    [texture, material],
  );

  useFrame((_, delta) => {
    if (still || !spin.current) return;
    spin.current.rotation.y += delta * 0.045;
  });

  const radius = planetRadius(viewport.width, viewport.height);
  const y = -viewport.height / 2;

  return (
    <group position={[0, y, 0]}>
      <group ref={spin} rotation={[0.04, 0.15, 0]}>
        <mesh material={material}>
          <sphereGeometry args={[radius, 160, 120]} />
        </mesh>
      </group>
    </group>
  );
}

export function Jovian() {
  return (
    <div className="jovian" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0.1, 11], fov: 30 }}
        dpr={[1, 1.75]}
        gl={{ alpha: true, antialias: true }}
      >
        <Body />
      </Canvas>
    </div>
  );
}
