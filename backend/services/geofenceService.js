const operatingCenterRepository = require('../src/repositories/operatingCenterRepository');
const pricingConfigRepository = require('../src/repositories/pricingConfigRepository');

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees) => degrees * (Math.PI / 180);

function haversineDistanceKm(latitudeA, longitudeA, latitudeB, longitudeB) {
  const deltaLatitude = toRadians(latitudeB - latitudeA);
  const deltaLongitude = toRadians(longitudeB - longitudeA);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(deltaLongitude / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function evaluate(latitude, longitude) {
  const centers = await operatingCenterRepository.findAll({ active: true });
  const distances = centers.map((center) => ({ center, distanceKm: haversineDistanceKm(latitude, longitude, center.latitude, center.longitude) }));
  const matched = distances.find(({ center, distanceKm }) => distanceKm <= center.radiusKm);
  const nearest = distances.sort((a, b) => a.distanceKm - b.distanceKm)[0] || null;
  return { matchedCenter: matched?.center || null, nearestCenter: nearest?.center || null, distanceKm: matched?.distanceKm ?? nearest?.distanceKm ?? null };
}

async function suggestedAppealFee(distanceKm, center) {
  if (!center || distanceKm === null) return null;
  const rate = await pricingConfigRepository.findByKey('OUT_OF_RANGE_RATE_PER_KM');
  const excessKm = Math.max(0, distanceKm - center.radiusKm);
  return { excessKm, suggestedFee: rate ? excessKm * rate.value : null };
}

module.exports = { haversineDistanceKm, evaluate, suggestedAppealFee };
