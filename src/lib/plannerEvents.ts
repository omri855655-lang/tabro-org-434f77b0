export interface PlannerEventLike {
  startTime: string;
  endTime: string;
}

export const eventOverlapsRange = (
  event: PlannerEventLike,
  rangeStart: Date,
  rangeEnd: Date
): boolean => {
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);
  if (Number.isNaN(eventStart.getTime()) || Number.isNaN(eventEnd.getTime())) return false;
  return eventStart <= rangeEnd && eventEnd >= rangeStart;
};

