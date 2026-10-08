export const PAINTS = [
  { color: '#668d83', name: '鼠尾草绿' },
  { color: '#a31e22', name: '经典红' },
  { color: '#e7e3d8', name: '珍珠白' },
  { color: '#283538', name: '石墨黑' },
  { color: '#d6ad50', name: '香槟金' },
] as const;

export interface Settings {
  realisticControls: boolean;
  paint: string;
  headlights: boolean;
  quality: 'high' | 'smooth';
  mirrorsExpanded: boolean;
}
export const DEFAULT_SETTINGS: Settings = {
  realisticControls: false,
  paint: PAINTS[0].color,
  headlights: false,
  quality: 'high',
  mirrorsExpanded: true,
};
export const SETTINGS_KEY = 'larria.settings.v1';

/** Only recognized fields and values survive; never persist vehicle or exam state. */
export function validateSettings(value: unknown): Settings {
  const result = { ...DEFAULT_SETTINGS };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  const record = value as Record<string, unknown>;
  if (record.version !== 1) return result;
  if (typeof record.realisticControls === 'boolean') result.realisticControls = record.realisticControls;
  if (typeof record.paint === 'string' && PAINTS.some(item => item.color === record.paint)) result.paint = record.paint;
  if (typeof record.headlights === 'boolean') result.headlights = record.headlights;
  if (record.quality === 'high' || record.quality === 'smooth') result.quality = record.quality;
  if (typeof record.mirrorsExpanded === 'boolean') result.mirrorsExpanded = record.mirrorsExpanded;
  return result;
}

export function createSettingsStore(storage?: Pick<Storage, 'getItem' | 'setItem'>) {
  let current = { ...DEFAULT_SETTINGS };
  try {
    const source = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
    const raw = source?.getItem(SETTINGS_KEY);
    if (raw) current = validateSettings(JSON.parse(raw));
  } catch { /* Private browsing, denied storage, or corrupt JSON: use memory. */ }
  return {
    get: (): Settings => ({ ...current }),
    update(patch: Partial<Settings>): Settings {
      current = validateSettings({ ...current, ...patch, version: 1 });
      try {
        const target = storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage);
        target?.setItem(SETTINGS_KEY, JSON.stringify({ version: 1, ...current }));
      } catch { /* Keep the new preference in memory even if writes fail. */ }
      return { ...current };
    },
  };
}
