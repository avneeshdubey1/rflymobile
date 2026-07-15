const pricingConfigRepository = require('../src/repositories/pricingConfigRepository');

let forecastProvider = null;

function setForecastProvider(provider) {
  forecastProvider = provider;
}

async function checkSuitability(latitude, longitude, date) {
  try {
    if (!forecastProvider) throw new Error('Weather provider is not configured');
    const [windConfig, rainConfig, forecast] = await Promise.all([
      pricingConfigRepository.findByKey('WIND_THRESHOLD_KPH'),
      pricingConfigRepository.findByKey('RAIN_PROBABILITY_THRESHOLD_PCT'),
      forecastProvider(latitude, longitude, date),
    ]);
    const suitable = forecast.windSpeedKph < windConfig.value && forecast.precipitationProbability < rainConfig.value;
    return { suitable, note: suitable ? 'Weather forecast is within configured operating thresholds.' : 'Weather forecast exceeds configured operating thresholds.' };
  } catch (error) {
    // A weather outage is a warning, never a scheduling blocker.
    return { suitable: null, note: `Weather check unavailable: ${error.message}. Fleet Manager review required.` };
  }
}

module.exports = { checkSuitability, setForecastProvider };
