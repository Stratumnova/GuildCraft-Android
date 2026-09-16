import { canonicalHash } from '../simulation/canonicalize.js';

export const CHECKPOINT_KEY = 'market-lab:checkpoint:v1';

export function createCheckpointStore({ storage = globalThis.localStorage, key = CHECKPOINT_KEY } = {}) {
  if (!storage) throw new Error('checkpoint storage is unavailable');

  return {
    async saveCheckpoint(checkpoint) {
      const checksum = await canonicalHash(checkpoint);
      const envelope = { format: 'MARKET_LAB_CHECKPOINT_V1', checksum, checkpoint };
      storage.setItem(key, JSON.stringify(envelope));
      return { ok: true, checksum };
    },

    async loadCheckpoint() {
      const raw = storage.getItem(key);
      if (raw === null) return { ok: false, reason: 'NOT_FOUND' };
      let envelope;
      try {
        envelope = JSON.parse(raw);
      } catch {
        return { ok: false, reason: 'INVALID_JSON', recoverableExport: raw };
      }
      if (!envelope?.checkpoint || typeof envelope.checksum !== 'string') {
        return { ok: false, reason: 'INVALID_ENVELOPE', recoverableExport: raw };
      }
      const checksum = await canonicalHash(envelope.checkpoint);
      if (checksum !== envelope.checksum) {
        return { ok: false, reason: 'CHECKSUM_MISMATCH', recoverableExport: raw };
      }
      return { ok: true, checkpoint: envelope.checkpoint, checksum };
    }
  };
}

const defaultStore = () => createCheckpointStore();
export const saveCheckpoint = checkpoint => defaultStore().saveCheckpoint(checkpoint);
export const loadCheckpoint = () => defaultStore().loadCheckpoint();
