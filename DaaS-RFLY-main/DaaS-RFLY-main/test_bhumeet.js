const https = require('https');

const data = JSON.stringify({
  email: 'foppleceo@gmail.com',
  password: 'Gopiraja@123'
});

const options = {
  hostname: 'api.bhumeet.app',
  path: '/dsp/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', (error) => console.error(error));
req.write(data);
req.end();
