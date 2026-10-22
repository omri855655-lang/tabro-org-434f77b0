import { clampRoomPosition } from './focusRoom.ts';
import type { FocusRoomParticipant } from '../components/zoneflow/FocusRoomInterior';

// Presence is client-supplied display data, never an authorization decision.
export function normalizeFocusPresence(state: unknown, me: FocusRoomParticipant): FocusRoomParticipant[] {
  const people = new Map<string, { person: FocusRoomParticipant; timestamp: number }>();
  if (state && typeof state === 'object' && !Array.isArray(state)) {
    for (const entries of Object.values(state)) {
      if (!Array.isArray(entries)) continue;
      for (const value of entries) {
        if (!value || typeof value !== 'object' || typeof value.userId !== 'string' || !value.userId || value.userId.length > 128 || value.userId === me.userId) continue;
        const timestamp = typeof value.onlineAt === 'string' ? Date.parse(value.onlineAt) || 0 : 0;
        if ((people.get(value.userId)?.timestamp ?? -Infinity) > timestamp) continue;
        people.set(value.userId, { timestamp, person: {
          userId: value.userId, displayName: typeof value.displayName === 'string' ? value.displayName.slice(0, 80) : 'Tabro learner',
          ...clampRoomPosition({ x: value.x, y: value.y }),
          status: ['focusing', 'break', 'away'].includes(value.status) ? value.status : 'setting-up',
          avatarStyle: Number.isInteger(value.avatarStyle) && value.avatarStyle >= 0 ? value.avatarStyle % 8 : 0,
          activity: value.activity === 'book' || value.activity === 'notebook' ? value.activity : 'computer',
          seated: value.seated === true, durationMinutes: Math.min(240, Math.max(1, Number(value.durationMinutes) || 25)),
          isMe: false,
        } });
      }
    }
  }
  return [...people.values()].map(entry => entry.person).concat({ ...me, isMe: true });
}
