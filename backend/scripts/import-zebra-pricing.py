#!/usr/bin/env python3
"""
Import Zebra Fabric Pricing from Excel
Reads from Zebra_Fabric_Matched_Tech_Pricing_Grouped.xlsx
Updates database.json with all 176 fabrics
"""

import json
import os
import sys
import pandas as pd
from datetime import datetime

# Paths
EXCEL_PATH = '/Users/surya/Downloads/Zebra_Fabric_Matched_Tech_Pricing_Grouped.xlsx'
DATABASE_PATH = os.path.join(os.path.dirname(__file__), '..', 'database.json')

def load_excel_data():
    """Load and process the Excel file."""
    print(f"Loading Excel file from: {EXCEL_PATH}")
    df = pd.read_excel(EXCEL_PATH)

    print(f"Found {len(df)} fabrics in Excel")
    print(f"Columns: {df.columns.tolist()}")

    # Count by shading type
    print("\nFabrics by Shading Type:")
    for shading_type, count in df['Shading Type'].value_counts().items():
        print(f"  {shading_type}: {count}")

    return df

def convert_shading_type(excel_type):
    """Convert Excel shading type to database category."""
    type_map = {
        'Semi-Blackout': 'semi-blackout',
        'Blackout': 'blackout',
        'Super Blackout': 'super-blackout'
    }
    return type_map.get(excel_type, 'semi-blackout')

def clean_value(val):
    """Clean NaN values."""
    if pd.isna(val):
        return None
    return val

def create_fabric_entry(row):
    """Create a fabric entry from Excel row."""
    code = str(row['Fabric Code']).strip()
    shading_type = row['Shading Type']
    category = convert_shading_type(shading_type)

    return {
        'code': code,
        'name': f"Zebra {shading_type} {code}",
        'category': category,
        'shadingType': shading_type,
        'composition': clean_value(row['Composition']) or '100% Polyester',
        'weight': f"{clean_value(row['Weight (g/m²)'])} g/m²" if clean_value(row['Weight (g/m²)']) else None,
        'width': int(clean_value(row['Width (cm)'])) if clean_value(row['Width (cm)']) else 300,
        'thickness': f"{clean_value(row['Thickness (mm)'])} mm" if clean_value(row['Thickness (mm)']) else None,
        'repeat': clean_value(row['Repeat (cm)']),
        'waterResistant': True if clean_value(row.get('Water Resistant')) == 'YES' else False,
        'fireResistant': True if clean_value(row.get('Fire Resistant')) == 'YES' else False,
        'mildewProof': True if clean_value(row.get('Mildew Proof')) == 'YES' else False,
        'formaldehydeFree': True if clean_value(row.get('Formaldehyde Free')) == 'YES' else False,
        'image': f'/images/fabrics/zebra/{code}.png',
        'hasImage': False,  # Will be updated when images are uploaded
        'enabled': True,
        'status': 'active',
        'createdAt': datetime.now().isoformat(),
        'updatedAt': datetime.now().isoformat()
    }

def create_price_entry(row):
    """Create a manufacturer price entry from Excel row."""
    code = str(row['Fabric Code']).strip()
    shading_type = row['Shading Type']
    category = convert_shading_type(shading_type)

    manual_price = float(clean_value(row['Price per Sqm (Manual)'])) if clean_value(row['Price per Sqm (Manual)']) else 0
    cordless_price = float(clean_value(row['Price per Sqm (Cordless)'])) if clean_value(row['Price per Sqm (Cordless)']) else 0

    # Default margin of 40%
    margin = 40

    return {
        'fabricCode': code,
        'category': category,
        'shadingType': shading_type,
        'pricePerSqMeterManual': manual_price,
        'pricePerSqMeter': manual_price,  # Alias
        'pricePerSqMeterCordless': cordless_price,
        'manualMargin': margin,
        'minAreaSqMeter': 1.5,  # Zebra minimum is 1.5 sqm
        'status': 'active',
        'createdAt': datetime.now().isoformat(),
        'updatedAt': datetime.now().isoformat()
    }

def update_database(fabrics, prices):
    """Update the database.json file."""
    print(f"\nLoading database from: {DATABASE_PATH}")

    with open(DATABASE_PATH, 'r') as f:
        db = json.load(f)

    # Backup existing data
    old_fabrics = len(db.get('zebraFabrics', []))
    old_prices = len(db.get('zebraManufacturerPrices', []))

    print(f"Existing zebra fabrics: {old_fabrics}")
    print(f"Existing zebra prices: {old_prices}")

    # Update with new data
    db['zebraFabrics'] = fabrics
    db['zebraManufacturerPrices'] = prices

    # Write back
    with open(DATABASE_PATH, 'w') as f:
        json.dump(db, f, indent=2)

    print(f"\nUpdated database:")
    print(f"  New zebra fabrics: {len(fabrics)}")
    print(f"  New zebra prices: {len(prices)}")

def main():
    print("=" * 60)
    print("Zebra Fabric Pricing Import")
    print("=" * 60)

    # Load Excel data
    df = load_excel_data()

    # Convert to database format
    fabrics = []
    prices = []

    for idx, row in df.iterrows():
        fabrics.append(create_fabric_entry(row))
        prices.append(create_price_entry(row))

    # Verify counts
    semi_blackout = len([f for f in fabrics if f['category'] == 'semi-blackout'])
    blackout = len([f for f in fabrics if f['category'] == 'blackout'])
    super_blackout = len([f for f in fabrics if f['category'] == 'super-blackout'])

    print(f"\nProcessed fabrics:")
    print(f"  Semi-Blackout: {semi_blackout}")
    print(f"  Blackout: {blackout}")
    print(f"  Super Blackout: {super_blackout}")
    print(f"  Total: {len(fabrics)}")

    # Update database
    update_database(fabrics, prices)

    print("\n" + "=" * 60)
    print("Import completed successfully!")
    print("=" * 60)

if __name__ == '__main__':
    main()
