#!/usr/bin/env node
/**
 * Sync Zebra Shades PAGE STYLING with Roller Shades
 * ONLY copies: fonts, colors, spacing, backgrounds
 * DOES NOT touch: hardware, cassette, fabric options
 */

const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const rollerSlug = 'affordable-custom-roller-blinds';
const zebraSlug = 'affordable-custom-zebra-shades';

console.log('🔄 Syncing Zebra Shades PAGE STYLING with Roller Shades...\n');
console.log('⚠️  NOT touching: Hardware, Cassette, Fabric options\n');

// Initialize if not exists
if (!db.productPageStyles) db.productPageStyles = {};

// ONLY copy styles (fonts, colors, spacing, backgrounds)
if (db.productPageStyles[rollerSlug]) {
  db.productPageStyles[zebraSlug] = JSON.parse(JSON.stringify(db.productPageStyles[rollerSlug]));
  console.log('✅ Copied PAGE STYLES from Roller to Zebra:');

  const styles = db.productPageStyles[zebraSlug];
  console.log('\n📝 Typography:');
  console.log('   Title Font:', styles.titleFont);
  console.log('   Title Size:', styles.titleSize);
  console.log('   Title Color:', styles.titleColor);
  console.log('   Title Weight:', styles.titleWeight);
  console.log('   Body Font:', styles.bodyFont);
  console.log('   Body Size:', styles.bodySize);
  console.log('   Body Color:', styles.bodyColor);

  console.log('\n🎨 Colors:');
  console.log('   Page Background:', styles.pageBackground);
  console.log('   Button Background:', styles.buttonBackground);
  console.log('   Button Text:', styles.buttonColor);
  console.log('   Price Color:', styles.priceColor);

  console.log('\n📏 Spacing:');
  console.log('   Section Spacing:', styles.sectionSpacing);
  console.log('   Element Spacing:', styles.elementSpacing);
  console.log('   Button Border Radius:', styles.buttonBorderRadius);
  console.log('   Gallery Border Radius:', styles.galleryBorderRadius);

} else {
  console.log('⚠️  No Roller styles found, creating defaults for Zebra');
  db.productPageStyles[zebraSlug] = {
    // Page Background
    pageBackground: '#F6F1EB',

    // Typography
    titleFont: 'Cormorant Garamond',
    titleSize: '28px',
    titleColor: '#8E6545',
    titleWeight: '600',
    bodyFont: 'Montserrat',
    bodySize: '14px',
    bodyColor: '#666666',

    // Price
    priceSize: '32px',
    priceColor: '#8E6545',
    priceWeight: '700',

    // Buttons
    buttonBackground: '#8E6545',
    buttonColor: '#FFFFFF',
    buttonBorderRadius: '6px',
    buttonPadding: '12px 24px',

    // Select Shades Box
    selectShadesBackground: '#FFFFFF',
    selectShadesBorder: '1px solid #E0D5C7',
    selectShadesBorderRadius: '8px',

    // Options
    optionBackground: '#FFFFFF',
    optionBorder: '1px solid #E0D5C7',
    optionBorderRadius: '8px',
    optionPadding: '20px',

    // Gallery
    galleryWidth: '500px',
    galleryBorderRadius: '12px',

    // Spacing
    sectionSpacing: '24px',
    elementSpacing: '16px'
  };
}

// Save database
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

console.log('\n' + '='.repeat(50));
console.log('✅ PAGE STYLING SYNC COMPLETE!');
console.log('='.repeat(50));
console.log('\n✅ Synced: Fonts, Colors, Spacing, Backgrounds');
console.log('❌ Not touched: Hardware, Cassette, Fabric options');
console.log('\nZebra Styles:', Object.keys(db.productPageStyles[zebraSlug] || {}).length, 'properties');
