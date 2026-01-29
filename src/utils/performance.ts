export type PerformanceTier = 'superUltra' | 'ultra' | 'high' | 'medium' | 'low' | 'potato';

export interface TierConfig {
  name: PerformanceTier;
  fps: number;
  label: string;
}

export const TIERS: TierConfig[] = [
  { name: 'superUltra', fps: 480, label: '🚀 SUPER ULTRA' },
  { name: 'ultra', fps: 240, label: '⚡ ULTRA' },
  { name: 'high', fps: 120, label: '✨ HIGH' },
  { name: 'medium', fps: 60, label: '● MEDIUM' },
  { name: 'low', fps: 30, label: '◐ LOW' },
  { name: 'potato', fps: 15, label: '🥔 POTATO' },
];

export const TIER_COLORS: Record<PerformanceTier, string> = {
  superUltra: '#f0abfc',
  ultra: '#c084fc',
  high: '#22d3ee',
  medium: '#4ade80',
  low: '#fbbf24',
  potato: '#f87171',
};

export function getTierByName(name: PerformanceTier): TierConfig {
  return TIERS.find(t => t.name === name) || TIERS[3]; // Default to medium
}

export function getTierIndex(name: PerformanceTier): number {
  return TIERS.findIndex(t => t.name === name);
}

export function getNextHigherTier(current: PerformanceTier): TierConfig | null {
  const index = getTierIndex(current);
  return index > 0 ? TIERS[index - 1] : null;
}

export function getNextLowerTier(current: PerformanceTier): TierConfig | null {
  const index = getTierIndex(current);
  return index < TIERS.length - 1 ? TIERS[index + 1] : null;
}

export function detectDeviceCapabilities(): { isMobile: boolean; lowMemory: boolean } {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const lowMemory = 'deviceMemory' in navigator && (navigator as { deviceMemory?: number }).deviceMemory! < 4;

  return { isMobile, lowMemory };
}

export function getTierFromRefreshRate(hz: number): TierConfig {
  if (hz >= 400) return TIERS[0]; // superUltra
  if (hz >= 200) return TIERS[1]; // ultra
  if (hz >= 100) return TIERS[2]; // high
  return TIERS[3]; // medium
}
