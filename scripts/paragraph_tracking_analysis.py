"""
Paragraph Tracking Analysis - Reading Assistant Metric

This script evaluates whether the system can reliably detect
which PARAGRAPH the user is reading.

This is the CORRECT metric for reading assistance.
"""

import re
from collections import Counter

def analyze_paragraph_tracking(log_file):
    with open(log_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Extract paragraph indices
    paragraph_indices = []
    for line in lines:
        match = re.search(r'\[READING\] Paragraph: (-?\d+)', line)
        if match:
            idx = int(match.group(1))
            if idx >= 0:
                paragraph_indices.append(idx)

    if len(paragraph_indices) < 50:
        print("⚠️  Not enough reading data (need at least 50 samples)")
        print(f"   Found: {len(paragraph_indices)} samples")
        return

    print("=" * 70)
    print("PARAGRAPH TRACKING ANALYSIS")
    print("=" * 70)
    print(f"\nTotal valid reading samples: {len(paragraph_indices)}")

    # Distribution analysis
    counts = Counter(paragraph_indices)
    total = len(paragraph_indices)

    print("\n1. PARAGRAPH DISTRIBUTION")
    print("   (Where is the user mostly reading?)")

    for idx, count in counts.most_common(5):
        pct = (count / total) * 100
        print(f"   - Paragraph {idx}: {count} samples ({pct:.1f}%)")

    # Dominant paragraph metric (KEY METRIC)
    dominant_idx, dominant_count = counts.most_common(1)[0]
    dominant_ratio = dominant_count / total * 100

    print("\n2. DOMINANT PARAGRAPH METRIC")
    print("   (Is reading focused or scattered?)")
    print(f"   Dominant paragraph: {dominant_idx}")
    print(f"   Dominance ratio: {dominant_ratio:.1f}%")

    # Reading stability interpretation
    print("\n" + "=" * 70)
    print("FINAL VERDICT:")
    print("=" * 70)

    if dominant_ratio >= 70:
        print("✅ EXCELLENT - Reading focus is very stable")
        print("   System reliably detects where the user is reading")
        print("   Perfect for reading assistance features")
    elif dominant_ratio >= 55:
        print("✅ GOOD - Reading focus is mostly stable")
        print("   Minor gaze drift is expected with webcam eye tracking")
    elif dominant_ratio >= 40:
        print("⚠️  MODERATE - Reading focus is somewhat scattered")
        print("   May improve with smoothing or UI guidance")
    else:
        print("❌ POOR - Reading focus is unstable")
        print("   Check calibration, lighting, or overlay positioning")

    print("=" * 70)

if __name__ == "__main__":
    import sys
    import os

    if len(sys.argv) > 1:
        log_file = sys.argv[1]
        print(f"\n📂 Using log file: {log_file}\n")
    else:
        log_file = "browser_console.log"
        if not os.path.exists(log_file):
            print("\n⚠️  browser_console.log not found!")
            print("Export Chrome DevTools Console as browser_console.log")
            exit(1)

    analyze_paragraph_tracking(log_file)
