#!/usr/bin/env python3
"""
Smart Complete Zebra Fabric Extractor
Extracts ALL fabric images by matching series to individual codes
"""

import fitz
import os
import re
import json
from collections import defaultdict

class SmartCompleteExtractor:
    def __init__(self, output_dir):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.fabric_data = {}  # code -> {category, cordless_price, bead_chain_price}
        self.series_codes = defaultdict(list)  # series -> [codes]
        self.extracted_images = {}  # code -> filename

    def parse_pricing_pdf(self, pdf_path):
        """Parse wholesale quotation for pricing and category data"""
        print(f"\n{'='*60}")
        print("STEP 1: Parsing Pricing PDF for Codes and Categories")
        print('='*60)

        doc = fitz.open(pdf_path)
        current_codes = []
        current_category = 'semi-blackout'
        cordless_price = 0
        bead_chain_price = 0

        for page_num in range(doc.page_count):
            page = doc[page_num]
            text = page.get_text()
            lines = text.split('\n')

            i = 0
            while i < len(lines):
                line = lines[i].strip()

                # Detect shading effect category
                if 'shading effect:' in line.lower():
                    if 'super-blackout' in line.lower():
                        current_category = 'super-blackout'
                    elif 'semi-blackout' in line.lower():
                        current_category = 'semi-blackout'
                    elif 'blackout' in line.lower():
                        current_category = 'blackout'

                # Find fabric codes
                codes = re.findall(r'(830\d{2}[A-Z])', line)
                if codes:
                    current_codes.extend(codes)

                # Find prices
                price_match = re.match(r'^\$(\d+\.?\d*)$', line)
                if price_match:
                    price = float(price_match.group(1))
                    if cordless_price == 0:
                        cordless_price = price
                    elif bead_chain_price == 0:
                        bead_chain_price = price
                        for code in current_codes:
                            self.fabric_data[code] = {
                                'cordless': cordless_price,
                                'bead_chain': bead_chain_price,
                                'category': current_category
                            }
                            series = code[:5]
                            if code not in self.series_codes[series]:
                                self.series_codes[series].append(code)
                        current_codes = []
                        cordless_price = 0
                        bead_chain_price = 0
                        current_category = 'semi-blackout'

                i += 1

        doc.close()

        # Sort codes within each series
        for series in self.series_codes:
            self.series_codes[series].sort()

        print(f"\nTotal fabric codes: {len(self.fabric_data)}")
        print(f"Total series: {len(self.series_codes)}")

        # Category breakdown
        cats = defaultdict(int)
        for code, data in self.fabric_data.items():
            cats[data['category']] += 1
        for cat, count in sorted(cats.items()):
            print(f"  {cat}: {count}")

    def extract_from_catalog(self, pdf_path, catalog_name):
        """Extract fabric swatches from catalog using series matching"""
        print(f"\n{'='*60}")
        print(f"STEP 2: Extracting from {catalog_name}")
        print('='*60)

        doc = fitz.open(pdf_path)
        extracted_count = 0

        for page_num in range(doc.page_count):
            page = doc[page_num]
            text = page.get_text()

            # Find series number on this page
            series_match = re.search(r'series[\s\n]+(\d{5})', text, re.IGNORECASE)
            if not series_match:
                # Try to find from fabric codes directly
                codes = re.findall(r'830\d{2}[A-Z]', text)
                if codes:
                    series = codes[0][:5]
                else:
                    continue
            else:
                series = series_match.group(1)

            # Get expected codes for this series
            expected_codes = self.series_codes.get(series, [])
            if not expected_codes:
                continue

            # Skip if all codes already have images
            missing_codes = [c for c in expected_codes if c not in self.extracted_images]
            if not missing_codes:
                continue

            print(f"\nPage {page_num + 1}: Series {series}")
            print(f"  Expected codes: {expected_codes}")
            print(f"  Missing: {len(missing_codes)}")

            # Get all images on this page
            images = page.get_images(full=True)
            swatch_images = []

            for img in images:
                xref = img[0]
                rects = page.get_image_rects(xref)
                if not rects:
                    continue

                rect = rects[0]
                try:
                    base_image = doc.extract_image(xref)
                    width = base_image['width']
                    height = base_image['height']

                    # Filter for fabric swatches (reasonable size)
                    if width < 300 or height < 300:
                        continue

                    # Skip very large images (likely backgrounds)
                    if width > 4000 or height > 4000:
                        continue

                    aspect = width / height
                    if aspect < 0.3 or aspect > 3.0:
                        continue

                    swatch_images.append({
                        'xref': xref,
                        'x': rect[0],
                        'y': rect[1],
                        'width': width,
                        'height': height,
                        'ext': base_image['ext'],
                        'data': base_image['image']
                    })
                except Exception as e:
                    continue

            # Sort by position (left to right, top to bottom)
            swatch_images.sort(key=lambda x: (round(x['y'] / 100), x['x']))

            print(f"  Swatch images found: {len(swatch_images)}")

            # Match images to missing codes in order
            for idx, code in enumerate(missing_codes):
                if idx < len(swatch_images):
                    img = swatch_images[idx]
                    filename = f"{code}.{img['ext']}"
                    filepath = os.path.join(self.output_dir, filename)

                    with open(filepath, 'wb') as f:
                        f.write(img['data'])

                    self.extracted_images[code] = filename
                    extracted_count += 1
                    print(f"    Saved: {filename} ({img['width']}x{img['height']})")

        doc.close()
        print(f"\nExtracted from {catalog_name}: {extracted_count}")
        return extracted_count

    def fill_missing_from_catalog(self, pdf_path, catalog_name):
        """Second pass to fill missing images"""
        print(f"\n{'='*60}")
        print(f"STEP 3: Filling Missing from {catalog_name}")
        print('='*60)

        doc = fitz.open(pdf_path)

        # Find missing codes
        missing = [code for code in self.fabric_data.keys() if code not in self.extracted_images]
        print(f"Still missing: {len(missing)} codes")

        if not missing:
            doc.close()
            return 0

        # Group by series
        missing_by_series = defaultdict(list)
        for code in missing:
            missing_by_series[code[:5]].append(code)

        extracted_count = 0

        for page_num in range(doc.page_count):
            page = doc[page_num]
            text = page.get_text()

            # Find series
            series_match = re.search(r'series[\s\n]+(\d{5})', text, re.IGNORECASE)
            series = series_match.group(1) if series_match else None

            if not series:
                codes = re.findall(r'830\d{2}[A-Z]', text)
                if codes:
                    series = codes[0][:5]
                else:
                    continue

            if series not in missing_by_series:
                continue

            needed_codes = sorted(missing_by_series[series])

            # Get images
            images = page.get_images(full=True)
            swatch_images = []

            for img in images:
                xref = img[0]
                rects = page.get_image_rects(xref)
                if not rects:
                    continue
                rect = rects[0]
                try:
                    base_image = doc.extract_image(xref)
                    width = base_image['width']
                    height = base_image['height']
                    if 300 <= width <= 4000 and 300 <= height <= 4000:
                        swatch_images.append({
                            'x': rect[0], 'y': rect[1],
                            'width': width, 'height': height,
                            'ext': base_image['ext'],
                            'data': base_image['image']
                        })
                except:
                    continue

            swatch_images.sort(key=lambda x: (round(x['y'] / 100), x['x']))

            print(f"\nPage {page_num + 1}: Series {series}")
            print(f"  Need: {needed_codes}")
            print(f"  Images: {len(swatch_images)}")

            for idx, code in enumerate(needed_codes):
                if idx < len(swatch_images) and code not in self.extracted_images:
                    img = swatch_images[idx]
                    filename = f"{code}.{img['ext']}"
                    filepath = os.path.join(self.output_dir, filename)
                    with open(filepath, 'wb') as f:
                        f.write(img['data'])
                    self.extracted_images[code] = filename
                    extracted_count += 1
                    print(f"    Saved: {filename}")

        doc.close()
        return extracted_count

    def update_database(self, db_path):
        """Update the backend database with correct categories"""
        print(f"\n{'='*60}")
        print("STEP 4: Updating Database")
        print('='*60)

        # Read current database
        with open(db_path, 'r') as f:
            db = json.load(f)

        # Update manufacturerPrices
        mfr_prices = db.get('manufacturerPrices', [])
        updated = 0

        for price_entry in mfr_prices:
            if price_entry.get('productType') != 'zebra':
                continue

            code = price_entry.get('fabricCode', '')
            if code in self.fabric_data:
                data = self.fabric_data[code]
                price_entry['category'] = data['category']
                price_entry['name'] = f"Zebra {data['category']} {code}"

                # Update image path
                if code in self.extracted_images:
                    price_entry['image'] = f"/images/fabrics/zebra/{self.extracted_images[code]}"
                    price_entry['hasImage'] = True

                updated += 1

        print(f"Updated {updated} fabric entries")

        # Category counts
        cats = defaultdict(int)
        for p in mfr_prices:
            if p.get('productType') == 'zebra':
                cats[p.get('category', 'unknown')] += 1

        print("Categories after update:")
        for cat, count in sorted(cats.items()):
            print(f"  {cat}: {count}")

        # Save database
        with open(db_path, 'w') as f:
            json.dump(db, f, indent=2)

        print(f"Database saved to {db_path}")

    def print_summary(self):
        """Print extraction summary"""
        print(f"\n{'='*60}")
        print("SUMMARY")
        print('='*60)

        total = len(self.fabric_data)
        with_images = len(self.extracted_images)
        without_images = total - with_images

        print(f"Total fabric codes: {total}")
        print(f"With images: {with_images} ({100*with_images/total:.1f}%)")
        print(f"Without images: {without_images}")

        if without_images > 0:
            missing = sorted([c for c in self.fabric_data if c not in self.extracted_images])
            print(f"\nMissing codes:")
            for i in range(0, len(missing), 10):
                print(f"  {', '.join(missing[i:i+10])}")


def main():
    downloads = '/Users/surya/Downloads'
    output_dir = '/Users/surya/Peekabooshades/Peeekabooshades-Website/frontend/public/images/fabrics/zebra'
    db_path = '/Users/surya/Peekabooshades/Peeekabooshades-Website/backend/database.json'

    extractor = SmartCompleteExtractor(output_dir)

    # Parse pricing PDF
    extractor.parse_pricing_pdf(f'{downloads}/2025 Zebra blind wholesale quotation.pdf')

    # Extract from both catalogs
    extractor.extract_from_catalog(
        f'{downloads}/ZSTARR Zebra Blinds Fabric Catalogue-A-2025.8.1.pdf',
        'Catalog A (2025.8.1)'
    )
    extractor.extract_from_catalog(
        f'{downloads}/ZSTARR Zebra Blinds Fabric Catalogue-B-2025.6.27.pdf',
        'Catalog B (2025.6.27)'
    )

    # Second pass to fill missing
    extractor.fill_missing_from_catalog(
        f'{downloads}/ZSTARR Zebra Blinds Fabric Catalogue-A-2025.8.1.pdf',
        'Catalog A (second pass)'
    )
    extractor.fill_missing_from_catalog(
        f'{downloads}/ZSTARR Zebra Blinds Fabric Catalogue-B-2025.6.27.pdf',
        'Catalog B (second pass)'
    )

    # Update database
    extractor.update_database(db_path)

    # Print summary
    extractor.print_summary()

    print("\n" + "="*60)
    print("EXTRACTION COMPLETE!")
    print("="*60)


if __name__ == '__main__':
    main()
