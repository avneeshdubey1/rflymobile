import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    }
  });

  return position === null ? null : (
    <Marker position={position} draggable={true} eventHandlers={{
      dragend: (e) => setPosition(e.target.getLatLng())
    }} />
  );
}

function MapUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom() || 13);
    }
  }, [position, map]);
  return null;
}

export default function TerrainMap({ onLocationChange, onTerrainCalculated }) {
  const [position, setPosition] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [terrain, setTerrain] = useState('');

  // Auto calculate terrain when position changes
  useEffect(() => {
    if (!position) return;
    onLocationChange(`${position.lat},${position.lng}`);
    calculateTerrain(position);
  }, [position]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        setPosition({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
      } else {
        alert('Location not found.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLoading(false);
    }, () => {
      alert('Unable to retrieve your location.');
      setLoading(false);
    });
  };

  const calculateTerrain = async (pos) => {
    try {
      const lat = pos.lat;
      const lng = pos.lng;
      // offset roughly 100 meters
      const offset = 0.0009;
      const points = [
        `${lat},${lng}`,
        `${lat + offset},${lng}`,
        `${lat - offset},${lng}`,
        `${lat},${lng + offset}`,
        `${lat},${lng - offset}`
      ];
      
      const res = await fetch(`https://api.opentopodata.org/v1/srtm90m?locations=${points.join('|')}`);
      const data = await res.json();
      
      if (data && data.results) {
        const elevations = data.results.map(r => r.elevation).filter(e => e !== null);
        if (elevations.length > 0) {
          const max = Math.max(...elevations);
          const min = Math.min(...elevations);
          const diff = max - min;
          
          let tType = 'Flatland';
          if (diff > 50) tType = 'Mountainous';
          else if (diff > 15) tType = 'Hilly';

          setTerrain(tType);
          if (onTerrainCalculated) onTerrainCalculated(tType);
        }
      }
    } catch (err) {
      console.error('Terrain calculation failed:', err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input 
          type="text" 
          placeholder="Search location (e.g. Tenkasi)..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch(e)}
          style={{ flex: 1, padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button type="button" onClick={handleSearch} disabled={loading} style={{ padding: '0.5rem 1rem', background: '#e0e0e0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Search
        </button>
        <button type="button" onClick={getGPS} disabled={loading} style={{ padding: '0.5rem 1rem', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          📍 GPS
        </button>
      </div>

      <div style={{ height: '300px', width: '100%', border: '1px solid #ccc', borderRadius: '4px', overflow: 'hidden', position: 'relative', zIndex: 0 }}>
        <MapContainer center={[20.5937, 78.9629]} zoom={5} style={{ height: '100%', width: '100%' }}>
          {/* OpenTopoMap Terrain Tiles */}
          <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            attribution="Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap"
            maxZoom={17}
          />
          <LocationMarker position={position} setPosition={setPosition} />
          {position && <MapUpdater position={position} />}
        </MapContainer>
      </div>

      {terrain && (
        <div style={{ fontSize: '0.9rem', color: '#666', background: '#f5f5f5', padding: '0.5rem', borderRadius: '4px' }}>
          <strong>Detected Terrain:</strong> {terrain}
          {terrain === 'Mountainous' && <span style={{ color: 'red', marginLeft: '0.5rem' }}>(High Terrain Risk)</span>}
        </div>
      )}
    </div>
  );
}
