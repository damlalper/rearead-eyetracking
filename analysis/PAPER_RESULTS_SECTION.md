# MAKALEYE EKLENECEK YENİ BÖLÜMLER
## Results and Discussion - Metric Analysis Sections

---

## 3.6. Quantitative Analysis of Reading Behavior Metrics

To empirically evaluate the effectiveness of the proposed system, reading behavior data was collected from real-world usage sessions. The analytics module recorded paragraph-level metrics including dwell time, difficulty ratio, revisit count, and AI assistance utilization. A total of **157 paragraphs** across **12 meaningful reading sessions** were analyzed, yielding quantitative insights into user reading patterns and system responsiveness.

### Table 9: Summary of Reading Behavior Metrics

| Metric | Value | Description |
|--------|-------|-------------|
| Total reading sessions | 12 | Sessions with recorded paragraph data |
| Total paragraphs analyzed | 157 | Individual text segments tracked |
| Mean focus score | 71.6% ± 26.1% | Percentage of gaze points within viewport |
| Mean dwell time per paragraph | 19.0 seconds | Average visual attention duration |
| Mean difficulty ratio | 8.27 | Ratio of actual to expected reading time |
| Median difficulty ratio | 2.49 | Central tendency measure |
| Mean revisit count | 5.08 | Average re-reading occurrences per paragraph |
| Difficult paragraphs (ratio ≥ 1.6) | 64.2% | Paragraphs exceeding difficulty threshold |
| LLM assistance calls | 49 | Total AI-assisted support requests |
| LLM-assisted paragraph rate | 7.0% | Paragraphs where AI help was utilized |

These results indicate substantial variability in reading behavior across different content types and user sessions. The high percentage of difficult paragraphs (64.2%) suggests that users frequently encountered content requiring extended cognitive processing, which aligns with the system's intended use case of supporting challenging reading tasks.

---

## 3.7. Focus Score Distribution Analysis

The distribution of focus scores across reading sessions provides insight into user attention stability during web-based reading tasks. Focus score is defined as the percentage of gaze points falling within the browser viewport boundaries, serving as a proxy for sustained visual attention.

**[INSERT FIGURE 11: Distribution of Focus Scores Across Reading Sessions]**

As illustrated in Figure 11, focus scores exhibited a bimodal distribution pattern. The majority of sessions (7 out of 12) achieved focus scores above 70%, indicating that users maintained consistent visual attention on the reading content. However, a subset of sessions showed notably lower focus scores (20-40%), potentially attributable to environmental distractions, multitasking behavior, or calibration drift during extended use.

The mean focus score of 71.6% (SD = 26.1%) demonstrates that webcam-based gaze tracking can achieve functional accuracy for paragraph-level attention monitoring without requiring laboratory-grade equipment. The relatively high standard deviation reflects the inherent variability of real-world reading conditions, reinforcing the system's design philosophy of providing supportive rather than prescriptive interventions.

---

## 3.8. Correlation Between Dwell Time and Paragraph Difficulty

A central hypothesis underlying the ReaRead framework is that prolonged dwell time correlates with increased reading difficulty. To validate this assumption, the relationship between observed dwell time and computed difficulty ratio was analyzed across all tracked paragraphs.

**[INSERT FIGURE 12: Relationship Between Paragraph Difficulty and Dwell Time]**

Figure 12 presents a scatter plot of dwell time versus difficulty ratio for 148 paragraphs. Statistical analysis revealed a moderate positive correlation (Pearson's r = 0.527, p < 0.001), indicating that paragraphs with higher difficulty ratios tend to receive longer visual attention. This finding supports the use of dwell time as a behavioral signal for identifying potentially challenging content.

Notably, paragraphs where LLM assistance was utilized (orange squares) cluster predominantly in regions of elevated difficulty ratio and extended dwell time. This pattern suggests that users selectively engage AI support for genuinely challenging content rather than invoking assistance indiscriminately. The concentration of LLM-assisted paragraphs above the difficulty threshold (ratio ≥ 1.6) validates the system's detection mechanism for triggering contextual help indicators.

The trend line demonstrates that each unit increase in difficulty ratio corresponds to approximately 1.5 additional seconds of dwell time, providing a quantitative basis for calibrating assistance thresholds in future system iterations.

---

## 3.9. Paragraph Difficulty Distribution and LLM Utilization Patterns

The distribution of paragraph difficulty levels was examined to characterize the cognitive demands encountered during typical reading sessions. Difficulty ratio was computed as the quotient of actual dwell time to expected reading time, where expected time was derived from word count assuming a baseline reading speed of 200 words per minute.

**[INSERT FIGURE 13: Paragraph Difficulty Distribution and LLM Assistance Usage]**

As shown in Figure 13 (left panel), paragraph difficulty exhibited a skewed distribution with 64.2% of paragraphs classified as "hard" (difficulty ratio ≥ 1.6), 3.4% as "medium" (ratio 1.3–1.6), and 32.4% as "easy" (ratio < 1.3). This distribution reflects the challenging nature of the content encountered during evaluation sessions, which included academic articles, technical documentation, and multilingual web content.

The right panel of Figure 13 illustrates LLM assistance usage stratified by difficulty category. A clear trend emerges: AI assistance was predominantly utilized for hard paragraphs (7 instances), with minimal usage for easy (2 instances) and medium (1 instance) content. This selective utilization pattern demonstrates that users exercise appropriate judgment in invoking AI support, reserving assistance for genuinely problematic content rather than over-relying on automated help.

The LLM assistance rate for hard paragraphs (7.4%) indicates that while the system successfully identifies challenging content, users retain full autonomy in deciding whether to engage supportive features—a key design principle of the user-in-the-loop architecture.

---

## 3.10. Revisit Behavior and Reading Comprehension Patterns

Paragraph revisits, defined as instances where gaze returns to a previously read text segment, serve as an additional indicator of reading comprehension difficulty. The relationship between revisit frequency and difficulty ratio was analyzed to identify patterns in re-reading behavior.

**[INSERT FIGURE 14: Heatmap of Paragraph Revisits vs Difficulty Ratio]**

Figure 14 presents a heatmap visualization of paragraph revisits against difficulty ratio. The highest concentration of paragraphs (darkest regions) occurs in the lower-left quadrant, representing content with moderate difficulty (ratio < 10) and typical revisit counts (5–15 revisits). This clustering suggests that most paragraphs receive multiple passes during normal reading, consistent with established models of incremental text comprehension.

Paragraphs exceeding the difficulty threshold (marked by the dashed white line at ratio = 1.6) exhibit variable revisit patterns, with some receiving extensive re-reading (15+ revisits) while others show minimal revisits despite high difficulty ratios. This heterogeneity may reflect different user strategies for handling challenging content—some readers persist through difficult passages via repeated reading, while others may skip or skim problematic sections.

The mean revisit count of 5.08 per paragraph indicates that users frequently re-engage with content during reading sessions, supporting the system's approach of providing persistent but non-intrusive assistance indicators that remain available across multiple viewing cycles.

---

## 3.11. AI-Assisted Support Mode Preferences

The ReaRead framework offers multiple AI-assisted support modalities to accommodate diverse reading needs. Usage patterns across these modalities were analyzed to identify user preferences and inform future feature prioritization.

**[INSERT FIGURE 15: Distribution of AI-Assisted Support Mode Usage]**

Figure 15 displays the distribution of AI assistance requests across seven available support modes. Two modalities dominated user interactions: **Auto Read (TTS)** and **Summary**, each accounting for 36.7% of total usage (18 requests each). This co-dominance suggests that users primarily seek either auditory reinforcement of textual content or condensed representations of lengthy passages when encountering reading difficulties.

Secondary assistance modes—including Zoom, Vocabulary, and Q&A—each received 6.1% of requests (3 instances), while Audio and Key Points modes were least utilized at 4.1% each. The relatively balanced distribution among secondary modes indicates that the multi-modal assistance pool successfully addresses varied user needs, though certain features may benefit from enhanced discoverability or contextual prompting.

The strong preference for summarization and text-to-speech features aligns with established reading comprehension strategies, where both content condensation and multi-sensory reinforcement have demonstrated efficacy in supporting struggling readers. These findings suggest that future development efforts should prioritize enhancing the quality and responsiveness of summary generation and TTS functionality.

---

## 3.12. Summary of Quantitative Findings

The empirical analysis presented in Sections 3.6–3.11 yields several key findings regarding the ReaRead system's operational characteristics and user interaction patterns:

1. **Functional Gaze Tracking Accuracy**: Mean focus scores of 71.6% demonstrate that webcam-based eye tracking achieves sufficient precision for paragraph-level attention monitoring in uncontrolled environments.

2. **Validated Difficulty Detection**: The moderate positive correlation (r = 0.527) between dwell time and difficulty ratio supports the use of temporal attention metrics as proxies for reading challenge identification.

3. **Selective AI Assistance Utilization**: Users predominantly engage AI support for genuinely difficult content (difficulty ratio ≥ 1.6), indicating appropriate calibration of assistance triggers and preserved user autonomy.

4. **Consistent Re-reading Behavior**: Mean revisit counts of 5.08 per paragraph reflect natural reading comprehension patterns, validating the system's persistent assistance availability across multiple content engagements.

5. **Preference for Summarization and TTS**: Combined usage of 73.4% for Auto Read and Summary modes identifies these modalities as primary targets for continued enhancement.

These quantitative results complement the qualitative system characterization presented in earlier sections, collectively demonstrating that ReaRead achieves its design objectives of non-intrusive reading support through behaviorally-triggered, user-controlled AI assistance.

---

# TABLO FORMATI (Word/LaTeX için)

## Table 9: Summary of Reading Behavior Metrics

```
+----------------------------------------+------------------+--------------------------------+
| Metric                                 | Value            | Description                    |
+----------------------------------------+------------------+--------------------------------+
| Total reading sessions                 | 12               | Sessions with paragraph data   |
| Total paragraphs analyzed              | 157              | Individual segments tracked    |
| Mean focus score                       | 71.6% ± 26.1%    | Gaze points within viewport    |
| Mean dwell time per paragraph          | 19.0 s           | Average attention duration     |
| Mean difficulty ratio                  | 8.27             | Actual/expected time ratio     |
| Median difficulty ratio                | 2.49             | Central tendency               |
| Mean revisit count                     | 5.08             | Re-reading occurrences         |
| Difficult paragraphs (ratio ≥ 1.6)     | 64.2%            | Above difficulty threshold     |
| LLM assistance calls                   | 49               | Total AI support requests      |
| LLM-assisted paragraph rate            | 7.0%             | AI help utilization rate       |
+----------------------------------------+------------------+--------------------------------+
```

---

# FİGÜR AÇIKLAMALARI (Captions)

**Figure 11**: Distribution of focus scores across reading sessions. The histogram shows session-level focus percentages with mean (71.6%, dashed blue line) and median (83.9%, dotted orange line) indicators. Colors represent performance categories: red (poor, <50%), yellow (moderate, 50-70%), and green (good, >70%).

**Figure 12**: Scatter plot illustrating the relationship between paragraph difficulty ratio and dwell time. Blue circles represent paragraphs without LLM assistance (n=138), while orange squares indicate paragraphs where AI support was utilized (n=10). The positive correlation (r=0.527, p<0.001) supports dwell time as a valid behavioral indicator of reading difficulty.

**Figure 13**: (Left) Pie chart showing the distribution of paragraph difficulty levels based on the ratio of actual to expected reading time. (Right) Bar chart comparing LLM assistance usage across difficulty categories, demonstrating selective AI support utilization for challenging content.

**Figure 14**: Heatmap visualization of the relationship between paragraph revisit frequency and difficulty ratio. Darker regions indicate higher paragraph concentrations. The vertical dashed line marks the difficulty threshold (ratio = 1.6) used for assistance triggering.

**Figure 15**: Distribution of AI-assisted support mode usage across seven available modalities. Auto Read (TTS) and Summary modes jointly account for 73.4% of total assistance requests, indicating strong user preference for auditory reinforcement and content condensation features.

---

# DOSYA KONUMLARI

Figürler: `c:\Users\Lenovo\ReaRead2\analysis\`
- figure_focus_distribution.png (Figure 11)
- figure_dwell_difficulty_scatter.png (Figure 12)
- figure_difficulty_distribution.png (Figure 13)
- figure_revisits_heatmap.png (Figure 14)
- figure_llm_mode_usage.png (Figure 15)
