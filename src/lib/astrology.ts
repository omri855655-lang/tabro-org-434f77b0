import { Body, Ecliptic, GeoVector } from "astronomy-engine";

export const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

const PLANETS = [
  { id: "sun", name: "Sun", body: Body.Sun },
  { id: "moon", name: "Moon", body: Body.Moon },
  { id: "mercury", name: "Mercury", body: Body.Mercury },
  { id: "venus", name: "Venus", body: Body.Venus },
  { id: "mars", name: "Mars", body: Body.Mars },
  { id: "jupiter", name: "Jupiter", body: Body.Jupiter },
  { id: "saturn", name: "Saturn", body: Body.Saturn },
  { id: "uranus", name: "Uranus", body: Body.Uranus },
  { id: "neptune", name: "Neptune", body: Body.Neptune },
  { id: "pluto", name: "Pluto", body: Body.Pluto },
] as const;

export interface BirthChartInput {
  birthDate: string;
  birthTime: string;
  utcOffsetMinutes: number;
}

export interface BirthChartPlanet {
  id: string;
  name: string;
  longitude: number;
  sign: typeof ZODIAC_SIGNS[number];
  degree: number;
}

export interface BirthChartAspect {
  left: string;
  right: string;
  type: "Conjunction" | "Sextile" | "Square" | "Trine" | "Opposition";
  orb: number;
}

const normalizeDegrees = (value: number) => ((value % 360) + 360) % 360;

const localBirthToUtc = ({ birthDate, birthTime, utcOffsetMinutes }: BirthChartInput) => {
  const [year, month, day] = birthDate.split("-").map(Number);
  const [hours, minutes] = (birthTime || "12:00").split(":").map(Number);
  const offset = Number.isFinite(utcOffsetMinutes) ? utcOffsetMinutes : 0;
  return new Date(Date.UTC(year, month - 1, day, hours, minutes) - offset * 60_000);
};

export const calculateBirthChart = (input: BirthChartInput) => {
  if (!input.birthDate) return null;

  const instant = localBirthToUtc(input);
  if (Number.isNaN(instant.getTime())) return null;
  const planets: BirthChartPlanet[] = PLANETS.flatMap((planet) => {
    try {
      // Birth charts use the apparent geocentric position as seen from Earth.
      const longitude = normalizeDegrees(Ecliptic(GeoVector(planet.body, instant, true)).elon);
      const signIndex = Math.floor(longitude / 30);
      return [{
        id: planet.id,
        name: planet.name,
        longitude,
        sign: ZODIAC_SIGNS[signIndex],
        degree: longitude % 30,
      }];
    } catch (error) {
      console.warn(`Could not calculate ${planet.name} position`, error);
      return [];
    }
  });

  const aspectDefinitions = [
    { type: "Conjunction" as const, angle: 0, orb: 7 },
    { type: "Sextile" as const, angle: 60, orb: 5 },
    { type: "Square" as const, angle: 90, orb: 6 },
    { type: "Trine" as const, angle: 120, orb: 6 },
    { type: "Opposition" as const, angle: 180, orb: 7 },
  ];
  const aspects: BirthChartAspect[] = [];

  for (let leftIndex = 0; leftIndex < planets.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < planets.length; rightIndex += 1) {
      const difference = Math.abs(planets[leftIndex].longitude - planets[rightIndex].longitude);
      const separation = Math.min(difference, 360 - difference);
      const match = aspectDefinitions.find((aspect) => Math.abs(separation - aspect.angle) <= aspect.orb);
      if (match) {
        aspects.push({
          left: planets[leftIndex].name,
          right: planets[rightIndex].name,
          type: match.type,
          orb: Number(Math.abs(separation - match.angle).toFixed(1)),
        });
      }
    }
  }

  return { instant, planets, aspects: aspects.slice(0, 8) };
};
