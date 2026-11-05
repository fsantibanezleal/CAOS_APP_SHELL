export interface Vec3 { x: number; y: number; z: number; }
export interface SceneBounds { min: Vec3; max: Vec3; }
export type DetailTier = 'high' | 'medium' | 'low';
export interface ExplodedPart { id: string; center: Vec3; }
export interface SceneEnvironment {
  background: string;
  ground: string;
  key: { color: string; intensity: number; castShadow: boolean };
  fill: { color: string; intensity: number };
  ambient: { color: string; intensity: number };
}

/** Frame a model from its authored bounds and camera aspect. The margin keeps end geometry out of the frustum. */
export function cameraForBounds(bounds: SceneBounds, aspect: number, fovDegrees = 42, margin = 1.22) {
  const center: Vec3 = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
  const size = {
    x: Math.max(0.01, bounds.max.x - bounds.min.x),
    y: Math.max(0.01, bounds.max.y - bounds.min.y),
    z: Math.max(0.01, bounds.max.z - bounds.min.z),
  };
  const vertical = Math.max(size.y, size.z / Math.max(0.1, aspect));
  const distance = (vertical / 2) / Math.tan((Math.max(10, Math.min(100, fovDegrees)) * Math.PI) / 360) * margin;
  const horizontal = Math.max(size.x, size.z) * 0.76;
  return { target: [center.x, center.y, center.z] as const, position: [center.x + distance * 0.65, center.y + distance * 0.48, center.z + Math.max(distance, horizontal)] as const, distance };
}

/** A bounded, monotone encoding for stream animation; zero flow is static and high rates never become frantic. */
export function flowSpeed(rate: number, referenceRate: number): number {
  if (!Number.isFinite(rate) || !Number.isFinite(referenceRate) || rate <= 0 || referenceRate <= 0) return 0;
  return Math.min(1.25, 0.16 + 0.32 * Math.log1p(rate / referenceRate));
}

/** Stable radial separation for authored cutaway parts, centred on the model bounds. */
export function explodedOffsets(parts: ExplodedPart[], scale = 1): Record<string, Vec3> {
  const finiteScale = Number.isFinite(scale) ? Math.max(0, scale) : 0;
  const center = parts.reduce((sum, part) => ({ x: sum.x + part.center.x, y: sum.y + part.center.y, z: sum.z + part.center.z }), { x: 0, y: 0, z: 0 });
  if (parts.length) { center.x /= parts.length; center.y /= parts.length; center.z /= parts.length; }
  return Object.fromEntries(parts.map(({ id, center: p }) => {
    const dx = p.x - center.x, dy = p.y - center.y, dz = p.z - center.z;
    const magnitude = Math.hypot(dx, dy, dz) || 1;
    return [id, { x: (dx / magnitude) * finiteScale, y: (dy / magnitude) * finiteScale, z: (dz / magnitude) * finiteScale }];
  }));
}

export function detailTier(distance: number): DetailTier {
  if (!Number.isFinite(distance) || distance < 0) return 'high';
  if (distance < 20) return 'high';
  if (distance < 65) return 'medium';
  return 'low';
}

export function sceneEnvironment(theme: 'light' | 'dark'): SceneEnvironment {
  return theme === 'dark'
    ? { background: '#101a22', ground: '#202b33', key: { color: '#fff0d5', intensity: 2.1, castShadow: true }, fill: { color: '#98c5db', intensity: 0.8 }, ambient: { color: '#c9d7df', intensity: 1.1 } }
    : { background: '#e9eef0', ground: '#d6dee1', key: { color: '#fff8e9', intensity: 1.7, castShadow: true }, fill: { color: '#8eabb9', intensity: 0.65 }, ambient: { color: '#ffffff', intensity: 1.35 } };
}
