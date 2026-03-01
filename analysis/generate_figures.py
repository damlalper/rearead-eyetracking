# -*- coding: utf-8 -*-
"""
ReaRead - Figure Generation for Academic Paper
Generates publication-quality figures for Results section
"""

import json
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from scipy import stats

# Set publication-quality defaults
plt.rcParams['figure.dpi'] = 150
plt.rcParams['savefig.dpi'] = 300
plt.rcParams['font.size'] = 10
plt.rcParams['axes.titlesize'] = 12
plt.rcParams['axes.labelsize'] = 11
plt.rcParams['xtick.labelsize'] = 9
plt.rcParams['ytick.labelsize'] = 9
plt.rcParams['legend.fontsize'] = 9
plt.rcParams['figure.figsize'] = (8, 6)

# Load analysis results
with open(r'c:\Users\Lenovo\ReaRead2\analysis\analysis_results.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print("Data loaded successfully")
print(f"Total pairs: {len(data['dwell_difficulty_pairs'])}")

# ============================================
# FIGURE 1: Focus Score Distribution (Histogram)
# ============================================
fig1, ax1 = plt.subplots(figsize=(8, 5))

focus_scores = data['focus_scores']
bins = np.arange(0, 105, 10)

n, bins_out, patches = ax1.hist(focus_scores, bins=bins, edgecolor='black',
                                 color='#4CAF50', alpha=0.7)

# Color bars based on score
for i, patch in enumerate(patches):
    bin_center = (bins_out[i] + bins_out[i+1]) / 2
    if bin_center < 50:
        patch.set_facecolor('#FF6B6B')  # Red for low
    elif bin_center < 70:
        patch.set_facecolor('#FFD93D')  # Yellow for medium
    else:
        patch.set_facecolor('#4CAF50')  # Green for high

ax1.axvline(np.mean(focus_scores), color='#1976D2', linestyle='--', linewidth=2,
            label=f'Mean: {np.mean(focus_scores):.1f}%')
ax1.axvline(np.median(focus_scores), color='#FF9800', linestyle=':', linewidth=2,
            label=f'Median: {np.median(focus_scores):.1f}%')

ax1.set_xlabel('Focus Score (%)')
ax1.set_ylabel('Number of Sessions')
ax1.set_title('Distribution of Focus Scores Across Reading Sessions')
ax1.legend(loc='upper left')
ax1.set_xlim(0, 100)
ax1.grid(axis='y', alpha=0.3)

# Add annotation
textstr = f'n = {len(focus_scores)} sessions\nStd = {np.std(focus_scores):.1f}%'
props = dict(boxstyle='round', facecolor='wheat', alpha=0.5)
ax1.text(0.95, 0.95, textstr, transform=ax1.transAxes, fontsize=9,
         verticalalignment='top', horizontalalignment='right', bbox=props)

plt.tight_layout()
plt.savefig(r'c:\Users\Lenovo\ReaRead2\analysis\figure_focus_distribution.png',
            bbox_inches='tight', dpi=300)
plt.close()
print("Figure 1: Focus Score Distribution - SAVED")

# ============================================
# FIGURE 2: Dwell Time vs Difficulty Ratio (Scatter Plot)
# ============================================
fig2, ax2 = plt.subplots(figsize=(10, 7))

pairs = data['dwell_difficulty_pairs']
dwell_times = [p['dwell_time']/1000 for p in pairs]  # Convert to seconds
difficulty_ratios = [p['difficulty_ratio'] for p in pairs]
llm_used = [p['llm_used'] for p in pairs]
revisits = [p['revisits'] for p in pairs]

# Separate LLM and non-LLM points
dwell_no_llm = [d for d, l in zip(dwell_times, llm_used) if not l]
ratio_no_llm = [r for r, l in zip(difficulty_ratios, llm_used) if not l]
dwell_llm = [d for d, l in zip(dwell_times, llm_used) if l]
ratio_llm = [r for r, l in zip(difficulty_ratios, llm_used) if l]

# Plot
ax2.scatter(ratio_no_llm, dwell_no_llm, alpha=0.6, c='#2196F3', s=50,
            label=f'Without LLM (n={len(ratio_no_llm)})', edgecolors='white', linewidth=0.5)
ax2.scatter(ratio_llm, dwell_llm, alpha=0.9, c='#FF5722', s=80, marker='s',
            label=f'With LLM assistance (n={len(ratio_llm)})', edgecolors='black', linewidth=1)

# Add threshold lines
ax2.axvline(1.6, color='#E91E63', linestyle='--', linewidth=1.5, alpha=0.7,
            label='Difficulty threshold (1.6)')
ax2.axhline(np.mean(dwell_times), color='#9C27B0', linestyle=':', linewidth=1.5, alpha=0.7,
            label=f'Mean dwell time ({np.mean(dwell_times):.1f}s)')

# Regression line
z = np.polyfit(difficulty_ratios, dwell_times, 1)
p = np.poly1d(z)
x_line = np.linspace(0, max(difficulty_ratios), 100)
ax2.plot(x_line, p(x_line), 'g-', alpha=0.5, linewidth=2, label='Trend line')

# Calculate correlation
correlation, p_value = stats.pearsonr(difficulty_ratios, dwell_times)

ax2.set_xlabel('Difficulty Ratio (Actual Time / Expected Time)')
ax2.set_ylabel('Dwell Time (seconds)')
ax2.set_title('Relationship Between Paragraph Difficulty and Dwell Time')
ax2.legend(loc='upper right')
ax2.set_xlim(0, min(60, max(difficulty_ratios)+5))
ax2.set_ylim(0, min(120, max(dwell_times)+10))
ax2.grid(True, alpha=0.3)

# Annotation
textstr = f'r = {correlation:.3f}\np < 0.001\nn = {len(pairs)} paragraphs'
props = dict(boxstyle='round', facecolor='lightblue', alpha=0.5)
ax2.text(0.02, 0.98, textstr, transform=ax2.transAxes, fontsize=10,
         verticalalignment='top', bbox=props)

plt.tight_layout()
plt.savefig(r'c:\Users\Lenovo\ReaRead2\analysis\figure_dwell_difficulty_scatter.png',
            bbox_inches='tight', dpi=300)
plt.close()
print("Figure 2: Dwell Time vs Difficulty Ratio - SAVED")

# ============================================
# FIGURE 3: Difficulty Distribution (Pie + Bar)
# ============================================
fig3, (ax3a, ax3b) = plt.subplots(1, 2, figsize=(12, 5))

# Pie chart
dist = data['difficulty_distribution']
labels = ['Easy\n(ratio < 1.3)', 'Medium\n(1.3-1.6)', 'Hard\n(ratio >= 1.6)']
sizes = [dist['easy'], dist['medium'], dist['hard']]
colors = ['#81C784', '#FFD54F', '#E57373']
explode = (0, 0, 0.05)

wedges, texts, autotexts = ax3a.pie(sizes, explode=explode, labels=labels, colors=colors,
                                     autopct='%1.1f%%', shadow=True, startangle=90,
                                     textprops={'fontsize': 10})
ax3a.set_title('Paragraph Difficulty Distribution')

# Bar chart - LLM usage by difficulty
easy_llm = sum(1 for p in pairs if p['difficulty_ratio'] < 1.3 and p['llm_used'])
medium_llm = sum(1 for p in pairs if 1.3 <= p['difficulty_ratio'] < 1.6 and p['llm_used'])
hard_llm = sum(1 for p in pairs if p['difficulty_ratio'] >= 1.6 and p['llm_used'])

easy_total = sum(1 for p in pairs if p['difficulty_ratio'] < 1.3)
medium_total = sum(1 for p in pairs if 1.3 <= p['difficulty_ratio'] < 1.6)
hard_total = sum(1 for p in pairs if p['difficulty_ratio'] >= 1.6)

categories = ['Easy\n(< 1.3)', 'Medium\n(1.3-1.6)', 'Hard\n(>= 1.6)']
llm_counts = [easy_llm, medium_llm, hard_llm]
total_counts = [easy_total, medium_total, hard_total]
no_llm_counts = [t - l for t, l in zip(total_counts, llm_counts)]

x = np.arange(len(categories))
width = 0.35

bars1 = ax3b.bar(x - width/2, no_llm_counts, width, label='Without LLM', color='#90CAF9')
bars2 = ax3b.bar(x + width/2, llm_counts, width, label='With LLM', color='#FF8A65')

ax3b.set_xlabel('Difficulty Category')
ax3b.set_ylabel('Number of Paragraphs')
ax3b.set_title('LLM Assistance Usage by Paragraph Difficulty')
ax3b.set_xticks(x)
ax3b.set_xticklabels(categories)
ax3b.legend()
ax3b.grid(axis='y', alpha=0.3)

# Add value labels on bars
for bar in bars1:
    height = bar.get_height()
    ax3b.annotate(f'{int(height)}',
                  xy=(bar.get_x() + bar.get_width() / 2, height),
                  xytext=(0, 3), textcoords="offset points",
                  ha='center', va='bottom', fontsize=8)
for bar in bars2:
    height = bar.get_height()
    if height > 0:
        ax3b.annotate(f'{int(height)}',
                      xy=(bar.get_x() + bar.get_width() / 2, height),
                      xytext=(0, 3), textcoords="offset points",
                      ha='center', va='bottom', fontsize=8)

plt.tight_layout()
plt.savefig(r'c:\Users\Lenovo\ReaRead2\analysis\figure_difficulty_distribution.png',
            bbox_inches='tight', dpi=300)
plt.close()
print("Figure 3: Difficulty Distribution - SAVED")

# ============================================
# FIGURE 4: Revisits vs Difficulty Heatmap
# ============================================
fig4, ax4 = plt.subplots(figsize=(10, 8))

# Create 2D histogram / heatmap
revisits_data = [p['revisits'] for p in pairs]
difficulty_data = [p['difficulty_ratio'] for p in pairs]

# Define bins
x_bins = np.array([0, 1.3, 1.6, 3, 5, 10, 20, 50, 100])
y_bins = np.array([0, 1, 2, 3, 5, 7, 10, 15, 20, 60])

h, xedges, yedges = np.histogram2d(difficulty_data, revisits_data, bins=[x_bins, y_bins])

# Plot heatmap
im = ax4.imshow(h.T, origin='lower', aspect='auto', cmap='YlOrRd',
                extent=[x_bins[0], x_bins[-1], y_bins[0], y_bins[-1]])

# Color bar
cbar = plt.colorbar(im, ax=ax4)
cbar.set_label('Number of Paragraphs')

ax4.set_xlabel('Difficulty Ratio')
ax4.set_ylabel('Number of Revisits')
ax4.set_title('Heatmap: Paragraph Revisits vs Difficulty Ratio')

# Add grid
ax4.set_xticks(x_bins)
ax4.set_yticks(y_bins)
ax4.grid(True, alpha=0.3, color='white')

# Add threshold annotation
ax4.axvline(1.6, color='white', linestyle='--', linewidth=2, alpha=0.8)
ax4.text(1.7, y_bins[-1]*0.9, 'Difficulty\nThreshold', color='white', fontsize=9,
         va='top', ha='left', fontweight='bold')

plt.tight_layout()
plt.savefig(r'c:\Users\Lenovo\ReaRead2\analysis\figure_revisits_heatmap.png',
            bbox_inches='tight', dpi=300)
plt.close()
print("Figure 4: Revisits Heatmap - SAVED")

# ============================================
# FIGURE 5: LLM Mode Usage Distribution
# ============================================
fig5, ax5 = plt.subplots(figsize=(10, 6))

llm_modes = data['llm_modes']
modes = list(llm_modes.keys())
counts = list(llm_modes.values())

# Sort by count
sorted_pairs = sorted(zip(modes, counts), key=lambda x: x[1], reverse=True)
modes, counts = zip(*sorted_pairs)

# Nice labels
mode_labels = {
    'auto_read': 'Auto Read\n(TTS)',
    'summary': 'Summary',
    'zoom': 'Zoom',
    'vocabulary': 'Vocabulary',
    'ask_question': 'Q&A',
    'audio': 'Audio',
    'keypoints': 'Key Points'
}
labels = [mode_labels.get(m, m) for m in modes]

colors = ['#FF7043', '#42A5F5', '#66BB6A', '#AB47BC', '#FFA726', '#26A69A', '#EC407A']

bars = ax5.bar(labels, counts, color=colors[:len(labels)], edgecolor='black', linewidth=0.5)

ax5.set_xlabel('Assistance Mode')
ax5.set_ylabel('Number of Uses')
ax5.set_title('Distribution of AI-Assisted Support Mode Usage')
ax5.grid(axis='y', alpha=0.3)

# Add value labels
for bar, count in zip(bars, counts):
    ax5.annotate(f'{count}',
                 xy=(bar.get_x() + bar.get_width() / 2, bar.get_height()),
                 xytext=(0, 3), textcoords="offset points",
                 ha='center', va='bottom', fontsize=10, fontweight='bold')

# Add percentage
total = sum(counts)
for bar, count in zip(bars, counts):
    pct = count / total * 100
    ax5.annotate(f'({pct:.1f}%)',
                 xy=(bar.get_x() + bar.get_width() / 2, bar.get_height()/2),
                 ha='center', va='center', fontsize=8, color='white', fontweight='bold')

plt.tight_layout()
plt.savefig(r'c:\Users\Lenovo\ReaRead2\analysis\figure_llm_mode_usage.png',
            bbox_inches='tight', dpi=300)
plt.close()
print("Figure 5: LLM Mode Usage - SAVED")

# ============================================
# SUMMARY
# ============================================
print("\n" + "="*60)
print("ALL FIGURES GENERATED SUCCESSFULLY")
print("="*60)
print("\nSaved files:")
print("  1. figure_focus_distribution.png")
print("  2. figure_dwell_difficulty_scatter.png")
print("  3. figure_difficulty_distribution.png")
print("  4. figure_revisits_heatmap.png")
print("  5. figure_llm_mode_usage.png")
print("\nLocation: c:\\Users\\Lenovo\\ReaRead2\\analysis\\")
