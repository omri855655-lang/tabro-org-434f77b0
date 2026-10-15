export const FOCUS_SEATS = [
  { x: 24, y: 46 }, { x: 50, y: 46 }, { x: 76, y: 46 },
  { x: 24, y: 69 }, { x: 50, y: 69 }, { x: 76, y: 69 },
] as const;

export function occupiedFocusSeat(seat: { x: number; y: number }, people: { x: number; y: number; seated?: boolean; isMe?: boolean }[]) {
  return people.some(person => !person.isMe && person.seated && Math.hypot(person.x - seat.x, person.y - seat.y) < 12);
}

export function clampRoomPosition(position: { x: number; y: number }) {
  return {
    x: Math.min(93, Math.max(7, Number.isFinite(position.x) ? position.x : 50)),
    y: Math.min(77, Math.max(28, Number.isFinite(position.y) ? position.y : 62)),
  };
}
