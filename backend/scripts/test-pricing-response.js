#!/usr/bin/env node
const http = require('http');

const postData = JSON.stringify({
  productSlug: 'affordable-custom-zebra-shades',
  productType: 'zebra',
  width: 36,
  height: 48,
  quantity: 1,
  fabricCode: '83003A',
  options: { controlType: 'manual' }
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/v1/pricing/calculate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('=== PRICING API RESPONSE ===');
    console.log(JSON.stringify(json, null, 2));

    console.log('\n=== KEY FIELDS FOR UI ===');
    console.log('pricing.unitPrice:', json.pricing?.unitPrice);
    console.log('pricing.lineTotal:', json.pricing?.lineTotal);
    console.log('pricing.totalPrice:', json.pricing?.totalPrice);
    console.log('pricing.customerPrice:', json.pricing?.customerPrice);
  });
});

req.on('error', e => console.error('Error:', e.message));
req.write(postData);
req.end();
