const fetch = require('node-fetch');

const token = 'b5c86685-8c72-4c24-bec5-c20deec3a2a6';
const baseUrl = 'https://api.bhumeet.in';

const endpoints = [
  '/flights',
  '/api/flights',
  '/api/v1/flights',
  '/v1/flights'
];

async function testEndpoints() {
  for (const ep of endpoints) {
    const url = `${baseUrl}${ep}`;
    console.log(`Testing ${url}...`);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      });
      console.log(`  -> Status: ${response.status}`);
      if (response.ok) {
        const text = await response.text();
        console.log(`  -> Success! First 100 chars: ${text.substring(0, 100)}`);
      }
    } catch (err) {
      console.log(`  -> Error: ${err.message}`);
    }
  }
}

testEndpoints();
