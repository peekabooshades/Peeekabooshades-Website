#!/usr/bin/env python3
"""
Zebra Blinds Fabric Extractor
Extracts fabric swatches, specifications, and pricing from PDF catalogs
"""

import fitz  # PyMuPDF
import os
import re
import json
from PIL import Image
import io


class ZebraFabricExtractor:
    """
    Extracts fabric swatch images and specifications from Zebra Blinds catalogs
    """

    def __init__(self, output_dir='../frontend/public/images/fabrics/zebra'):
        self.output_dir = output_dir
        self.fabrics = []
        self.pricing = {}

        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)

    def parse_pricing_pdf(self, pricing_pdf_path):
        """
        Parse the wholesale quotation PDF to extract pricing data
        """
        print(f"\n{'='*60}")
        print("PARSING PRICING PDF")
        print('='*60)

        doc = fitz.open(pricing_pdf_path)

        for page_num in range(doc.page_count):
            page = doc[page_num]
            text = page.get_text()

            # Parse pricing entries
            self._parse_pricing_page(text)

        doc.close()
        print(f"Extracted pricing for {len(self.pricing)} fabric series")
        return self.pricing

    def _parse_pricing_page(self, text):
        """
        Parse a single page of pricing data
        """
        lines = text.split('\n')

        current_series = None
        current_specs = {}

        i = 0
        while i < len(lines):
            line = lines[i].strip()

            # Look for fabric codes (e.g., 83003A, 83052B)
            fabric_match = re.findall(r'(830\d{2}[A-Z]?)', line)

            if fabric_match:
                # Found fabric codes
                series_match = re.search(r'830\d{2}', line)
                if series_match:
                    series = series_match.group(0)

                    if series not in self.pricing:
                        self.pricing[series] = {
                            'series': series,
                            'variants': fabric_match,
                            'composition': '',
                            'finished_width': '300 cm',
                            'shading': '',
                            'weight': '',
                            'repeat': '',
                            'cordless_price': 0,
                            'bead_chain_price': 0
                        }

            # Parse composition
            if 'Composition:' in line or 'Composition' in line:
                comp = line.replace('Composition:', '').replace('Composition', '').strip()
                if current_series and comp:
                    self.pricing[current_series]['composition'] = comp

            # Parse prices - look for dollar amounts
            price_match = re.findall(r'\$(\d+\.?\d*)', line)
            if len(price_match) >= 2:
                # Usually format is: Cordless, Bead Chain
                for series in self.pricing:
                    if not self.pricing[series]['cordless_price']:
                        self.pricing[series]['cordless_price'] = float(price_match[0])
                        self.pricing[series]['bead_chain_price'] = float(price_match[1])
                        break

            i += 1

    def extract_fabric_catalog(self, catalog_pdf_path, catalog_name='A'):
        """
        Extract fabric swatches and specifications from a catalog PDF
        """
        print(f"\n{'='*60}")
        print(f"EXTRACTING CATALOG {catalog_name}: {catalog_pdf_path}")
        print('='*60)

        doc = fitz.open(catalog_pdf_path)

        for page_num in range(doc.page_count):
            page = doc[page_num]
            text = page.get_text()

            # Extract fabric series info from this page
            fabric_info = self._parse_fabric_page(text, page_num + 1)

            if fabric_info and fabric_info.get('series'):
                print(f"\nPage {page_num + 1}: Series {fabric_info['series']}")

                # Extract images from this page
                images = self._extract_page_images(doc, page, fabric_info)
                fabric_info['images'] = images
                fabric_info['catalog'] = catalog_name

                self.fabrics.append(fabric_info)

        doc.close()
        return self.fabrics

    def _parse_fabric_page(self, text, page_num):
        """
        Parse fabric specifications from page text
        """
        info = {
            'page': page_num,
            'series': '',
            'variants': [],
            'composition': '',
            'finished_width': '',
            'shading': '',
            'weight': '',
            'repeat': '',
            'color_fastness': '',
            'special_features': []
        }

        # Find series number (e.g., "series 83040" or "83040 series")
        series_match = re.search(r'(?:series\s*)?(830\d{2})(?:\s*series)?', text, re.IGNORECASE)
        if series_match:
            info['series'] = series_match.group(1)

        # Find all variant codes (e.g., 83040A, 83040B)
        variant_matches = re.findall(r'(830\d{2}[A-Z])', text)
        info['variants'] = list(set(variant_matches))

        # Parse composition
        comp_match = re.search(r'Composition\s*[:\n\s]*([^\n]+(?:Polyester|PVC|Linen)[^\n]*)', text, re.IGNORECASE)
        if comp_match:
            info['composition'] = comp_match.group(1).strip()

        # Parse finished width
        width_match = re.search(r'Finished width\s*[:\n\s]*(\d+)\s*cm', text, re.IGNORECASE)
        if width_match:
            info['finished_width'] = f"{width_match.group(1)} cm"

        # Parse shading effect
        if 'super-blackout' in text.lower():
            info['shading'] = 'super-blackout'
        elif 'semi-blackout' in text.lower():
            info['shading'] = 'semi-blackout'
        elif 'blackout' in text.lower():
            info['shading'] = 'blackout'

        # Parse weight
        weight_match = re.search(r'Weight per m[²2]\s*[:\n\s]*(\d+g/m[²2][^\n]*)', text, re.IGNORECASE)
        if weight_match:
            info['weight'] = weight_match.group(1).strip()

        # Parse solid & sheer repeat
        repeat_match = re.search(r'Solid.*?repeat\s*[:\n\s]*([\d\.*]+cm[^\n]*)', text, re.IGNORECASE)
        if repeat_match:
            info['repeat'] = repeat_match.group(1).strip()

        # Parse color fastness
        fastness_match = re.search(r'Color fastness\s*[:\n\s]*(\d+[^\n]*Grade)', text, re.IGNORECASE)
        if fastness_match:
            info['color_fastness'] = fastness_match.group(1).strip()

        # Check for special features
        special_features = []
        if 'Water Resistance' in text or 'waterproof' in text.lower():
            special_features.append('Water Resistant')
        if 'Fire Resistance' in text:
            special_features.append('Fire Resistant')
        if 'Mildew Proof' in text:
            special_features.append('Mildew Proof')
        if 'Formaldehyde' in text:
            special_features.append('Formaldehyde Free')
        if 'Anti-bacteria' in text:
            special_features.append('Anti-bacterial')
        if 'Sterilizing' in text:
            special_features.append('Sterilizing')

        info['special_features'] = special_features

        return info

    def _extract_page_images(self, doc, page, fabric_info):
        """
        Extract fabric swatch images from a page
        """
        images = []
        page_images = page.get_images(full=True)
        series = fabric_info.get('series', '')
        variants = sorted(fabric_info.get('variants', []))

        # Filter and sort images by size (fabric swatches are typically similar sizes)
        valid_images = []
        for img in page_images:
            xref = img[0]
            base_image = doc.extract_image(xref)
            width = base_image['width']
            height = base_image['height']

            # Fabric swatches are typically large images (> 1000px)
            if width > 1000 and height > 1000:
                valid_images.append({
                    'xref': xref,
                    'width': width,
                    'height': height,
                    'ext': base_image['ext'],
                    'image_data': base_image['image']
                })

        print(f"  Found {len(valid_images)} fabric swatch images")

        # Match images with variants (assuming order matches)
        for idx, img_data in enumerate(valid_images):
            if idx < len(variants):
                variant = variants[idx]
            else:
                variant = f"{series}{chr(65 + idx)}"  # Generate A, B, C, etc.

            # Save image
            filename = f"{variant}.{img_data['ext']}"
            filepath = os.path.join(self.output_dir, filename)

            with open(filepath, 'wb') as f:
                f.write(img_data['image_data'])

            print(f"  Saved: {filename}")

            images.append({
                'variant': variant,
                'filename': filename,
                'width': img_data['width'],
                'height': img_data['height']
            })

        return images

    def merge_with_pricing(self):
        """
        Merge fabric specifications with pricing data
        """
        print(f"\n{'='*60}")
        print("MERGING SPECIFICATIONS WITH PRICING")
        print('='*60)

        for fabric in self.fabrics:
            series = fabric['series']
            if series in self.pricing:
                pricing = self.pricing[series]
                fabric['cordless_price'] = pricing['cordless_price']
                fabric['bead_chain_price'] = pricing['bead_chain_price']
                print(f"  {series}: Cordless ${pricing['cordless_price']}, Bead Chain ${pricing['bead_chain_price']}")
            else:
                # Default pricing if not found
                fabric['cordless_price'] = 0
                fabric['bead_chain_price'] = 0
                print(f"  {series}: No pricing found")

        return self.fabrics

    def generate_database_json(self, output_path='zebra_fabrics.json'):
        """
        Generate JSON data for database import
        """
        print(f"\n{'='*60}")
        print("GENERATING DATABASE JSON")
        print('='*60)

        db_fabrics = []

        for fabric in self.fabrics:
            for variant in fabric.get('variants', []):
                # Find image for this variant
                image_info = next(
                    (img for img in fabric.get('images', []) if img['variant'] == variant),
                    None
                )

                db_fabric = {
                    'code': variant,
                    'series': fabric['series'],
                    'name': f"Zebra {variant}",
                    'composition': fabric.get('composition', '100% Polyester'),
                    'finished_width': fabric.get('finished_width', '300 cm'),
                    'shading': fabric.get('shading', 'semi-blackout'),
                    'weight': fabric.get('weight', ''),
                    'repeat': fabric.get('repeat', ''),
                    'color_fastness': fabric.get('color_fastness', ''),
                    'special_features': fabric.get('special_features', []),
                    'cordless_price': fabric.get('cordless_price', 0),
                    'bead_chain_price': fabric.get('bead_chain_price', 0),
                    'image': f"/images/fabrics/zebra/{variant}.png" if image_info else '',
                    'thumbnail': f"/images/fabrics/zebra/{variant}.png" if image_info else ''
                }

                db_fabrics.append(db_fabric)

        # Save to JSON file
        with open(output_path, 'w') as f:
            json.dump(db_fabrics, f, indent=2)

        print(f"Saved {len(db_fabrics)} fabrics to {output_path}")
        return db_fabrics

    def generate_specs_table(self, output_path='zebra_specs.json'):
        """
        Generate specifications table JSON
        """
        specs_table = []

        for fabric in self.fabrics:
            spec = {
                'series': fabric['series'],
                'variants': fabric.get('variants', []),
                'composition': fabric.get('composition', ''),
                'finished_width': fabric.get('finished_width', ''),
                'shading': fabric.get('shading', ''),
                'weight': fabric.get('weight', ''),
                'repeat': fabric.get('repeat', ''),
                'color_fastness': fabric.get('color_fastness', ''),
                'special_features': fabric.get('special_features', [])
            }
            specs_table.append(spec)

        with open(output_path, 'w') as f:
            json.dump(specs_table, f, indent=2)

        print(f"Saved specifications table to {output_path}")
        return specs_table

    def generate_pricing_table(self, output_path='zebra_pricing.json'):
        """
        Generate pricing table JSON
        """
        pricing_table = []

        for series, data in self.pricing.items():
            pricing = {
                'series': series,
                'variants': data.get('variants', []),
                'cordless_price': data.get('cordless_price', 0),
                'bead_chain_price': data.get('bead_chain_price', 0)
            }
            pricing_table.append(pricing)

        with open(output_path, 'w') as f:
            json.dump(pricing_table, f, indent=2)

        print(f"Saved pricing table to {output_path}")
        return pricing_table


def main():
    """
    Main extraction process
    """
    print("="*60)
    print("ZEBRA BLINDS FABRIC EXTRACTOR")
    print("="*60)

    # Paths to PDF files
    downloads_dir = '/Users/surya/Downloads'
    pricing_pdf = os.path.join(downloads_dir, '2025 Zebra blind wholesale quotation.pdf')
    catalog_a = os.path.join(downloads_dir, 'ZSTARR Zebra Blinds Fabric Catalogue-A-2025.8.1.pdf')
    catalog_b = os.path.join(downloads_dir, 'ZSTARR Zebra Blinds Fabric Catalogue-B-2025.6.27.pdf')

    # Output directory for images
    output_dir = '/Users/surya/Peekabooshades/Peeekabooshades-Website/frontend/public/images/fabrics/zebra'

    # Initialize extractor
    extractor = ZebraFabricExtractor(output_dir)

    # Step 1: Parse pricing data
    extractor.parse_pricing_pdf(pricing_pdf)

    # Step 2: Extract fabric catalogs
    extractor.extract_fabric_catalog(catalog_a, 'A')
    extractor.extract_fabric_catalog(catalog_b, 'B')

    # Step 3: Merge with pricing
    extractor.merge_with_pricing()

    # Step 4: Generate output files
    fabrics_json = extractor.generate_database_json('zebra_fabrics.json')
    specs_table = extractor.generate_specs_table('zebra_specs.json')
    pricing_table = extractor.generate_pricing_table('zebra_pricing.json')

    print(f"\n{'='*60}")
    print("EXTRACTION COMPLETE")
    print('='*60)
    print(f"Total fabric series: {len(extractor.fabrics)}")
    print(f"Total fabric variants: {len(fabrics_json)}")
    print(f"Images saved to: {output_dir}")

    return extractor


if __name__ == '__main__':
    main()
