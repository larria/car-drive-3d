export const PAINTS = [
  { color: '#668d83', name: '鼠尾草绿' },
  { color: '#a31e22', name: '经典红' },
  { color: '#e7e3d8', name: '珍珠白' },
  { color: '#283538', name: '石墨黑' },
  { color: '#d6ad50', name: '香槟金' },
] as const;

export const SPEED_DEFAULTS = { 'right-angle': 6, 's-curve': 6, 'parallel-parking': 6, 'reverse-garage': 6, practice: 15 };
export const SPEED_MIN = 3;
export const speedMax = (course: SpeedCourse) => course === 'practice' ? 60 : 20;
export type SpeedCourse = keyof typeof SPEED_DEFAULTS;
export interface Settings {
  maxSpeeds: Record<SpeedCourse, number>;
  realisticControls: boolean;
  paint: string;
  headlights: boolean;
  quality: 'high' | 'smooth';
  mirrorsExpanded: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  maxSpeeds: SPEED_DEFAULTS,
  realisticControls: false,
  paint: PAINTS[0].color,
  headlights: false,
  quality: 'high',
  mirrorsExpanded: true,
};
export const SETTINGS_KEY = 'larria.settings.v1';

/** Only recognized fields and values survive; never persist vehicle or exam state. */
export function validateSettings(value: unknown): Settings {
  const result = { ...DEFAULT_SETTINGS, maxSpeeds: { ...SPEED_DEFAULTS } };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return result;
  if (typeof record.realisticControls === 'boolean') result.realisticControls = record.realisticControls;
  if (typeof record.paint === 'string' && PAINTS.some(item => item.color === record.paint)) result.paint = record.paint;
  if (typeof record.headlights === 'boolean') result.headlights = record.headlights;
  if (record.quality === 'high' || record.quality === 'smooth') result.quality = record.quality;
  if (typeof record.mirrorsExpanded === 'boolean') result.mirrorsExpanded = record.mirrorsExpanded;
  const speeds = record.maxSpeeds as Record<string, unknown> | undefined;
  if (speeds && typeof speeds === 'object' && !Array.isArray(speeds)) {
    for (const key of Object.keys(SPEED_DEFAULTS) as SpeedCourse[]) {
      const speed = speeds[key];
      if (typeof speed === 'number' && Number.isFinite(speed)) result.maxSpeeds[key] = Math.max(SPEED_MIN, Math.min(speedMax(key), speed));
    }
  }
  return result;
}

export function createSettingsStore(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  let current = validateSettings({version: 1});
  try {
    const source = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
    const raw = source?.getItem(SETTINGS_KEY);
    if (raw) current = validateSettings(JSON.parse(raw));
  } catch { /* Private browsing, denied storage, or corrupt JSON: use memory. */ }
  return {
    get: (): Settings => ({ ...current, maxSpeeds: { ...current.maxSpeeds } }),
    update(patch: Partial<Settings>): Settings {
      current = validateSettings({ ...current, ...patch, version: 1 });
      try {
        const target = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
        target?.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, ...current }));
      } catch { /* Keep the new preference in memory even if writes fail. */ }
      return { ...current, maxSpeeds: { ...current.maxSpeeds } };
    },
  };
}
