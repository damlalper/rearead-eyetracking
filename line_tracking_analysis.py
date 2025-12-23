"""
Line Tracking Analysis - Experimental Reading Metric

Evaluates whether gaze stays on the SAME LINE
within the SAME PARAGRAPH.
"""

import re
from collections import Counter

def analyze_line_tracking(log_file):
    with open(log_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    data = []
    for line in lines:
        match = re.search(
            r'\[READING_LINE\] Paragraph: (\d+), Line: (\d+)', line
        )
        if match:
            p = int(match.group(1))
            l = int(match.group(2))
            data.append((p, l))

    if len(data) < 50:
        print("⚠️ Not enough line data")
        return

    print("=" * 70)
    print("LINE TRACKING ANALYSIS (EXPERIMENTAL)")
    print("=" * 70)
    print(f"\nTotal samples: {len(data)}")

    # Group by paragraph
    paragraph_groups = {}
    for p, l in data:
        paragraph_groups.setdefault(p, []).append(l)

    print("\n1. LINE STABILITY PER PARAGRAPH")

    stable_paragraphs = 0
    for p, lines_in_p in paragraph_groups.items():
        counts = Counter(lines_in_p)
        dominant_line, dominant_count = counts.most_common(1)[0]
        dominance = dominant_count / len(lines_in_p) * 100

        print(
            f"Paragraph {p}: dominant line {dominant_line} "
            f"({dominance:.1f}%)"
        )

        if dominance >= 50:
            stable_paragraphs += 1

    print("\n2. OVERALL ASSESSMENT")
    rate = stable_paragraphs / len(paragraph_groups) * 100
    print(f"Stable paragraphs: {stable_paragraphs}/{len(paragraph_groups)}")
    print(f"Stability rate: {rate:.1f}%")

    print("\n" + "=" * 70)
    print("FINAL VERDICT:")
    print("=" * 70)

    if rate >= 60:
        print("✅ GOOD - Line tracking works reasonably well")
        print("   Suitable as an enhancement to paragraph tracking")
    elif rate >= 40:
        print("⚠️ MODERATE - Line tracking partially reliable")
        print("   Expected for webcam-based eye tracking")
    else:
        print("❌ POOR - Line tracking unstable")
        print("   Paragraph-level tracking should be preferred")

    print("=" * 70)

if __name__ == "__main__":
    analyze_line_tracking("browser_console.log")
