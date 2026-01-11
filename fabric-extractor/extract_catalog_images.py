#!/usr/bin/env python3
"""
Extract images from PDF catalog pages 13-15 for Zebra product page
"""

import fitz  # PyMuPDF
import os

def extract_images_from_pages(pdf_path, pages, output_dir):
    """Extract all images from specified pages"""
    os.makedirs(output_dir, exist_ok=True)

    doc = fitz.open(pdf_path)
    print(f"PDF has {doc.page_count} pages")

    extracted = []

    for page_num in pages:
        if page_num >= doc.page_count:
            print(f"Page {page_num + 1} does not exist (max: {doc.page_count})")
            continue

        page = doc[page_num]
        print(f"\n=== Page {page_num + 1} ===")

        # Get text to understand page content
        text = page.get_text()
        print(f"Text preview: {text[:200]}...")

        # Get all images on this page
        images = page.get_images(full=True)
        print(f"Found {len(images)} images")

        for idx, img in enumerate(images):
            xref = img[0]
            try:
                base_image = doc.extract_image(xref)
                width = base_image['width']
                height = base_image['height']
                ext = base_image['ext']

                # Skip very small images (likely icons)
                if width < 50 or height < 50:
                    continue

                filename = f"page{page_num + 1}_img{idx + 1}_{width}x{height}.{ext}"
                filepath = os.path.join(output_dir, filename)

                with open(filepath, 'wb') as f:
                    f.write(base_image['image'])

                print(f"  Saved: {filename}")
                extracted.append({
                    'page': page_num + 1,
                    'filename': filename,
                    'width': width,
                    'height': height
                })
            except Exception as e:
                print(f"  Error extracting image {idx}: {e}")

    doc.close()
    return extracted

def main():
    downloads = '/Users/surya/Downloads'
    pdf_path = f'{downloads}/成品帘总目录册-印刷版-2025.5.16(1).pdf'

    # Output to images folder
    output_dir = '/Users/surya/Peekabooshades/Peeekabooshades-Website/frontend/public/images/catalog-extracted'

    # Pages 13, 14, 15 (0-indexed: 12, 13, 14)
    pages = [12, 13, 14]

    print(f"Extracting images from: {pdf_path}")
    print(f"Output directory: {output_dir}")

    if not os.path.exists(pdf_path):
        print(f"ERROR: PDF not found at {pdf_path}")
        return

    extracted = extract_images_from_pages(pdf_path, pages, output_dir)

    print(f"\n=== Summary ===")
    print(f"Total images extracted: {len(extracted)}")
    for img in extracted:
        print(f"  Page {img['page']}: {img['filename']}")

if __name__ == '__main__':
    main()
