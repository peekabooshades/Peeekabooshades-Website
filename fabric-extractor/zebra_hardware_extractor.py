#!/usr/bin/env python3
"""
Zebra Hardware Extractor
Extracts valance and bottom rail images from PDF pages 12-13
"""

import fitz
import os

def extract_hardware_images(pdf_path, output_dir, pages=[11, 12]):
    """
    Extract hardware images from specific pages
    Pages 12-13 in PDF are 0-indexed as 11-12
    """
    os.makedirs(output_dir, exist_ok=True)

    doc = fitz.open(pdf_path)

    for page_num in pages:
        if page_num >= doc.page_count:
            print(f"Page {page_num + 1} not found in PDF")
            continue

        page = doc[page_num]

        # Get text to understand context
        text = page.get_text()
        print(f"\n=== Page {page_num + 1} ===")
        print(f"Text preview: {text[:500]}...")

        # Get all images on this page
        images = page.get_images(full=True)
        print(f"\nFound {len(images)} images on page {page_num + 1}")

        for img_idx, img in enumerate(images):
            xref = img[0]

            # Get image position on page
            rects = page.get_image_rects(xref)
            if not rects:
                continue

            rect = rects[0]
            x0, y0, x1, y1 = rect

            # Extract image data
            base_image = doc.extract_image(xref)
            width = base_image['width']
            height = base_image['height']
            ext = base_image['ext']
            data = base_image['image']

            # Calculate aspect ratio
            aspect = width / height if height > 0 else 0

            print(f"\n  Image {img_idx + 1}: {width}x{height} ({ext})")
            print(f"    Position: ({x0:.1f}, {y0:.1f}) to ({x1:.1f}, {y1:.1f})")
            print(f"    Aspect ratio: {aspect:.2f}")
            print(f"    Size: {len(data)} bytes")

            # Save all images with descriptive names
            # Page 12 = valance types, Page 13 = bottom rail
            page_type = "valance" if page_num == 11 else "bottom_rail"
            filename = f"zebra_{page_type}_p{page_num + 1}_img{img_idx + 1}_{width}x{height}.{ext}"
            filepath = os.path.join(output_dir, filename)

            with open(filepath, 'wb') as f:
                f.write(data)
            print(f"    Saved: {filename}")

    doc.close()
    print(f"\n\nExtraction complete! Images saved to: {output_dir}")


def render_page_as_image(pdf_path, output_dir, pages=[11, 12], zoom=2):
    """
    Render entire pages as images for reference
    """
    os.makedirs(output_dir, exist_ok=True)

    doc = fitz.open(pdf_path)

    for page_num in pages:
        if page_num >= doc.page_count:
            continue

        page = doc[page_num]

        # Render page at higher resolution
        mat = fitz.Matrix(zoom, zoom)
        pix = page.get_pixmap(matrix=mat)

        # Save as PNG
        filename = f"zebra_catalog_page_{page_num + 1}.png"
        filepath = os.path.join(output_dir, filename)
        pix.save(filepath)

        print(f"Rendered page {page_num + 1} as {filename}")

    doc.close()


if __name__ == '__main__':
    downloads = '/Users/surya/Downloads'
    pdf_path = f'{downloads}/成品帘总目录册-印刷版-2025.5.16(1).pdf'
    output_dir = '/Users/surya/Peekabooshades/Peeekabooshades-Website/frontend/public/images/hardware/zebra'

    # Extract individual images from pages 12-13
    extract_hardware_images(pdf_path, output_dir, pages=[11, 12])

    # Also render full pages for reference
    render_page_as_image(pdf_path, output_dir, pages=[11, 12])
