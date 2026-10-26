export type DeviceTier = 'constrained' | 'standard';

export type DeviceSignals = {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  coarsePointer?: boolean;
  mobileUA?: boolean;
};

type Size = { width: number; height: number };

export function readDeviceSignals(): DeviceSignals {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator as Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean } };
  let coarsePointer = false;
  try { coarsePointer = window.matchMedia('(pointer: coarse)').matches; } catch { /* matchMedia unavailable */ }
  return {
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    coarsePointer,
    mobileUA: nav.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent || ''),
  };
}

/** Phones and low-memory machines cannot hold 4K frame buffers or software-encode 1080p at usable speed. */
export function deviceTier(signals: DeviceSignals = readDeviceSignals()): DeviceTier {
  if (signals.mobileUA || signals.coarsePointer) return 'constrained';
  if (signals.deviceMemory !== undefined && signals.deviceMemory <= 4) return 'constrained';
  if (signals.hardwareConcurrency !== undefined && signals.hardwareConcurrency <= 4) return 'constrained';
  return 'standard';
}

export function exportCaps(tier: DeviceTier): { hardware: Size; software: Size } {
  return tier === 'constrained'
    ? { hardware: { width: 1920, height: 1080 }, software: { width: 1280, height: 720 } }
    : { hardware: { width: 4096, height: 4096 }, software: { width: 1920, height: 1080 } };
}
