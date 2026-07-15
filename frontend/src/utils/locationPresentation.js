const COORDINATE_PAIR = /(?:^|[^\d.-])(-?\d{1,2}(?:\.\d+)?)\s*[,;]\s*(-?\d{1,3}(?:\.\d+)?)(?:[^\d.]|$)/;

function validCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}

export function extractCoordinates({ latitude, longitude, address } = {}) {
  const direct = validCoordinates(latitude, longitude);
  if (direct) return direct;
  const match = String(address || '').match(COORDINATE_PAIR);
  return match ? validCoordinates(match[1], match[2]) : null;
}

export function containsCoordinatePair(value) {
  return Boolean(extractCoordinates({ address: value }));
}

function usefulLabel(value) {
  const text = String(value || '').trim();
  if (!text || containsCoordinatePair(text) || /^https?:\/\//i.test(text)) return '';
  if (/^(gps|map|pin|coordinate)/i.test(text)) return '';
  return text;
}

export function describeLocation({ label, address, centerName, farmerName, pilotName, fallback = 'Mapped field location' } = {}) {
  return usefulLabel(label)
    || usefulLabel(address)
    || (centerName ? `Field near ${centerName}` : '')
    || (farmerName ? `${farmerName}'s field` : '')
    || (pilotName ? `Live position - ${pilotName}` : '')
    || fallback;
}

export function googleMapsUrl(location = {}) {
  const coordinates = extractCoordinates(location);
  const query = coordinates
    ? `${coordinates.latitude},${coordinates.longitude}`
    : String(location.address || location.label || '').trim();
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : '';
}

export function openStreetMapEmbedUrl(location = {}) {
  const coordinates = extractCoordinates(location);
  if (!coordinates) return '';
  const delta = 0.008;
  const west = coordinates.longitude - delta;
  const south = coordinates.latitude - delta;
  const east = coordinates.longitude + delta;
  const north = coordinates.latitude + delta;
  const params = new URLSearchParams({
    bbox: `${west},${south},${east},${north}`,
    layer: 'mapnik',
    marker: `${coordinates.latitude},${coordinates.longitude}`,
  });
  return `https://www.openstreetmap.org/export/embed.html?${params.toString()}`;
}
