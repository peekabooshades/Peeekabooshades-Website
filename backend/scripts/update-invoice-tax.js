/**
 * Update all invoices with state-based sales tax calculation
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../database.json');
const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

// US State Sales Tax Rates
const STATE_TAX_RATES = {
  'AL': 0.04, 'AK': 0, 'AZ': 0.056, 'AR': 0.065, 'CA': 0.0725,
  'CO': 0.029, 'CT': 0.0635, 'DE': 0, 'FL': 0.06, 'GA': 0.04,
  'HI': 0.04, 'ID': 0.06, 'IL': 0.0625, 'IN': 0.07, 'IA': 0.06,
  'KS': 0.065, 'KY': 0.06, 'LA': 0.0445, 'ME': 0.055, 'MD': 0.06,
  'MA': 0.0625, 'MI': 0.06, 'MN': 0.06875, 'MS': 0.07, 'MO': 0.04225,
  'MT': 0, 'NE': 0.055, 'NV': 0.0685, 'NH': 0, 'NJ': 0.06625,
  'NM': 0.05125, 'NY': 0.04, 'NC': 0.0475, 'ND': 0.05, 'OH': 0.0575,
  'OK': 0.045, 'OR': 0, 'PA': 0.06, 'RI': 0.07, 'SC': 0.06,
  'SD': 0.045, 'TN': 0.07, 'TX': 0.0625, 'UT': 0.061, 'VT': 0.06,
  'VA': 0.053, 'WA': 0.065, 'WV': 0.06, 'WI': 0.05, 'WY': 0.04,
  'DC': 0.06
};

const stateAbbreviations = Object.keys(STATE_TAX_RATES);

const stateNames = {
  'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR',
  'CALIFORNIA': 'CA', 'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE',
  'FLORIDA': 'FL', 'GEORGIA': 'GA', 'HAWAII': 'HI', 'IDAHO': 'ID',
  'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA', 'KANSAS': 'KS',
  'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
  'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS',
  'MISSOURI': 'MO', 'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV',
  'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ', 'NEW MEXICO': 'NM', 'NEW YORK': 'NY',
  'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH', 'OKLAHOMA': 'OK',
  'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT',
  'VERMONT': 'VT', 'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV',
  'WISCONSIN': 'WI', 'WYOMING': 'WY', 'DISTRICT OF COLUMBIA': 'DC'
};

function extractStateFromAddress(address) {
  if (!address || typeof address !== 'string') return null;

  const upperAddress = address.toUpperCase();

  // Try state + zip pattern (e.g., "CA 90210")
  const stateZipRegex = /\b([A-Z]{2})\s*,?\s*(\d{5}(-\d{4})?)\b/;
  const stateZipMatch = upperAddress.match(stateZipRegex);
  if (stateZipMatch && stateAbbreviations.includes(stateZipMatch[1])) {
    return stateZipMatch[1];
  }

  // Try comma + state pattern (e.g., ", CA")
  const commaStateRegex = /,\s*([A-Z]{2})\b/;
  const commaStateMatch = upperAddress.match(commaStateRegex);
  if (commaStateMatch && stateAbbreviations.includes(commaStateMatch[1])) {
    return commaStateMatch[1];
  }

  // Try full state name
  for (const [fullName, abbr] of Object.entries(stateNames)) {
    if (upperAddress.includes(fullName)) {
      return abbr;
    }
  }

  // Look for standalone abbreviation
  for (const abbr of stateAbbreviations) {
    const regex = new RegExp('\\b' + abbr + '\\b');
    if (regex.test(upperAddress)) {
      return abbr;
    }
  }

  return null;
}

let updated = 0;

console.log('=== Updating Invoices with State-Based Sales Tax ===\n');

// Update each invoice
(db.invoices || []).forEach((inv, idx) => {
  // Get shipping address
  const shippingAddr = inv.shippingAddress || inv.billingAddress || inv.customer?.address || '';

  // Calculate tax based on shipping address
  const state = extractStateFromAddress(shippingAddr);

  let taxRate, taxAmount, taxState, taxNote;

  if (!state) {
    // Default to CA
    taxRate = 0.0725;
    taxState = 'CA';
    taxNote = 'Default CA rate used - shipping state not determined';
  } else {
    taxRate = STATE_TAX_RATES[state] || 0;
    taxState = state;
    taxNote = taxRate === 0 ? (state + ' has no state sales tax') : null;
  }

  const subtotal = inv.subtotal || 0;
  taxAmount = Math.round(subtotal * taxRate * 100) / 100;

  const shipping = inv.shipping || 0;
  const discount = inv.discount || 0;
  const newTotal = Math.round((subtotal + taxAmount + shipping - discount) * 100) / 100;

  // Update invoice
  db.invoices[idx].tax = taxAmount;
  db.invoices[idx].taxRate = taxRate;
  db.invoices[idx].taxState = taxState;
  if (taxNote) {
    db.invoices[idx].taxNote = taxNote;
  } else {
    delete db.invoices[idx].taxNote;
  }
  db.invoices[idx].total = newTotal;

  // Update amount due based on amount paid
  const amountPaid = db.invoices[idx].amountPaid || 0;
  db.invoices[idx].amountDue = amountPaid > 0 ? Math.max(0, newTotal - amountPaid) : newTotal;
  db.invoices[idx].updatedAt = new Date().toISOString();

  console.log(`${inv.invoiceNumber}: State=${taxState}, Rate=${(taxRate * 100).toFixed(2)}%, Tax=$${taxAmount.toFixed(2)}, Total=$${newTotal.toFixed(2)}`);
  updated++;
});

fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log(`\n=== Updated ${updated} invoices with state-based sales tax ===`);
