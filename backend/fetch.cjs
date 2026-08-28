const https = require('https');

https.get('https://relief-lock-api.onrender.com/api/applications/test', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Applications:', JSON.parse(data));
  });
});

https.get('https://relief-lock-api.onrender.com/api/transactions/test', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Transactions:', JSON.parse(data));
  });
});
