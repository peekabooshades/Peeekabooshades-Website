#!/usr/bin/env python3
"""
Extract all bottom rail images from PDF technical document page 13
"""

import fitz  # PyMuPDF
import os

PDF_PATH = "/Users/surya/Downloads/成品帘总目录册-印刷版-2025.5.16(1).pdf"
OUTPUT_DIR = "/Users/surya/Peekabooshades/Peeekabooshades-Website/frontend/public/images/hardware/zebra"

def extract_page_13_images():
    print(f"Opening PDF: {PDF_PATH}")
    doc = fitz.open(PDF_PATH)

    # Page 13 (0-indexed = page 12)
    page_num = 12
    page = doc[page_num]

    print(f"\nExtracting images from page {page_num + 1} (Bottom Rails)...")

    # Get all images on this page
    images = page.get_images(full=True)
    print(f"Found {len(images)} images on page {page_num + 1}")

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for idx, img in enumerate(images):
        xref = img[0]
        base_image = doc.extract_image(xref)
        image_bytes = base_image["image"]
        image_ext = base_image["ext"]
        width = base_image["width"]
        height = base_image["height"]

        # Save image with clear naming
        filename = f"page13_bottomrail_img{idx + 1}_{width}x{height}.{image_ext}"
        filepath = os.path.join(OUTPUT_DIR, filename)

        with open(filepath, "wb") as f:
            f.write(image_bytes)

        print(f"  {idx + 1}. {filename} ({width}x{height})")

    doc.close()
    print(f"\n✅ All {len(images)} images saved to: {OUTPUT_DIR}")

if __name__ == "__main__":
    extract_page_13_images()
