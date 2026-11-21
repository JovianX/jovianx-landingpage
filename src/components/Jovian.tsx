import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { planetRadius, polarSquash } from "../layout";

const TILT = -0.78;
const LONGITUDE = -0.76;
// System III, sped up so one Jovian day lasts about two minutes.
const SPIN = 0.045;

const VERT = `
  uniform float flatten;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUv;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec3 n = mat3(modelMatrix) * normal;
    n.y /= flatten * flatten;
    vNormal = normalize(n);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FRAG = `
  uniform sampler2D map;
  uniform float time;
  uniform float spinRate;
  varying vec3 vNormal;
  varying vec3 vWorld;
  varying vec2 vUv;

  const vec2 EYE = vec2(0.3644, 0.3800);

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.zyx + 31.32);
    return fract((p.x + p.y) * p.z);
  }

  float vnoise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash13(i), hash13(i + vec3(1.0, 0.0, 0.0)), f.x),
          mix(hash13(i + vec3(0.0, 1.0, 0.0)), hash13(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
      mix(mix(hash13(i + vec3(0.0, 0.0, 1.0)), hash13(i + vec3(1.0, 0.0, 1.0)), f.x),
          mix(hash13(i + vec3(0.0, 1.0, 1.0)), hash13(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
      f.z);
  }

  float cn(float lon, float y, float freq) {
    float a = lon * 6.28318530718;
    return vnoise(vec3(cos(a) * freq, y, sin(a) * freq));
  }

  float jet(float lat, float center, float speed, float width) {
    float d = (lat - center) / width;
    return speed * exp(-d * d);
  }

  // Eastward wind in m/s relative to System III. Cassini-era jets.
  float eastward(float lat) {
    return jet(lat, 0.0, 125.0, 6.5)
      + jet(lat, 18.0, -42.0, 1.7)
      + jet(lat, 23.0, 140.0, 1.9)
      + jet(lat, 30.0, -30.0, 1.7)
      + jet(lat, 36.0, 42.0, 1.8)
      + jet(lat, 43.0, 25.0, 2.0)
      + jet(lat, -17.5, -68.0, 1.7)
      + jet(lat, -23.8, 48.0, 1.5)
      + jet(lat, -32.0, 36.0, 1.9)
      + jet(lat, -39.0, -24.0, 1.7)
      + jet(lat, -47.0, 20.0, 2.2);
  }

  // Longitude turns per second. Same time scale as the planet's spin.
  float driftRate(float lat) {
    float parallel = max(cos(radians(lat)), 0.28);
    return spinRate * eastward(lat) * 1.266e-5 / parallel;
  }

  void main() {
    float latDeg = (vUv.y - 0.5) * 180.0;
    float lon = vUv.x;
    float lat = vUv.y;
    float eyeLat = (EYE.y - 0.5) * 180.0;
    float eyeShift = driftRate(eyeLat) * time;
    float eyeLon = fract(EYE.x + eyeShift);
    vec2 rel = vec2(fract(lon - eyeLon + 0.5) - 0.5, lat - EYE.y);
    vec2 deg = vec2(rel.x * 360.0, rel.y * 180.0);
    float radius = length(deg);
    // Quiet core, fast collar, gone outside the spot. One circuit is five days.
    float inside = smoothstep(10.5, 6.2, radius);
    float collar = smoothstep(1.4, 5.2, radius) * inside;
    float turn = collar * time * spinRate * 0.0827;
    float cs = cos(turn);
    float sn = sin(turn);
    vec2 srcDeg = vec2(cs * deg.x + sn * deg.y, -sn * deg.x + cs * deg.y);
    vec2 eyeSrc = vec2(EYE.x + srcDeg.x / 360.0, EYE.y + srcDeg.y / 180.0);
    float drift = driftRate(latDeg) * time;
    float calm = 1.0 - inside;
    float billow = cn(lon - drift, lat * 8.0, 2.2);
    vec2 zonal = vec2(
      fract(lon - drift + (billow - 0.5) * 0.003 * calm),
      lat + (billow - 0.5) * 0.004 * calm
    );
    float du = fract(eyeSrc.x - zonal.x + 0.5) - 0.5;
    vec2 uv = vec2(fract(zonal.x + du * inside), mix(zonal.y, eyeSrc.y, inside));
    vec3 albedo = texture2D(map, uv).rgb;
    float seam = smoothstep(0.016, 0.0, min(uv.x, 1.0 - uv.x));
    vec3 across = 0.5 * (
      texture2D(map, vec2(fract(uv.x + 0.007), uv.y)).rgb +
      texture2D(map, vec2(fract(uv.x - 0.007), uv.y)).rgb
    );
    albedo = mix(albedo, across, seam);
    vec3 blur = (
      texture2D(map, uv + vec2(0.0007, 0.0)).rgb +
      texture2D(map, uv + vec2(-0.0007, 0.0)).rgb +
      texture2D(map, uv + vec2(0.0, 0.0014)).rgb +
      texture2D(map, uv + vec2(0.0, -0.0014)).rgb
    ) * 0.25;
    albedo = clamp(albedo + (albedo - blur) * 0.4 * (1.0 - seam), 0.0, 1.0);
    albedo *= vec3(1.04, 0.97, 0.9);
    albedo = pow(max(albedo, 0.0), vec3(1.04));

    vec3 geometric = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float height = dot(albedo, vec3(0.2, 0.71, 0.09));
    vec3 dpdx = dFdx(vWorld);
    vec3 dpdy = dFdy(vWorld);
    vec3 normal = normalize(geometric - 1.35 * (
      cross(dpdy, geometric) * dFdx(height) + cross(geometric, dpdx) * dFdy(height)
    ));
    float facing = clamp(dot(geometric, viewDir), 0.0, 1.0);
    normal = normalize(mix(geometric, normal, smoothstep(0.02, 0.45, facing)));

    vec3 lightDir = normalize(vec3(-0.28, 0.62, 0.68));
    float incidence = clamp(dot(normal, lightDir), 0.0, 1.0);
    float wrap = pow(clamp(incidence * 0.88 + 0.12, 0.0, 1.0), 0.85);
    float limb = pow(facing, 0.48);
    vec3 color = albedo * wrap * limb;
    color *= mix(vec3(0.78, 0.88, 1.06), vec3(1.0), smoothstep(0.0, 0.35, facing));
    gl_FragColor = linearToOutputTexel(vec4(color, 1.0));
  }
`;

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
  const elapsed = useRef(0);
  const still = useStill();
  const viewport = useThree((state) => state.viewport);
  const gl = useThree((state) => state.gl);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    const loader = new THREE.TextureLoader();
    let map: THREE.Texture | null = null;
    let cancel = false;
    loader.load("/jupiter.jpg", (next) => {
      if (cancel) {
        next.dispose();
        return;
      }
      next.colorSpace = THREE.SRGBColorSpace;
      next.wrapS = THREE.RepeatWrapping;
      next.anisotropy = gl.capabilities.getMaxAnisotropy();
      next.minFilter = THREE.LinearMipmapLinearFilter;
      next.magFilter = THREE.LinearFilter;
      map = next;
      setTexture(next);
    });
    return () => {
      cancel = true;
      map?.dispose();
    };
  }, [gl]);

  const surface = useMemo(() => {
    if (!texture) return null;
    return new THREE.ShaderMaterial({
      uniforms: {
        map: { value: texture },
        time: { value: 0 },
        spinRate: { value: SPIN },
        flatten: { value: polarSquash },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      toneMapped: false,
    });
  }, [texture]);

  useEffect(
    () => () => {
      surface?.dispose();
    },
    [surface],
  );

  useFrame((_, delta) => {
    if (surface) surface.uniforms.time.value = elapsed.current;
    if (still || !spin.current) return;
    elapsed.current += delta;
    spin.current.rotation.y += delta * SPIN;
  });

  const radius = planetRadius(viewport.width, viewport.height);
  const y = -viewport.height / 2;
  if (!surface) return null;

  return (
    <group position={[0, y, 0]} scale={[1, polarSquash, 1]}>
      <group rotation={[TILT, 0, 0]}>
        <group ref={spin} rotation={[0, LONGITUDE, 0]}>
          <mesh material={surface}>
            <sphereGeometry args={[radius, 192, 144]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

export function Jovian() {
  return (
    <div className="jovian" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0.1, 11], fov: 30 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
      >
        <Body />
      </Canvas>
    </div>
  );
}
