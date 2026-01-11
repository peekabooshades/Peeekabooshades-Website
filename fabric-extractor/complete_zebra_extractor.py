#!/usr/bin/env python3
"""
Complete Zebra Fabric Extractor
Extracts ALL fabric images and correctly categorizes them
"""

import fitz
import os
import re
import json
from collections import defaultdict

class CompleteZebraExtractor:
    def __init__(self, output_dir):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.fabric_data = {}  # code -> {category, cordless_price, bead_chain_price, ...}
        self.extracted_images = {}  # code -> filename

    def parse_pricing_pdf(self, pdf_path):
        """Parse wholesale quotation for pricing and category data"""
        print(f"\n=== Parsing Pricing PDF ===")
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
                if 'Shading effect:' in line or 'shading effect:' in line.lower():
                    if 'super-blackout' in line.lower():
                        current_category = 'super-blackout'
                    elif 'semi-blackout' in line.lower():
                        current_category = 'semi-blackout'
                    elif 'blackout' in line.lower():
                        current_category = 'blackout'

                # Find fabric codes ending in letters (e.g., 83003A, 83046B)
                codes = re.findall(r'(830\d{2}[A-Z])', line)
                if codes:
                    current_codes.extend(codes)

                # Find prices (format: $XX.XX)
                price_match = re.match(r'^\$(\d+\.?\d*)$', line)
                if price_match:
                    price = float(price_match.group(1))
                    if cordless_price == 0:
                        cordless_price = price
                    elif bead_chain_price == 0:
                        bead_chain_price = price
                        # Save all codes with these prices and category
                        for code in current_codes:
                            self.fabric_data[code] = {
                                'cordless': cordless_price,
                                'bead_chain': bead_chain_price,
                                'category': current_category
                            }
                        # Reset for next group
                        current_codes = []
                        cordless_price = 0
                        bead_chain_price = 0
                        current_category = 'semi-blackout'  # Reset to default

                i += 1

        doc.close()

        # Count categories
        categories = defaultdict(int)
        for code, data in self.fabric_data.items():
            categories[data['category']] += 1

        print(f"Parsed {len(self.fabric_data)} fabric codes")
        for cat, count in sorted(categories.items()):
            print(f"  {cat}: {count}")

        return self.fabric_data

    def extract_catalog_images(self, pdf_path, catalog_name):
        """Extract fabric swatch images from catalog PDF"""
        print(f"\n=== Extracting from {catalog_name} ===")
        doc = fitz.open(pdf_path)

        for page_num in range(doc.page_count):
            page = doc[page_num]
            page_width = page.rect.width
            page_height = page.rect.height

            # Get text to find fabric codes on this page
            text = page.get_text()
            fabric_codes = list(set(re.findall(r'830\d{2}[A-Z]', text)))

            if not fabric_codes:
                continue

            fabric_codes.sort()
            series = fabric_codes[0][:5] if fabric_codes else ""

            print(f"\nPage {page_num + 1}: Series {series}")
            print(f"  Codes: {', '.join(fabric_codes[:10])}{'...' if len(fabric_codes) > 10 else ''}")

            # Get all images on this page
            images = page.get_images(full=True)
            images_with_data = []

            for img in images:
                xref = img[0]
                rects = page.get_image_rects(xref)
                if not rects:
                    continue

                rect = rects[0]
                x0, y0, x1, y1 = rect

                try:
                    base_image = doc.extract_image(xref)
                    width = base_image['width']
                    height = base_image['height']

                    # Filter: fabric swatches are typically larger than 300px
                    if width < 300 or height < 300:
                        continue

                    # Filter by aspect ratio (fabric swatches are roughly square to 2:1)
                    aspect = width / height
                    if aspect < 0.5 or aspect > 2.5:
                        continue

                    # Calculate center position for sorting
                    center_y = (y0 + y1) / 2
                    center_x = (x0 + x1) / 2

                    images_with_data.append({
                        'xref': xref,
                        'center_x': center_x,
                        'center_y': center_y,
                        'width': width,
                        'height': height,
                        'ext': base_image['ext'],
                        'data': base_image['image'],
                        'size': len(base_image['image'])
                    })
                except Exception as e:
                    continue

            # Sort images by position (top to bottom, left to right)
            # This helps match images to fabric codes in order
            images_with_data.sort(key=lambda x: (round(x['center_y'] / 50), x['center_x']))

            print(f"  Valid images: {len(images_with_data)}")

            # Match images to codes
            for idx, code in enumerate(fabric_codes):
                # Skip if already have this image
                if code in self.extracted_images:
                    continue

                if idx < len(images_with_data):
                    img = images_with_data[idx]
                    filename = f"{code}.{img['ext']}"
                    filepath = os.path.join(self.output_dir, filename)

                    with open(filepath, 'wb') as f:
                        f.write(img['data'])

                    self.extracted_images[code] = filename
                    print(f"  Saved: {filename} ({img['width']}x{img['height']})")

        doc.close()
        print(f"\nTotal extracted from {catalog_name}: {len(self.extracted_images)}")

    def extract_all_images_alternate(self, pdf_path, catalog_name):
        """Alternative extraction - extract ALL large images and try to match"""
        print(f"\n=== Alternative Extraction from {catalog_name} ===")
        doc = fitz.open(pdf_path)

        all_codes = set()
        all_images = []

        # First pass: collect all codes and images
        for page_num in range(doc.page_count):
            page = doc[page_num]
            text = page.get_text()

            codes = re.findall(r'830\d{2}[A-Z]', text)
            all_codes.update(codes)

            images = page.get_images(full=True)
            for img in images:
                xref = img[0]
                try:
                    base_image = doc.extract_image(xref)
                    width = base_image['width']
                    height = base_image['height']

                    if width >= 400 and height >= 400:
                        all_images.append({
                            'xref': xref,
                            'page': page_num,
                            'width': width,
                            'height': height,
                            'ext': base_image['ext'],
                            'data': base_image['image']
                        })
                except:
                    continue

        print(f"  Found {len(all_codes)} unique codes")
        print(f"  Found {len(all_images)} large images")

        # Match codes that don't have images yet
        missing_codes = sorted([c for c in all_codes if c not in self.extracted_images])
        print(f"  Missing images for: {len(missing_codes)} codes")

        doc.close()

    def generate_database_update(self, output_path):
        """Generate JSON for updating database with correct categories"""
        entries = []

        for code in sorted(self.fabric_data.keys()):
            data = self.fabric_data[code]
            has_image = code in self.extracted_images

            entry = {
                'code': code,
                'series': code[:5],
                'name': f"Zebra {data['category']} {code}",
                'category': data['category'],
                'cordless_price': data['cordless'],
                'bead_chain_price': data['bead_chain'],
                'image': f"/images/fabrics/zebra/{self.extracted_images.get(code, '')}" if has_image else '',
                'hasImage': has_image
            }
            entries.append(entry)

        with open(output_path, 'w') as f:
            json.dump(entries, f, indent=2)

        # Summary
        with_images = sum(1 for e in entries if e['hasImage'])
        without_images = sum(1 for e in entries if not e['hasImage'])

        print(f"\n=== Summary ===")
        print(f"Total fabrics: {len(entries)}")
        print(f"With images: {with_images}")
        print(f"Without images: {without_images}")

        if without_images > 0:
            missing = [e['code'] for e in entries if not e['hasImage']]
            print(f"Missing image codes: {', '.join(missing[:20])}{'...' if len(missing) > 20 else ''}")

        # Category breakdown
        cats = defaultdict(int)
        for e in entries:
            cats[e['category']] += 1
        print(f"\nCategories:")
        for cat, count in sorted(cats.items()):
            print(f"  {cat}: {count}")

        return entries


def main():
    downloads = '/Users/surya/Downloads'
    output_dir = '/Users/surya/Peekabooshades/Peeekabooshades-Website/frontend/public/images/fabrics/zebra'

    extractor = CompleteZebraExtractor(output_dir)

    # Step 1: Parse pricing PDF for categories and prices
    extractor.parse_pricing_pdf(f'{downloads}/2025 Zebra blind wholesale quotation.pdf')

    # Step 2: Extract images from both catalogs
    extractor.extract_catalog_images(
        f'{downloads}/ZSTARR Zebra Blinds Fabric Catalogue-A-2025.8.1.pdf',
        'Catalog A'
    )
    extractor.extract_catalog_images(
        f'{downloads}/ZSTARR Zebra Blinds Fabric Catalogue-B-2025.6.27.pdf',
        'Catalog B'
    )

    # Step 3: Generate database update file
    extractor.generate_database_update('zebra_fabrics_complete.json')

    print("\n=== Extraction Complete! ===")


if __name__ == '__main__':
    main()
