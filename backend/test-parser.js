const { extractCoordinatesFromLink } = require('./services/locationParser');
async function run() {
  const result = await extractCoordinatesFromLink('https://maps.app.goo.gl/Lxzc7n99w9NnWGdx6');
  console.log('Parsed coordinates:', result);
}
run().catch(console.error);
