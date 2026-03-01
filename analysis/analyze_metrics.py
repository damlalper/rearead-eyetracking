"""
ReaRead Analytics Data Analysis
Generates metrics and visualizations for academic paper
"""

import json
import numpy as np
import matplotlib.pyplot as plt
from collections import defaultdict
from datetime import datetime

# Load data
with open(r'c:\Users\Lenovo\Downloads\rearead-analytics-1768302407353.json', 'r', encoding='utf-8') as f:
    sessions = json.load(f)

print(f"Total sessions loaded: {len(sessions)}")

# Filter meaningful sessions (with paragraph data)
meaningful_sessions = [s for s in sessions if s.get('paragraphMetrics') and len(s['paragraphMetrics']) > 0]
print(f"Sessions with paragraph data: {len(meaningful_sessions)}")

# ============================================
# 1. AGGREGATE STATISTICS
# ============================================
print("\n" + "="*60)
print("1. AGGREGATE STATISTICS")
print("="*60)

total_paragraphs = 0
total_dwell_time = 0
total_words = 0
all_difficulty_ratios = []
all_dwell_times = []
all_revisits = []
llm_used_paragraphs = 0
total_llm_usage = 0

focus_scores = []
session_durations = []
paragraphs_per_session = []
difficult_paragraphs_per_session = []

for session in meaningful_sessions:
    # Session level
    if session.get('avgFocusScore', 0) > 0:
        focus_scores.append(session['avgFocusScore'])

    duration_min = session.get('duration', 0) / 60000
    if duration_min > 0.5:  # At least 30 seconds
        session_durations.append(duration_min)

    paragraphs = session.get('paragraphMetrics', {})
    if paragraphs:
        paragraphs_per_session.append(len(paragraphs))
        difficult_count = sum(1 for p in paragraphs.values() if p.get('difficultyRatio', 0) >= 1.6)
        difficult_paragraphs_per_session.append(difficult_count)

    total_llm_usage += len(session.get('llmUsage', []))

    # Paragraph level
    for key, metrics in paragraphs.items():
        total_paragraphs += 1

        dwell = metrics.get('dwellTime', 0)
        if dwell > 0:
            all_dwell_times.append(dwell)
            total_dwell_time += dwell

        words = metrics.get('wordCount', 0)
        if words > 0:
            total_words += words

        ratio = metrics.get('difficultyRatio', 0)
        if ratio > 0:
            all_difficulty_ratios.append(ratio)

        revisits = metrics.get('revisits', 0)
        if revisits > 0:
            all_revisits.append(revisits)

        if metrics.get('llmUsed', False):
            llm_used_paragraphs += 1

# Calculate statistics
print(f"\nTotal paragraphs analyzed: {total_paragraphs}")
print(f"Total words read: {total_words}")
print(f"Total dwell time: {total_dwell_time/1000:.1f} seconds ({total_dwell_time/60000:.1f} minutes)")

if total_words > 0 and total_dwell_time > 0:
    avg_wpm = total_words / (total_dwell_time / 60000)
    print(f"Average reading speed: {avg_wpm:.1f} WPM")

print(f"\nFocus Scores (n={len(focus_scores)}):")
if focus_scores:
    print(f"  Mean: {np.mean(focus_scores):.2f}%")
    print(f"  Std: {np.std(focus_scores):.2f}%")
    print(f"  Min: {np.min(focus_scores):.2f}%")
    print(f"  Max: {np.max(focus_scores):.2f}%")

print(f"\nDifficulty Ratios (n={len(all_difficulty_ratios)}):")
if all_difficulty_ratios:
    print(f"  Mean: {np.mean(all_difficulty_ratios):.2f}")
    print(f"  Median: {np.median(all_difficulty_ratios):.2f}")
    print(f"  Std: {np.std(all_difficulty_ratios):.2f}")

    # Distribution
    easy = sum(1 for r in all_difficulty_ratios if r < 1.3)
    medium = sum(1 for r in all_difficulty_ratios if 1.3 <= r < 1.6)
    hard = sum(1 for r in all_difficulty_ratios if r >= 1.6)
    total = len(all_difficulty_ratios)
    print(f"\n  Distribution:")
    print(f"    Easy (ratio < 1.3): {easy} ({easy/total*100:.1f}%)")
    print(f"    Medium (1.3-1.6): {medium} ({medium/total*100:.1f}%)")
    print(f"    Hard (ratio >= 1.6): {hard} ({hard/total*100:.1f}%)")

print(f"\nDwell Times (n={len(all_dwell_times)}):")
if all_dwell_times:
    print(f"  Mean: {np.mean(all_dwell_times):.0f} ms ({np.mean(all_dwell_times)/1000:.2f} sec)")
    print(f"  Median: {np.median(all_dwell_times):.0f} ms")
    print(f"  Std: {np.std(all_dwell_times):.0f} ms")

print(f"\nRevisits (n={len(all_revisits)}):")
if all_revisits:
    print(f"  Mean: {np.mean(all_revisits):.2f}")
    print(f"  Median: {np.median(all_revisits):.1f}")
    print(f"  Max: {np.max(all_revisits)}")

print(f"\nLLM Usage:")
print(f"  Total LLM assistance calls: {total_llm_usage}")
print(f"  Paragraphs with LLM used: {llm_used_paragraphs}")
if hard > 0:
    print(f"  LLM usage rate (on hard paragraphs): {llm_used_paragraphs/hard*100:.1f}%")

# ============================================
# 2. LLM USAGE ANALYSIS
# ============================================
print("\n" + "="*60)
print("2. LLM USAGE ANALYSIS")
print("="*60)

llm_modes = defaultdict(int)
for session in meaningful_sessions:
    for usage in session.get('llmUsage', []):
        mode = usage.get('mode', 'unknown')
        llm_modes[mode] += 1

print("\nLLM Mode Distribution:")
for mode, count in sorted(llm_modes.items(), key=lambda x: -x[1]):
    print(f"  {mode}: {count}")

# ============================================
# 3. REGRESSION ANALYSIS (Paragraph transitions)
# ============================================
print("\n" + "="*60)
print("3. SESSION-LEVEL STATISTICS")
print("="*60)

print(f"\nSessions analyzed: {len(meaningful_sessions)}")
print(f"Paragraphs per session:")
if paragraphs_per_session:
    print(f"  Mean: {np.mean(paragraphs_per_session):.1f}")
    print(f"  Median: {np.median(paragraphs_per_session):.1f}")
    print(f"  Max: {np.max(paragraphs_per_session)}")

print(f"\nDifficult paragraphs per session:")
if difficult_paragraphs_per_session:
    print(f"  Mean: {np.mean(difficult_paragraphs_per_session):.1f}")
    print(f"  Percentage: {np.sum(difficult_paragraphs_per_session)/np.sum(paragraphs_per_session)*100:.1f}%")

# ============================================
# 4. PREPARE DATA FOR FIGURES
# ============================================
print("\n" + "="*60)
print("4. SAVING DATA FOR FIGURES")
print("="*60)

# Save processed data
analysis_results = {
    'total_sessions': len(sessions),
    'meaningful_sessions': len(meaningful_sessions),
    'total_paragraphs': total_paragraphs,
    'total_words': total_words,
    'total_dwell_time_ms': total_dwell_time,
    'avg_wpm': total_words / (total_dwell_time / 60000) if total_dwell_time > 0 else 0,
    'focus_scores': focus_scores,
    'difficulty_ratios': all_difficulty_ratios,
    'dwell_times': all_dwell_times,
    'revisits': all_revisits,
    'llm_modes': dict(llm_modes),
    'llm_used_paragraphs': llm_used_paragraphs,
    'total_llm_usage': total_llm_usage,
    'paragraphs_per_session': paragraphs_per_session,
    'difficult_paragraphs_per_session': difficult_paragraphs_per_session,
    'difficulty_distribution': {
        'easy': easy,
        'medium': medium,
        'hard': hard
    }
}

# Dwell time vs Difficulty ratio pairs
dwell_difficulty_pairs = []
for session in meaningful_sessions:
    for key, metrics in session.get('paragraphMetrics', {}).items():
        dwell = metrics.get('dwellTime', 0)
        ratio = metrics.get('difficultyRatio', 0)
        llm = metrics.get('llmUsed', False)
        revisits = metrics.get('revisits', 0)
        words = metrics.get('wordCount', 0)
        if dwell > 0 and ratio > 0:
            dwell_difficulty_pairs.append({
                'dwell_time': dwell,
                'difficulty_ratio': ratio,
                'llm_used': llm,
                'revisits': revisits,
                'word_count': words
            })

analysis_results['dwell_difficulty_pairs'] = dwell_difficulty_pairs

# Save to JSON for further analysis
with open(r'c:\Users\Lenovo\ReaRead2\analysis\analysis_results.json', 'w', encoding='utf-8') as f:
    json.dump(analysis_results, f, indent=2)

print("Analysis results saved to analysis_results.json")
print(f"Total dwell-difficulty pairs: {len(dwell_difficulty_pairs)}")

# ============================================
# 5. SUMMARY TABLE FOR PAPER
# ============================================
print("\n" + "="*60)
print("5. SUMMARY TABLE FOR PAPER (Table 9)")
print("="*60)

print("""
┌─────────────────────────────────────┬─────────────────┬─────────────────┐
│ Metric                              │ Value           │ Notes           │
├─────────────────────────────────────┼─────────────────┼─────────────────┤""")
print(f"│ Total reading sessions              │ {len(meaningful_sessions):>15} │ With metrics    │")
print(f"│ Total paragraphs analyzed           │ {total_paragraphs:>15} │                 │")
print(f"│ Total words processed               │ {total_words:>15} │                 │")
print(f"│ Average reading speed               │ {analysis_results['avg_wpm']:>12.1f} WPM │ Based on dwell  │")
print(f"│ Mean focus score                    │ {np.mean(focus_scores):>13.2f}% │ ±{np.std(focus_scores):.2f}%         │")
print(f"│ Mean difficulty ratio               │ {np.mean(all_difficulty_ratios):>15.2f} │ Expected = 1.0  │")
print(f"│ Mean dwell time per paragraph       │ {np.mean(all_dwell_times)/1000:>13.2f}s │                 │")
print(f"│ Mean revisits per paragraph         │ {np.mean(all_revisits):>15.2f} │                 │")
print(f"│ Difficult paragraphs (ratio≥1.6)    │ {hard/total*100:>13.1f}% │ n={hard}           │")
print(f"│ LLM assistance utilization          │ {total_llm_usage:>15} │ Total calls     │")
print(f"│ LLM-assisted paragraph rate         │ {llm_used_paragraphs/total_paragraphs*100:>13.1f}% │                 │")
print("""└─────────────────────────────────────┴─────────────────┴─────────────────┘""")
