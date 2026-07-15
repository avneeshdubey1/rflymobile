function parseCoordinates(value) {
  if (typeof value !== 'string') return null;
  const match = value.match(/(?:@|q=|query=|GPS:\s*|place\/|search\/|ll=|^)([+-]?\d{1,2}(?:\.\d+)?)\s*[,%C2%BC]+\s*([+-]?\d{1,3}(?:\.\d+)?)/i);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

async function extractCoordinatesFromLink(link) {
  if (typeof link !== 'string' || !link.trim()) return null;
  
  let coords = parseCoordinates(link);
  if (coords) return coords;

  if (link.startsWith('http')) {
    try {
      const fetch = require('node-fetch');
      let response;
      for (let i = 0; i < 3; i++) {
        try {
          response = await fetch(link, { 
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            redirect: 'follow',
            timeout: 5000
          });
          break;
        } catch (err) {
          if (i === 2) throw err;
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
      coords = parseCoordinates(response.url);
      if (coords) return coords;
      
      const text = await response.text();
      const metaMatch = text.match(/<meta[^>]*http-equiv="refresh"[^>]*url=([^"]+)"/i) || text.match(/window\.location\.replace\(['"]([^'"]+)['"]\)/i);
      if (metaMatch) {
         const nextUrl = metaMatch[1].replace(/&amp;/g, '&');
         coords = parseCoordinates(nextUrl);
         if (coords) return coords;
         
         const nextRes = await fetch(nextUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 });
         coords = parseCoordinates(nextRes.url);
         if (coords) return coords;
      }
    } catch (e) {
      // Ignore network errors and fallback
    }
  }
  return null;
}

module.exports = { parseCoordinates, extractCoordinatesFromLink };
