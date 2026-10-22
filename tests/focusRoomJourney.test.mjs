import assert from 'node:assert/strict';
import test from 'node:test';
import { FOCUS_FLIGHTS, flightPhase, roomJourneyCopy } from '../src/lib/focusRoomJourney.ts';

test('flight focus durations fit the supported session range and phases follow elapsed focus time', () => {
  assert.equal(FOCUS_FLIGHTS.find(route => route.id === 'BCN-LHR').minutes, 135);
  for (const route of FOCUS_FLIGHTS) {
    assert.ok(route.minutes >= 5 && route.minutes <= 180);
    const duration = route.minutes * 60;
    assert.equal(flightPhase(0, duration, false), 12);
    assert.equal(flightPhase(0, duration, true), 13);
    assert.equal(flightPhase(90, duration, true), 14);
    assert.equal(flightPhase(duration, duration, true), 15);
  }
});

test('all six languages cover every environment and flight state', () => {
  assert.deepEqual(Object.keys(roomJourneyCopy).sort(), ['ar','en','es','he','ru','zh']);
  for (const copy of Object.values(roomJourneyCopy)) {
    assert.equal(copy.length, 17);
    assert.ok(copy.every(label => label.trim()));
  }
});
