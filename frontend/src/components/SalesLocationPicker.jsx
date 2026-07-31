import { useEffect, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const markerIcon = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconAnchor: [12, 41] });
const defaultCenter = { lat: 8.959, lng: 77.311 };

function MapSelection({ value, onChange }) {
  const map = useMap();
  useMapEvents({ click: (event) => onChange(event.latlng) });
  useEffect(() => {
    if (value) map.setView(value, Math.max(map.getZoom(), 14));
  }, [map, value]);
  return value ? <Marker position={value} icon={markerIcon} draggable eventHandlers={{ dragend: (event) => onChange(event.target.getLatLng()) }} /> : null;
}

function SalesLocationPicker({ latitude, longitude, onChange }) {
  const selected = Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && latitude !== '' && longitude !== ''
    ? { lat: Number(latitude), lng: Number(longitude) }
    : null;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Search by village or landmark, then click or drag the pin to the farm.');
  const [busy, setBusy] = useState(false);

  const choose = (position) => {
    onChange({ latitude: position.lat.toFixed(6), longitude: position.lng.toFixed(6) });
    setStatus('Farm location selected. Adjust the pin if the caller gives a more precise landmark.');
  };

  const search = async () => {
    if (!query.trim() || busy) return;
    setBusy(true);
    setStatus('Searching…');
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query.trim())}`);
      if (!response.ok) throw new Error('Location search is unavailable.');
      const [match] = await response.json();
      if (!match) throw new Error('Location not found. Add the district or state and try again.');
      choose({ lat: Number(match.lat), lng: Number(match.lon) });
      setStatus(`Found ${match.display_name}. Click the farm position to refine it.`);
    } catch (error) {
      setStatus(error.message || 'Location search failed.');
    } finally {
      setBusy(false);
    }
  };

  const useDeviceLocation = () => {
    if (!navigator.geolocation) { setStatus('This device does not provide location access.'); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => { choose({ lat: position.coords.latitude, lng: position.coords.longitude }); setBusy(false); },
      () => { setStatus('Location permission was not available. Search for the village instead.'); setBusy(false); },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  };

  return (
    <div className="sales-location-picker">
      <div className="sales-location-picker__search">
        <div className="input-group"><label htmlFor="sales-location-search">Search village or landmark</label><input id="sales-location-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void search(); } }} placeholder="For example: Pudupatti, Tenkasi" /></div>
        <button type="button" className="action-btn" onClick={() => void search()} disabled={busy || !query.trim()}>Search map</button>
        <button type="button" className="action-btn" onClick={useDeviceLocation} disabled={busy}>Use this device</button>
      </div>
      <div className="sales-location-picker__map">
        <MapContainer center={selected || defaultCenter} zoom={selected ? 14 : 10} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
          <MapSelection value={selected} onChange={choose} />
        </MapContainer>
      </div>
      <div className={`notice ${selected ? 'notice--success' : 'notice--info'}`} role="status"><span>{status}</span></div>
    </div>
  );
}

export default SalesLocationPicker;
