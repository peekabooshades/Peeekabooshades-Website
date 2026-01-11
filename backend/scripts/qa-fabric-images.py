#!/usr/bin/env python3
"""
QA Test Script: Zebra Fabric Images
Validates fabric images are present, accessible, and correctly linked.

Usage:
    python3 qa-fabric-images.py [--fix] [--extract-from-pdf]

Options:
    --fix               Auto-fix missing hasImage flags in database
    --extract-from-pdf  Extract missing images from PDF catalogs
"""

import json
import os
import sys
import urllib.request
from datetime import datetime

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
FRONTEND_DIR = os.path.join(os.path.dirname(BACKEND_DIR), 'frontend', 'public')
IMAGE_DIR = os.path.join(FRONTEND_DIR, 'images', 'fabrics', 'zebra')
DB_PATH = os.path.join(BACKEND_DIR, 'database.json')
DOWNLOADS_DIR = '/Users/surya/Downloads'

# PDF Catalogs
CATALOG_A = os.path.join(DOWNLOADS_DIR, 'ZSTARR Zebra Blinds Fabric Catalogue-A-2025.8.1.pdf')
CATALOG_B = os.path.join(DOWNLOADS_DIR, 'ZSTARR Zebra Blinds Fabric Catalogue-B-2025.6.27.pdf')


class QATestResult:
    def __init__(self, name):
        self.name = name
        self.passed = 0
        self.failed = 0
        self.warnings = 0
        self.details = []

    def add_pass(self, msg):
        self.passed += 1
        self.details.append(('PASS', msg))

    def add_fail(self, msg):
        self.failed += 1
        self.details.append(('FAIL', msg))

    def add_warn(self, msg):
        self.warnings += 1
        self.details.append(('WARN', msg))

    def print_summary(self):
        status = "PASSED" if self.failed == 0 else "FAILED"
        print(f"\n{'='*60}")
        print(f"TEST: {self.name} - {status}")
        print(f"{'='*60}")
        print(f"  Passed: {self.passed}")
        print(f"  Failed: {self.failed}")
        print(f"  Warnings: {self.warnings}")

        if self.failed > 0:
            print("\nFailures:")
            for status, msg in self.details:
                if status == 'FAIL':
                    print(f"  - {msg}")


def load_database():
    """Load the database.json file."""
    with open(DB_PATH, 'r') as f:
        return json.load(f)


def save_database(db):
    """Save the database.json file."""
    with open(DB_PATH, 'w') as f:
        json.dump(db, f, indent=2)


def get_existing_images():
    """Get all existing image files."""
    images = {}
    for f in os.listdir(IMAGE_DIR):
        if f.endswith(('.png', '.jpeg', '.jpg')):
            code = f.split('.')[0]
            ext = f.split('.')[-1]
            # Prefer PNG over JPEG
            if code not in images or ext == 'png':
                images[code] = f'/images/fabrics/zebra/{f}'
    return images


def test_database_integrity():
    """Test 1: Verify database has all required fabric entries."""
    result = QATestResult("Database Integrity")
    db = load_database()

    fabrics = db.get('zebraFabrics', [])
    prices = db.get('zebraManufacturerPrices', [])

    # Check fabric count
    if len(fabrics) == 176:
        result.add_pass(f"Fabric count correct: {len(fabrics)}")
    else:
        result.add_fail(f"Expected 176 fabrics, found {len(fabrics)}")

    # Check price count
    if len(prices) == 176:
        result.add_pass(f"Price count correct: {len(prices)}")
    else:
        result.add_fail(f"Expected 176 prices, found {len(prices)}")

    # Check category distribution
    expected = {'semi-blackout': 111, 'blackout': 50, 'super-blackout': 15}
    for cat, count in expected.items():
        actual = len([f for f in fabrics if f['category'] == cat])
        if actual == count:
            result.add_pass(f"{cat}: {actual} fabrics")
        else:
            result.add_fail(f"{cat}: expected {count}, found {actual}")

    result.print_summary()
    return result


def test_image_files_exist():
    """Test 2: Verify image files exist on disk."""
    result = QATestResult("Image Files Exist")
    db = load_database()

    existing = get_existing_images()
    fabrics = db.get('zebraFabrics', [])

    for fabric in fabrics:
        code = fabric['code']
        if code in existing:
            result.add_pass(f"{code}: Image file exists")
        else:
            result.add_fail(f"{code}: Image file MISSING")

    result.print_summary()
    return result


def test_database_hasimage_flags():
    """Test 3: Verify hasImage flags match actual files."""
    result = QATestResult("hasImage Flags Accuracy")
    db = load_database()

    existing = get_existing_images()
    fabrics = db.get('zebraFabrics', [])

    mismatches = []
    for fabric in fabrics:
        code = fabric['code']
        has_file = code in existing
        has_flag = fabric.get('hasImage', False)

        if has_file and has_flag:
            result.add_pass(f"{code}: Flag matches file (both True)")
        elif not has_file and not has_flag:
            result.add_pass(f"{code}: Flag matches file (both False)")
        elif has_file and not has_flag:
            result.add_fail(f"{code}: File exists but hasImage=False")
            mismatches.append((code, 'set_true'))
        else:
            result.add_fail(f"{code}: hasImage=True but file missing")
            mismatches.append((code, 'set_false'))

    result.print_summary()
    return result, mismatches


def test_image_accessibility(base_url='http://localhost:3001'):
    """Test 4: Verify images are accessible via HTTP."""
    result = QATestResult("Image HTTP Accessibility")
    db = load_database()

    fabrics = db.get('zebraFabrics', [])

    # Test a sample of images
    sample_codes = ['83046A', '83003A', '83009A', '83042A', '83071A']

    for fabric in fabrics:
        if fabric['code'] not in sample_codes:
            continue

        code = fabric['code']
        image_path = fabric.get('image', '')

        if not image_path:
            result.add_fail(f"{code}: No image path set")
            continue

        url = base_url + image_path
        try:
            req = urllib.request.urlopen(url, timeout=5)
            size = len(req.read())
            if size > 1000:  # At least 1KB
                result.add_pass(f"{code}: Accessible ({size} bytes)")
            else:
                result.add_warn(f"{code}: File too small ({size} bytes)")
        except Exception as e:
            result.add_fail(f"{code}: HTTP error - {e}")

    result.print_summary()
    return result


def fix_hasimage_flags():
    """Fix mismatched hasImage flags in database."""
    print("\n=== Fixing hasImage Flags ===")

    db = load_database()
    existing = get_existing_images()

    fixed = 0
    for fabric in db.get('zebraFabrics', []):
        code = fabric['code']
        should_have = code in existing

        if fabric.get('hasImage', False) != should_have:
            fabric['hasImage'] = should_have
            if should_have:
                fabric['image'] = existing[code]
            fixed += 1

    save_database(db)
    print(f"Fixed {fixed} fabric entries")


def run_all_tests():
    """Run all QA tests."""
    print("=" * 60)
    print("ZEBRA FABRIC IMAGES - QA TEST SUITE")
    print(f"Timestamp: {datetime.now().isoformat()}")
    print("=" * 60)

    results = []

    # Test 1: Database integrity
    results.append(test_database_integrity())

    # Test 2: Image files exist
    results.append(test_image_files_exist())

    # Test 3: hasImage flags
    flag_result, mismatches = test_database_hasimage_flags()
    results.append(flag_result)

    # Test 4: HTTP accessibility
    results.append(test_image_accessibility())

    # Final summary
    print("\n" + "=" * 60)
    print("FINAL SUMMARY")
    print("=" * 60)

    total_passed = sum(r.passed for r in results)
    total_failed = sum(r.failed for r in results)
    total_warnings = sum(r.warnings for r in results)

    print(f"Total Passed: {total_passed}")
    print(f"Total Failed: {total_failed}")
    print(f"Total Warnings: {total_warnings}")

    overall = "PASSED" if total_failed == 0 else "FAILED"
    print(f"\nOverall Status: {overall}")

    return total_failed == 0


def main():
    args = sys.argv[1:]

    if '--fix' in args:
        fix_hasimage_flags()
    elif '--extract-from-pdf' in args:
        print("PDF extraction not implemented in this script.")
        print("Use complete_zebra_extractor.py instead.")
    else:
        success = run_all_tests()
        sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
