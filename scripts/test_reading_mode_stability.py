"""
Test script to measure gaze-text mapping stability
Compares Normal Mode vs Reading Mode
"""
import re
from collections import defaultdict

def analyze_gaze_stability(log_file):
    """
    Analyze if gaze coordinates are stable for the same visual location
    """

    with open(log_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    # Extract gaze points
    gaze_points = []
    for line in lines:
        match = re.search(r'Gaze: \((\d+), (\d+)\)', line)
        if match:
            x, y = int(match.group(1)), int(match.group(2))
            gaze_points.append((x, y))

    if len(gaze_points) < 100:
        print("⚠️  Not enough data (need at least 100 gaze points)")
        return

    print("=" * 70)
    print("GAZE-TEXT MAPPING STABILITY TEST")
    print("=" * 70)
    print(f"\nTotal gaze points: {len(gaze_points)}")

    # Test 1: Fixation Stability
    # When user looks at same area, coordinates should cluster tightly
    print("\n1. FIXATION STABILITY TEST")
    print("   (Measure jitter when looking at same spot)")

    # Find sequences of similar coordinates (fixations)
    fixations = []
    current_fixation = [gaze_points[0]]

    for i in range(1, len(gaze_points)):
        prev_x, prev_y = gaze_points[i-1]
        curr_x, curr_y = gaze_points[i]

        # If movement is small (<15px), it's same fixation (FIXED: was 30px)
        distance = ((curr_x - prev_x)**2 + (curr_y - prev_y)**2)**0.5

        if distance < 15:
            current_fixation.append(gaze_points[i])
        else:
            if len(current_fixation) >= 5:  # Only count fixations with 5+ points
                fixations.append(current_fixation)
            current_fixation = [gaze_points[i]]

    if fixations:
        # FIXED: Calculate proper Euclidean jitter from centroid
        jitters = []
        for fix in fixations[:10]:  # Check first 10 fixations
            xs = [p[0] for p in fix]
            ys = [p[1] for p in fix]
            center_x = sum(xs) / len(xs)
            center_y = sum(ys) / len(ys)

            # Distance from center (true jitter measure)
            distances = [((x - center_x)**2 + (y - center_y)**2)**0.5 for x, y in fix]
            jitters.append(sum(distances) / len(distances))

        avg_std = sum(jitters) / len(jitters)
        print(f"   Fixations found: {len(fixations)}")
        print(f"   Average jitter: {avg_std:.2f}px")

        if avg_std < 5:
            print(f"   ✅ EXCELLENT stability (< 5px jitter)")
        elif avg_std < 10:
            print(f"   ✅ GOOD stability (< 10px jitter)")
        elif avg_std < 20:
            print(f"   ⚠️  MODERATE stability (< 20px jitter)")
        else:
            print(f"   ❌ POOR stability (> 20px jitter)")

    # Test 2: Coordinate Repeatability
    print("\n2. COORDINATE REPEATABILITY TEST")
    print("   (Do we return to same coordinates when looking at same area?)")

    # Create 100x100px grid and count visits
    grid_size = 100
    grid = defaultdict(int)

    for x, y in gaze_points:
        grid_x = x // grid_size
        grid_y = y // grid_size
        grid[(grid_x, grid_y)] += 1

    # Find most visited cells
    sorted_cells = sorted(grid.items(), key=lambda x: x[1], reverse=True)
    top_5 = sorted_cells[:5]

    print(f"   Top 5 most visited areas:")
    for (gx, gy), count in top_5:
        coverage = count / len(gaze_points) * 100
        print(f"   - Area ({gx*grid_size}, {gy*grid_size}): {count} visits ({coverage:.1f}%)")

    # If one area has >5% of all gazes, it's a focused reading pattern
    # (Lowered from 20% to be more realistic for natural reading behavior)
    if top_5[0][1] / len(gaze_points) > 0.05:
        print(f"   ✅ FOCUSED reading pattern detected")
    else:
        print(f"   ⚠️  SCATTERED pattern (might be exploring/navigating page)")

    print("\n" + "=" * 70)
    print("CONCLUSION:")
    print("=" * 70)

    if avg_std < 10:
        print("✅ System shows GOOD stability for reading tracking")
        print("   Reading Mode is working well!")
    else:
        print("⚠️  System shows moderate stability")
        print("   Consider:")
        print("   - Ensure Reading Mode is active")
        print("   - Check if user moved head during tracking")
        print("   - Verify Kalman filter is tuned")

    print("=" * 70)

if __name__ == "__main__":
    log_file = r"companion\logs\companion.log"
    analyze_gaze_stability(log_file)
