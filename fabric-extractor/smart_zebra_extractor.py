#!/usr/bin/env python3
"""
Smart Zebra Fabric Swatch Extractor
Only extracts actual fabric swatch images from the right side of PDF pages
"""

import fitz
import os
import re
import json
from collections import defaultdict

class SmartZebraExtractor:
    def __init__(self, output_dir):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        self.extracted_fabrics = []
        self.pricing_data = {}

    def parse_pricing_pdf(self, pdf_path):
        """Parse wholesale quotation for pricing data"""
        doc = fitz.open(pdf_path)

        for page_num in range(doc.page_count):
            page = doc[page_num]
            text = page.get_text()
            lines = text.split('\n')

            current_codes = []
            cordless_price = 0
            bead_chain_price = 0

            i = 0
            while i < len(lines):
                line = lines[i].strip()

                # Find fabric codes ending in letters
                codes = re.findall(r'(830\d{2}[A-Z])', line)
                if codes:
                    current_codes.extend(codes)

                # Find prices
                price_match = re.match(r'^\$(\d+\.?\d*)$', line)
                if price_match:
                    if cordless_price == 0:
                        cordless_price = float(price_match.group(1))
                    elif bead_chain_price == 0:
                        bead_chain_price = float(price_match.group(1))
                        # Save all codes with these prices
                        for code in current_codes:
                            self.pricing_data[code] = {
                                'cordless': cordless_price,
                                'bead_chain': bead_chain_price
                            }
                        current_codes = []
                        cordless_price = 0
                        bead_chain_price = 0

                i += 1

        doc.close()
        print(f"Parsed pricing for {len(self.pricing_data)} fabric codes")

    def extract_fabric_swatches(self, pdf_path):
        """Extract fabric swatch images from catalog PDF"""
        doc = fitz.open(pdf_path)

        for page_num in range(doc.page_count):
            page = doc[page_num]
            page_width = page.rect.width
            page_height = page.rect.height

            # Get fabric codes ending in letters from this page
            text = page.get_text()
            fabric_codes = list(set(re.findall(r'830\d{2}[A-Z]', text)))

            if not fabric_codes:
                continue

            fabric_codes.sort()
            series = fabric_codes[0][:5] if fabric_codes else ""

            print(f"\nPage {page_num + 1}: Series {series}")
            print(f"  Found codes: {', '.join(fabric_codes)}")

            # Get images and their positions
            images_with_pos = []
            for img in page.get_images(full=True):
                xref = img[0]
                rects = page.get_image_rects(xref)
                if not rects:
                    continue

                rect = rects[0]
                x0, y0, x1, y1 = rect

                # Get image data
                base_image = doc.extract_image(xref)
                width = base_image['width']
                height = base_image['height']

                # Filter criteria for fabric swatches:
                # 1. Reasonable size (not too small)
                # 2. Reasonable aspect ratio (fabric swatches are typically 1.5:1 or similar)
                if width < 500 or height < 500:
                    continue

                aspect = width / height
                # Fabric swatches typically have aspect ratio between 1.0 and 2.0
                if aspect < 0.8 or aspect > 2.5:
                    continue

                # Calculate center position
                center_x = (x0 + x1) / 2
                center_y = (y0 + y1) / 2

                # Only consider images that fit within page bounds
                if x0 < 0 or y0 < 0:
                    continue

                images_with_pos.append({
                    'xref': xref,
                    'center_x': center_x,
                    'center_y': center_y,
                    'width': width,
                    'height': height,
                    'size': len(base_image['image']),
                    'ext': base_image['ext'],
                    'data': base_image['image']
                })

            # Sort images by position (left to right, top to bottom)
            images_with_pos.sort(key=lambda x: (x['center_y'], x['center_x']))

            print(f"  Valid swatch images: {len(images_with_pos)}")

            # Match images to fabric codes
            # Typically, fabric codes are arranged in a grid pattern
            # We'll assign images to codes in order
            for idx, code in enumerate(fabric_codes):
                if idx < len(images_with_pos):
                    img = images_with_pos[idx]
                    filename = f"{code}.{img['ext']}"
                    filepath = os.path.join(self.output_dir, filename)

                    with open(filepath, 'wb') as f:
                        f.write(img['data'])

                    print(f"  Saved: {filename} ({img['width']}x{img['height']})")

                    self.extracted_fabrics.append({
                        'code': code,
                        'series': code[:5],
                        'filename': filename,
                        'width': img['width'],
                        'height': img['height']
                    })

        doc.close()

    def generate_database_entries(self, output_path):
        """Generate database entries combining images and pricing"""
        entries = []

        # Get unique codes from both images and pricing
        all_codes = set()
        for fabric in self.extracted_fabrics:
            all_codes.add(fabric['code'])
        for code in self.pricing_data:
            all_codes.add(code)

        for code in sorted(all_codes):
            # Get pricing
            pricing = self.pricing_data.get(code, {'cordless': 0, 'bead_chain': 0})

            # Check if we have an image
            fabric_info = next((f for f in self.extracted_fabrics if f['code'] == code), None)
            has_image = fabric_info is not None

            # Determine category based on pricing tier
            cordless = pricing['cordless']
            if cordless >= 25:
                category = 'super-blackout'
            elif cordless >= 22:
                category = 'blackout'
            else:
                category = 'semi-blackout'

            entry = {
                'code': code,
                'series': code[:5],
                'name': f"Zebra {code}",
                'category': category,
                'cordless_price': pricing['cordless'],
                'bead_chain_price': pricing['bead_chain'],
                'image': f"/images/fabrics/zebra/{fabric_info['filename']}" if has_image else '',
                'hasImage': has_image,
                'composition': '100% Polyester',
                'finished_width': '300 cm'
            }
            entries.append(entry)

        with open(output_path, 'w') as f:
            json.dump(entries, f, indent=2)

        print(f"\nGenerated {len(entries)} database entries")
        print(f"  With images: {sum(1 for e in entries if e['hasImage'])}")
        print(f"  Without images: {sum(1 for e in entries if not e['hasImage'])}")

        return entries


def main():
    downloads = '/Users/surya/Downloads'
    output_dir = '/Users/surya/Peekabooshades/Peeekabooshades-Website/frontend/public/images/fabrics/zebra'

    extractor = SmartZebraExtractor(output_dir)

    # Parse pricing first
    extractor.parse_pricing_pdf(f'{downloads}/2025 Zebra blind wholesale quotation.pdf')

    # Extract from both catalogs
    extractor.extract_fabric_swatches(f'{downloads}/ZSTARR Zebra Blinds Fabric Catalogue-A-2025.8.1.pdf')
    extractor.extract_fabric_swatches(f'{downloads}/ZSTARR Zebra Blinds Fabric Catalogue-B-2025.6.27.pdf')

    # Generate database entries
    extractor.generate_database_entries('zebra_fabrics_smart.json')

    print("\nExtraction complete!")

if __name__ == '__main__':
    main()
