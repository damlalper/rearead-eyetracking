import re

# Parse log file
log_file = r"d:\Masaüstü\ReaRead2\companion\logs\companion.log"

gaze_points = []
with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        match = re.search(r'Gaze: \((\d+), (\d+)\)', line)
        if match:
            x, y = int(match.group(1)), int(match.group(2))
            gaze_points.append((x, y))

print("=" * 70)
print("ACCURACY ESTIMATION (Based on Movement Analysis)")
print("=" * 70)

# Calculate movement statistics
movements = []
for i in range(1, len(gaze_points)):
    prev_x, prev_y = gaze_points[i-1]
    curr_x, curr_y = gaze_points[i]
    distance = ((curr_x - prev_x)**2 + (curr_y - prev_y)**2)**0.5
    movements.append(distance)

# Movement-based accuracy estimation
# When user looks at the same point, small movements indicate jitter/noise
# This jitter is a proxy for accuracy

# Find stable sequences (likely looking at same spot)
stable_movements = [m for m in movements if m < 30]  # Likely same fixation point
jitter_movements = [m for m in movements if m < 10]   # Pure jitter

avg_movement = sum(movements) / len(movements)
avg_stable_movement = sum(stable_movements) / len(stable_movements) if stable_movements else 0
avg_jitter = sum(jitter_movements) / len(jitter_movements) if jitter_movements else 0

print(f"\nTotal movements analyzed: {len(movements)}")
print(f"\n1. OVERALL MOVEMENT:")
print(f"   Average movement: {avg_movement:.2f}px")
print(f"   Median movement:  {sorted(movements)[len(movements)//2]:.2f}px")

print(f"\n2. STABLE FIXATION ANALYSIS (<30px movements):")
print(f"   Count: {len(stable_movements)} ({100*len(stable_movements)/len(movements):.1f}%)")
print(f"   Average: {avg_stable_movement:.2f}px")

print(f"\n3. JITTER ANALYSIS (<10px movements):")
print(f"   Count: {len(jitter_movements)} ({100*len(jitter_movements)/len(movements):.1f}%)")
print(f"   Average jitter: {avg_jitter:.2f}px")

# Standard deviation of movements (lower = more stable)
import statistics
movement_std = statistics.stdev(movements)
stable_std = statistics.stdev(stable_movements) if len(stable_movements) > 1 else 0

print(f"\n4. STABILITY (Standard Deviation):")
print(f"   All movements: {movement_std:.2f}px")
print(f"   Stable fixations: {stable_std:.2f}px")

# Estimate accuracy based on jitter
# Eye-tracking literature: Human fixation stability ~0.5-1 degree
# At typical viewing distance (60cm) and screen size:
# 1 degree ≈ 50-60px on a 1920x1200 24" monitor

print(f"\n{'=' * 70}")
print("ESTIMATED ACCURACY:")
print(f"{'=' * 70}")

# Conservative estimates
print(f"\nBased on movement analysis:")
print(f"  - Jitter (noise): ~{avg_jitter:.1f}px")
print(f"  - Stable tracking: ~{avg_stable_movement:.1f}px")
print(f"  - Overall precision: ~{avg_movement:.1f}px")

# Visual angle estimation (approximate)
# Assuming 24" monitor, 1920x1200, 60cm viewing distance
monitor_width_cm = 51.8  # 24" = 51.8cm width
viewing_distance_cm = 60
px_per_cm = 1920 / monitor_width_cm
cm_per_degree = viewing_distance_cm * 0.01745  # tan(1 degree) ≈ 0.01745

px_per_degree = px_per_cm * cm_per_degree

accuracy_degrees = avg_jitter / px_per_degree
stable_degrees = avg_stable_movement / px_per_degree
overall_degrees = avg_movement / px_per_degree

print(f"\nVisual angle (approximate, assuming 60cm viewing distance):")
print(f"  - Jitter: ~{accuracy_degrees:.2f} degrees")
print(f"  - Stable tracking: ~{stable_degrees:.2f} degrees")
print(f"  - Overall: ~{overall_degrees:.2f} degrees")

print(f"\n{'=' * 70}")
print("READING SUITABILITY:")
print(f"{'=' * 70}")

# Reading analysis
# Average character width on screen: ~10-15px for normal reading text
# Word width: ~50-80px
# Line height: ~20-30px

char_width = 12  # Average character width in pixels
word_width = 60  # Average word width
line_height = 25  # Average line height

print(f"\nAssuming typical text rendering:")
print(f"  - Character width: ~{char_width}px")
print(f"  - Word width: ~{word_width}px")
print(f"  - Line height: ~{line_height}px")

print(f"\nAccuracy relative to text:")
print(f"  - Jitter ({avg_jitter:.1f}px) = ~{avg_jitter/char_width:.1f} characters")
print(f"  - Stable tracking ({avg_stable_movement:.1f}px) = ~{avg_stable_movement/char_width:.1f} characters")
print(f"  - Overall ({avg_movement:.1f}px) = ~{avg_movement/char_width:.1f} characters")

# Verdict
print(f"\n{'=' * 70}")
print("VERDICT:")
print(f"{'=' * 70}")

if avg_jitter < char_width:
    print(f"[EXCELLENT] Jitter ({avg_jitter:.1f}px) < 1 character - Sub-character precision")
elif avg_jitter < char_width * 2:
    print(f"[GOOD] Jitter ({avg_jitter:.1f}px) ≈ 1-2 characters - Word-level tracking")
else:
    print(f"[ACCEPTABLE] Jitter ({avg_jitter:.1f}px) ≈ {avg_jitter/char_width:.1f} characters")

if avg_stable_movement < word_width / 2:
    print(f"[EXCELLENT] Stable tracking ({avg_stable_movement:.1f}px) < 0.5 words - Intra-word precision")
elif avg_stable_movement < word_width:
    print(f"[GOOD] Stable tracking ({avg_stable_movement:.1f}px) ≈ 1 word - Word-level tracking")
else:
    print(f"[ACCEPTABLE] Stable tracking ({avg_stable_movement:.1f}px) ≈ {avg_stable_movement/word_width:.1f} words")

print(f"\n{'=' * 70}")
print("CONCLUSION:")
print(f"{'=' * 70}")

if avg_jitter < 15 and avg_stable_movement < 30:
    print("[OK] System suitable for reading tracking")
    print("     Can reliably track which word user is reading")
    if avg_jitter < 10:
        print("     High precision - may even detect sub-word focus")
else:
    print("[!] May have difficulty with precise word tracking")
    print("     Better suited for paragraph-level or region-based tracking")

print(f"{'=' * 70}")
