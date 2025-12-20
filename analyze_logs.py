import re
from collections import defaultdict

# Parse log file
log_file = r"d:\Masaüstü\ReaRead2\companion\logs\companion.log"

gaze_points = []
with open(log_file, 'r', encoding='utf-8') as f:
    for line in f:
        match = re.search(r'Gaze: \((\d+), (\d+)\)', line)
        if match:
            x, y = int(match.group(1)), int(match.group(2))
            gaze_points.append((x, y))

# Screen dimensions
SCREEN_WIDTH = 1920
SCREEN_HEIGHT = 1200

print("=" * 70)
print("GAZE DATA ANALYSIS REPORT")
print("=" * 70)
print(f"\nTotal gaze points: {len(gaze_points)}")
print(f"Screen resolution: {SCREEN_WIDTH}x{SCREEN_HEIGHT}")

# 1. Out-of-screen coordinates (should be 0 with clamping)
out_of_screen = 0
for x, y in gaze_points:
    if x < 0 or x >= SCREEN_WIDTH or y < 0 or y >= SCREEN_HEIGHT:
        out_of_screen += 1

print(f"\n1. OUT-OF-SCREEN COORDINATES:")
print(f"   Count: {out_of_screen} ({100*out_of_screen/len(gaze_points):.2f}%)")
print(f"   [OK] Clamp working: {out_of_screen == 0}")

# 2. Clamped to boundaries (x=0, y=0, x=1919, y=1199)
boundary_clamps = {
    'left (x=0)': 0,
    'right (x=1919)': 0,
    'top (y=0)': 0,
    'bottom (y=1199)': 0
}

for x, y in gaze_points:
    if x == 0:
        boundary_clamps['left (x=0)'] += 1
    if x == SCREEN_WIDTH - 1:
        boundary_clamps['right (x=1919)'] += 1
    if y == 0:
        boundary_clamps['top (y=0)'] += 1
    if y == SCREEN_HEIGHT - 1:
        boundary_clamps['bottom (y=1199)'] += 1

print(f"\n2. BOUNDARY CLAMPING (coordinates at edge):")
for edge, count in boundary_clamps.items():
    print(f"   {edge}: {count} points ({100*count/len(gaze_points):.2f}%)")

# 3. Large jumps (>200px)
large_jumps = []
for i in range(1, len(gaze_points)):
    prev_x, prev_y = gaze_points[i-1]
    curr_x, curr_y = gaze_points[i]
    distance = ((curr_x - prev_x)**2 + (curr_y - prev_y)**2)**0.5
    if distance > 200:
        large_jumps.append({
            'index': i,
            'from': (prev_x, prev_y),
            'to': (curr_x, curr_y),
            'distance': distance
        })

print(f"\n3. LARGE JUMPS (>200px):")
print(f"   Count: {len(large_jumps)} ({100*len(large_jumps)/len(gaze_points):.2f}%)")
if large_jumps:
    print(f"   Largest jump: {max(large_jumps, key=lambda x: x['distance'])['distance']:.1f}px")
    print(f"   Average jump: {sum(j['distance'] for j in large_jumps)/len(large_jumps):.1f}px")

# 4. Kalman smoothing effectiveness (consecutive duplicate coordinates)
duplicates = 0
for i in range(1, len(gaze_points)):
    if gaze_points[i] == gaze_points[i-1]:
        duplicates += 1

print(f"\n4. SMOOTHING ANALYSIS:")
print(f"   Duplicate consecutive points: {duplicates} ({100*duplicates/len(gaze_points):.2f}%)")

# 5. Movement distribution
movements = []
for i in range(1, len(gaze_points)):
    prev_x, prev_y = gaze_points[i-1]
    curr_x, curr_y = gaze_points[i]
    distance = ((curr_x - prev_x)**2 + (curr_y - prev_y)**2)**0.5
    movements.append(distance)

small_moves = sum(1 for m in movements if m < 20)
medium_moves = sum(1 for m in movements if 20 <= m < 100)
large_moves = sum(1 for m in movements if 100 <= m < 200)
very_large_moves = sum(1 for m in movements if m >= 200)

print(f"\n5. MOVEMENT DISTRIBUTION:")
print(f"   Small (<20px):      {small_moves} ({100*small_moves/len(movements):.2f}%)")
print(f"   Medium (20-100px):  {medium_moves} ({100*medium_moves/len(movements):.2f}%)")
print(f"   Large (100-200px):  {large_moves} ({100*large_moves/len(movements):.2f}%)")
print(f"   Very large (>200px): {very_large_moves} ({100*very_large_moves/len(movements):.2f}%)")
print(f"   Average movement:    {sum(movements)/len(movements):.2f}px")

# 6. Coverage analysis
coverage_grid = [[False] * 12 for _ in range(12)]
for x, y in gaze_points:
    grid_x = min(int(x / (SCREEN_WIDTH / 12)), 11)
    grid_y = min(int(y / (SCREEN_HEIGHT / 12)), 11)
    coverage_grid[grid_y][grid_x] = True

covered_cells = sum(sum(row) for row in coverage_grid)
total_cells = 12 * 12

print(f"\n6. SCREEN COVERAGE (12x12 grid):")
print(f"   Covered cells: {covered_cells}/{total_cells} ({100*covered_cells/total_cells:.1f}%)")

# 7. Reading tracking suitability (stability for small movements)
stable_sequences = 0
current_sequence = 0
for m in movements:
    if m < 30:  # Reading typically involves small movements
        current_sequence += 1
    else:
        if current_sequence > 0:
            stable_sequences += 1
        current_sequence = 0

if current_sequence > 0:
    stable_sequences += 1

print(f"\n7. READING TRACKING SUITABILITY:")
print(f"   Stable sequences (<30px movements): {stable_sequences}")
print(f"   Small movements ratio: {100*small_moves/len(movements):.2f}%")

# Overall verdict
print(f"\n{'=' * 70}")
print("OVERALL VERDICT:")
print(f"{'=' * 70}")

issues = []
if out_of_screen > 0:
    issues.append(f"[!] {out_of_screen} out-of-screen coordinates")
else:
    print("[OK] Coordinate clamping working perfectly (0 out-of-screen points)")

boundary_total = sum(boundary_clamps.values())
if boundary_total > len(gaze_points) * 0.1:
    issues.append(f"[!] High boundary clamping: {boundary_total} points at edges")
    print(f"[!] {boundary_total} points clamped to boundaries ({100*boundary_total/len(gaze_points):.1f}%)")
    print("  -> This suggests the model may need recalibration or head position adjustment")
else:
    print(f"[OK] Boundary clamping acceptable: {boundary_total} points ({100*boundary_total/len(gaze_points):.1f}%)")

if len(large_jumps) / len(gaze_points) > 0.1:
    issues.append(f"[!] High jump rate: {100*len(large_jumps)/len(gaze_points):.1f}%")
    print(f"[!] Jump rate: {100*len(large_jumps)/len(gaze_points):.2f}% (>10% threshold)")
else:
    print(f"[OK] Jump rate acceptable: {100*len(large_jumps)/len(gaze_points):.2f}% (<10%)")

if small_moves / len(movements) > 0.5:
    print(f"[OK] Good tracking stability: {100*small_moves/len(movements):.1f}% small movements")
else:
    issues.append(f"[!] Low stability: only {100*small_moves/len(movements):.1f}% small movements")

print(f"\n{'=' * 70}")
if not issues:
    print("[OK] SYSTEM PERFORMING WELL - Suitable for reading tracking")
else:
    print("[!] ISSUES DETECTED:")
    for issue in issues:
        print(f"  {issue}")
print(f"{'=' * 70}")
