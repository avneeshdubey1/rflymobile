const operatingCenterRepository = require('../src/repositories/operatingCenterRepository');

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
  const distances = centers
    .map((center) => ({ center, distanceKm: haversineDistanceKm(latitude, longitude, center.latitude, center.longitude) }))
    .sort((left, right) => left.distanceKm - right.distanceKm || left.center.id.localeCompare(right.center.id));
  const matched = distances.find(({ center, distanceKm }) => distanceKm <= center.radiusKm) || null;
  return { matchedCenter: matched?.center || null, distanceKm: matched?.distanceKm ?? null };
}

module.exports = { haversineDistanceKm, evaluate };
