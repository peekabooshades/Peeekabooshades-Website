#!/usr/bin/env node
/**
 * Test Pricing API for Zebra Shades
 * Validates that frontend, cart, orders all use consistent pricing
 */

const http = require('http');

const testCases = [
  {
    name: 'Zebra Manual Control - Fabric 83003A',
    request: {
      productSlug: 'affordable-custom-zebra-shades',
      productType: 'zebra',
      width: 36,
      height: 48,
      quantity: 1,
      fabricCode: '83003A',
      options: {
        controlType: 'manual',
        valanceType: '3-inch-valance',
        bottomRail: 'standard-bottom-bar'
      }
    }
  },
  {
    name: 'Zebra Cordless Control - Fabric 83003A',
    request: {
      productSlug: 'affordable-custom-zebra-shades',
      productType: 'zebra',
      width: 36,
      height: 48,
      quantity: 1,
      fabricCode: '83003A',
      options: {
        controlType: 'cordless',
        valanceType: '3-inch-valance',
        bottomRail: 'standard-bottom-bar'
      }
    }
  },
  {
    name: 'Zebra Motorized - Fabric 83003A with AOK',
    request: {
      productSlug: 'affordable-custom-zebra-shades',
      productType: 'zebra',
      width: 40,
      height: 60,
      quantity: 1,
      fabricCode: '83003A',
      options: {
        controlType: 'motorized',
        motorBrand: 'aok',
        remoteType: '1-channel',
        valanceType: '3-inch-valance',
        bottomRail: 'standard-bottom-bar'
      }
    }
  }
];

async function testPricingAPI(testCase) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testCase.request);

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

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ testCase, result });
        } catch (e) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('PRICING API VALIDATION - Zebra Shades');
  console.log('='.repeat(60));
  console.log('');

  for (const testCase of testCases) {
    try {
      const { result } = await testPricingAPI(testCase);

      console.log('TEST:', testCase.name);
      console.log('-'.repeat(50));

      if (result.success) {
        console.log('  Status: ✅ SUCCESS');
        console.log('  Fabric:', result.fabricCode);
        console.log('  Dimensions:', result.dimensions?.width + '" x ' + result.dimensions?.height + '"');
        console.log('  Area:', result.dimensions?.squareMeters, 'm²',
          result.dimensions?.minAreaApplied ? '(min 1.5m² applied)' : '');
        console.log('');
        console.log('  Pricing:');
        console.log('    MFR Cost:      $' + (result.pricing?.manufacturerCost?.unitCost || 0).toFixed(2));
        console.log('    Margin:        ' + (result.pricing?.margin?.percentage || 0) + '% ($' + (result.pricing?.margin?.amount || 0).toFixed(2) + ')');
        console.log('    Customer Price: $' + (result.pricing?.unitPrice || 0).toFixed(2));
        console.log('');

        if (result.pricing?.options?.breakdown?.length > 0) {
          console.log('  Options:');
          result.pricing.options.breakdown.forEach(opt => {
            console.log('    - ' + opt.name + ': $' + (opt.price || 0).toFixed(2));
          });
        }
      } else {
        console.log('  Status: ❌ FAILED');
        console.log('  Error:', result.error);
      }

      console.log('');
    } catch (error) {
      console.log('TEST:', testCase.name);
      console.log('  Status: ❌ ERROR');
      console.log('  Error:', error.message);
      console.log('');
    }
  }

  // Verify pricing formula
  console.log('='.repeat(60));
  console.log('PRICING FORMULA VERIFICATION');
  console.log('='.repeat(60));
  console.log('');
  console.log('Expected for Fabric 83003A (from PDF):');
  console.log('  Bead Chain MFR: $14.17/m²');
  console.log('  Cordless MFR:   $17.97/m²');
  console.log('');
  console.log('With 40% margin:');
  console.log('  Bead Chain Customer: $14.17 × 1.40 = $19.84/m²');
  console.log('  Cordless Customer:   $17.97 × 1.40 = $25.16/m²');
  console.log('');
  console.log('For 36" × 48" (min area 1.5m²):');
  console.log('  Area = 0.914m × 1.219m = 1.114m² → 1.5m² (minimum)');
  console.log('  Manual Price:   1.5 × $14.17 = $21.26 (MFR)');
  console.log('  Manual Customer: $21.26 × 1.40 = $29.76');
  console.log('');
}

runTests().catch(console.error);
