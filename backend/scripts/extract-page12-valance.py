#!/usr/bin/env python3
"""
Extract all valance/cassette images from PDF technical document page 12
"""

import fitz  # PyMuPDF
import os

PDF_PATH = "/Users/surya/Downloads/成品帘总目录册-印刷版-2025.5.16(1).pdf"
OUTPUT_DIR = "/Users/surya/Peekabooshades/Peeekabooshades-Website/frontend/public/images/hardware/zebra"

def extract_page_12_images():
    print(f"Opening PDF: {PDF_PATH}")
    doc = fitz.open(PDF_PATH)

    # Page 12 (0-indexed = page 11)
    page_num = 11
    page = doc[page_num]

    print(f"\nExtracting images from page {page_num + 1} (Valance/Cassette Types)...")

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
        filename = f"page12_valance_img{idx + 1}_{width}x{height}.{image_ext}"
        filepath = os.path.join(OUTPUT_DIR, filename)

        with open(filepath, "wb") as f:
            f.write(image_bytes)

        print(f"  {idx + 1}. {filename} ({width}x{height})")

    doc.close()
    print(f"\n✅ All {len(images)} images saved to: {OUTPUT_DIR}")

if __name__ == "__main__":
    extract_page_12_images()
