export const CLOUD_PROVIDER_IDS = Object.freeze([
  "hapoalim",
  "leumi",
  "mizrahi",
  "discount",
  "mercantile",
  "otsarHahayal",
  "beinleumi",
  "massad",
  "yahav",
  "pagi",
  "max",
  "visaCal",
  "isracard",
  "amex",
  "beyahadBishvilha",
  "behatsdaa",
]);

export function credentialsForScraper(companyId, credentials) {
  if (companyId !== "yahav" || credentials.num || !credentials.username) return credentials;
  const { username, ...rest } = credentials;
  return { ...rest, num: username };
}
