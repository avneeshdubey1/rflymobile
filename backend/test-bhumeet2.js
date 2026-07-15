const fetch = require('node-fetch');

const token = 'b5c86685-8c72-4c24-bec5-c20deec3a2a6';
const baseUrls = ['https://api.bhumeet.in', 'https://api.bhumeet.app', 'https://bhumeet.app/api', 'https://bhumeet.in/api'];
const endpoints = [
  '/flights',
  '/flight',
  '/api/flights',
  '/api/v1/flights'
];

async function testEndpoints() {
  for (const base of baseUrls) {
    for (const ep of endpoints) {
      const url = `${base}${ep}`;
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          },
          timeout: 3000
        });
        console.log(`[${response.status}] ${url}`);
        if (response.ok) {
          console.log('SUCCESS! Found the correct URL.');
          return;
        }
      } catch (err) {
        console.log(`[ERR] ${url} - ${err.message}`);
      }
    }
  }
}

testEndpoints();
