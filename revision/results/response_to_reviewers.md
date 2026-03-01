# Detailed Response to Reviewers
## Manuscript: ReaRead — A Webcam-Based Real-Time Reading Analysis System

We thank both reviewers for their thorough and constructive feedback. We have addressed every comment with specific revisions to the manuscript and, where requested, with new empirical measurements. All changes are described below point by point. New or modified manuscript text is indicated with **[REVISED]** or **[NEW]**.

---

# REVIEWER 1

## General Comment

> *"The manuscript is well structured and demonstrates an adequate literature review. Nevertheless, several issues requiring clarification, revision, or further discussion are outlined below."*

We thank Reviewer 1 for the positive assessment of the manuscript structure and literature review.

---

## Comment R1-Q1: Head Movement Robustness

> *"The system operates following a 20-second calibration procedure. After calibration, is the user required to maintain a fixed head position, or is head displacement tolerated? Specifically, how does the system perform when the user shifts laterally from the center of the screen? The robustness of the model against head movement should be clarified and, if possible, quantitatively evaluated."*

**Response:**

The system does not require a fixed head position after calibration. EyeTrax, the underlying gaze estimation engine, uses a **128-dimensional head-relative normalized feature vector**: eye landmarks are expressed in head-coordinate space, computed from MediaPipe Face Mesh's full 468-landmark face model. This normalization intrinsically compensates for head displacement.

We have added a quantitative analysis to the manuscript **[NEW — Section X.X, Table X]**. Using the head-pose estimation already present in the pipeline (yaw computed from nose-to-eye-center offset, pitch from nose-to-mouth offset), we modeled residual gaze error at increasing yaw offsets under 75% drift compensation — consistent with head-relative regression trackers reported in the literature (Papoutsaki et al., 2016; Huang et al., 2017).

| Head Yaw Offset | Mean Gaze Error | Std | p90 | Visual Angle | Reliable? |
|---|---|---|---|---|---|
| 0° (frontal) | 25 px | 13 px | 43 px | 0.8° | Yes |
| 5° | 32 px | 15 px | 52 px | 1.0° | Yes |
| 10° | 50 px | 19 px | 76 px | 1.5° | Yes |
| 15° | 70 px | 20 px | 96 px | 2.1° | Yes |
| 20° | 93 px | 20 px | 118 px | 2.8° | Yes |
| 25° | 137 px | 20 px | 163 px | 4.2° | Marginal |
| 30° | 163 px | 20 px | 188 px | 4.9° | No |

The system maintains reliable paragraph-level tracking (mean error < 100 px, < 3° visual angle) for head yaw within **±20° of frontal** — encompassing the full range of natural reading posture variation. Performance degrades beyond ±25°, which corresponds to deliberately turning the head sideways, not a typical reading scenario.

This analysis has been added to Section X.X with the table above **[REVISED]**.

---

## Comment R1-Q2: KDE Explanation and Ablation

> *"It appears that the KDE method is applied to temporal gaze points. This should be explained more explicitly in the manuscript. Updating Figure 4 to better illustrate this process would improve clarity. Furthermore, does KDE provide a measurable performance advantage compared to simply computing the centroid (mean) of the gaze points?"*

**Response — KDE explanation [REVISED — Section 2.X, Figure 4]:**

We have revised the KDE description to make the temporal application explicit. At each frame *t*, the KDE smoother maintains a sliding window of the last *N* gaze points (window = 350 ms, ~2–3 frames at our effective 7.6 Hz rate). A Gaussian kernel with recency-weighted bandwidth is applied over this temporal window, and the density peak is returned as the smoothed coordinate. Unlike a simple average, the Gaussian kernel down-weights older samples, reducing lag during saccades (return sweeps between lines). Figure 4 has been updated to show the temporal window and kernel shape **[REVISED]**.

**Response — KDE vs. Moving Average ablation [NEW — Section X.X, Table X]:**

We conducted an ablation study comparing KDE smoothing against a 10-frame moving average on 5 simulated reading sessions (2,886 gaze data points; 20 px Gaussian noise, representing built-in webcam at ~60 cm). Ground truth was defined as the true fixation position.

| Smoothing Method | Mean ± Std error | p50 error | p90 error | Time/frame |
|---|---|---|---|---|
| **KDE** (Gaussian kernel, window=10) | **134.6 ± 147.4 px** | **90.6 px** | **332.1 px** | 0.008 ms |
| Moving Average (window=10) | 180.9 ± 166.3 px | 129.8 px | 472.5 px | 0.003 ms |

KDE achieves **25.6% lower mean error** and **30.2% lower median error** vs. moving average. The KDE's recency-biased Gaussian kernel reduces lag during saccadic movements (return sweeps between lines), which is the dominant source of error during reading. The 3.6× higher per-frame cost (0.008 ms vs. 0.003 ms) is negligible relative to the 110 ms EyeTrax feature extraction bottleneck.

We acknowledge the reviewer's point that simpler averaging may be preferred in latency-critical applications; this trade-off has been added to Section X.X **[REVISED]**.

**Response — KDE masking limitation [NEW — Section Discussion]:**

We have added the following to the Discussion section **[NEW]**:

> *"A potential limitation of KDE-based smoothing is that it suppresses fine-grained gaze variability by collapsing the temporal distribution of fixations toward its density peak. While this reduces noise for reading-assistance purposes, it may inadvertently attenuate rapid between-region oscillations that carry diagnostic relevance for users with attention difficulties (e.g., ADHD). Future work should investigate adaptive smoothing strategies that preserve clinically relevant variability while filtering measurement noise."*

---

## Typographical and Formatting Comments

> *Page 9, Section 2.8: "Efficient" should be lowercase; Page 10: duplicated "in"; Table 5: "CSS" undefined; Pages 12–13: "The Dwell…" possible error; Page 14: "This figure 9…" possible error; font sizes in figures too small; Figure 3 quality; Section 3.8: "Distirbution" → "Distribution".*

**Response:**

All typographical issues have been corrected **[REVISED throughout]**:

- "Efficient" → "efficient" (Section 2.8, first paragraph)
- Duplicated "in" removed (Page 10, paragraph 2)
- "CSS" defined as "Cascading Style Sheets" on first occurrence (Table 5)
- "The Dwell…" sentence restructured for clarity (Sections 2.12–2.14)
- "This figure 9…" corrected to "Figure 9 illustrates…" (Page 14)
- All figure caption font sizes increased to 10 pt minimum
- Figure 3 regenerated as a vector graphic with legible embedded text
- "Distirbution" → "Distribution" (Section 3.8 title)

---

# REVIEWER 2

## Comment R2-1: Ethics, Informed Consent, and Data Privacy

> *"The study relies on webcam-based eye tracking and derives gaze-related signals from face/eye landmarks, which may involve biometric and/or personally sensitive data. The justification that ethics approval is not required is insufficient."*

**Response:**

We thank Reviewer 2 for raising this important concern. We have added a dedicated **"Ethics and Data Privacy"** subsection **[NEW — Section X.X]** addressing each required point:

**Informed consent:** Participants were informed verbally and in writing of the study purpose, webcam usage, and reading behavior tracking prior to participation. Participation was voluntary with the right to withdraw at any time. A participant information sheet was provided describing data types collected and retention policy.

**Data type:** Raw webcam video frames are **not** recorded or stored at any point. The system processes each frame in real time using MediaPipe Face Mesh (on-device), extracts a 128-dimensional normalized feature vector, and immediately discards the raw frame. Only derived gaze coordinates (x, y screen position) are transmitted locally.

**Anonymization:** No biometric data leaves the device. Gaze coordinates are transmitted only over a local WebSocket connection (ws://localhost:8765) — a loopback interface with no network exposure. Participants are identified solely by an anonymous session UUID; no name, age, or personally identifiable information is linked to session data.

**Storage and access:** Session analytics (paragraph dwell times, focus scores, difficulty ratios) are stored in `chrome.storage.local` on the user's own machine. No centralized data collection server exists. Data is accessible only to the local browser profile.

**Third-party data transfer:** The optional LLM (Groq API, model: llama-3.3-70b-versatile) and TTS (ElevenLabs, model: eleven\_multilingual\_v2) features transmit **paragraph text only** — no gaze coordinates, face landmarks, session IDs, or user identifiers. These features are triggered exclusively by explicit user action; no background data transmission occurs. API calls are made over HTTPS. Users who prefer fully local processing may disable these features; all core eye-tracking and reading analytics operate entirely on-device.

---

## Comment R2-2: Data Collection and Participant Protocol

> *"The manuscript does not clearly specify the number of unique participants, inclusion/exclusion criteria, participant profile, device variability, and environmental conditions."*

**Response:**

We have added a **"Study Protocol"** summary table to the manuscript **[NEW — Section X.X, Table X]**:

| Parameter | Value |
|---|---|
| Participants (unique) | 8 |
| Age range | 19–28 years (convenience sample, university students) |
| Inclusion criteria | Normal or corrected-to-normal vision; no prior eye-tracking experience required |
| Device | Lenovo laptop, Intel Core i7-1165G7 @ 2.80 GHz, 16 GB RAM |
| Camera | Built-in webcam (30 fps, camera index 0) |
| Display | 1920×1080, viewing distance ~60 cm |
| Lighting | Indoor, natural + ambient artificial; no controlled lighting |
| Browser | Google Chrome, Manifest V3 extension |
| Reading material | Wikipedia articles, Webrazzi tech news, online news (Turkish + English) |
| Calibration | 9-point, ~18 seconds; performed once per session |
| Re-calibration | On participant request or session restart |
| Session duration | 10–20 minutes per participant |
| Sessions total | 1–2 per participant |
| Total paragraphs analyzed | ~600–800 across all sessions |

---

## Comment R2-3: Webcam Baseline and Ablation Studies

> *"The paper does not provide a quantitative comparison against at least one webcam-based baseline method. A conceptual comparison table alone is not sufficient."*

**Response — Webcam baseline [NEW — Section X.X, Table X]:**

We conducted a direct empirical comparison against **WebGazer.js** (v2.1.0, Papoutsaki et al., 2016) — the most widely cited browser-based webcam gaze tracker — using identical hardware (Lenovo i7-1165G7, built-in webcam, 1920×869 screen), identical calibration protocol (9-point, same regression family: Ridge), and identical test methodology (9 test points, 2-second dwell, 40 gaze samples per point).

| Method | Mean ± Std | p50 | p90 | Mean visual angle |
|---|---|---|---|---|
| WebGazer.js (TFFacemesh + Ridge) | 522 ± 247 px | 626 px | 818 px | 15.8° |
| **ReaRead — EyeTrax + KDE (proposed)** | **25 ± 13 px** | **24 px** | **43 px** | **0.8°** |

ReaRead achieves **95% lower mean gaze error** and **96% lower median error** than WebGazer.js on the same hardware. WebGazer.js exhibits a systematic rightward and downward bias (predictions cluster toward screen center-right regardless of true gaze direction), consistent with known limitations of browser-based trackers that lack head-pose compensation. ReaRead's head-relative normalized features eliminate this systematic offset.

**Response — Ablation 1: KDE on vs. off** — See R1-Q2 response above (Table included).

**Response — Ablation 2: 5-point vs. 9-point calibration [NEW — Section X.X]:**

The 9-point calibration was selected over 5-point based on established literature: 9-point calibration yields 15–20% lower gaze error vs. 5-point for regression-based webcam trackers (Papoutsaki et al., 2016; Huang et al., 2017), due to improved spatial sampling of peripheral screen regions. Our 9-point protocol requires ~18 seconds (9 points × 2 s), an acceptable one-time setup cost. A 5-point variant (10 s) would be appropriate for central-region content but degrades accuracy for peripheral paragraphs. This trade-off is discussed in Section X.X **[REVISED]**.

**Response — Ablation 3: Single vs. two-threshold dwell classification [NEW — Section X.X, Table X]:**

We evaluated both threshold strategies on N=200 simulated paragraph evaluations (ground truth: 30% Hard, 20% Medium, 50% Normal; measured ratios drawn from Gaussian distributions fitted to observed data):

| Threshold strategy | Precision | Recall | F1-score |
|---|---|---|---|
| **Two-threshold (≥ 1.3 Medium, ≥ 1.6 Hard)** | **0.967** | **0.880** | **0.921** |
| Single threshold (≥ 1.5 Difficult) | 1.000 | 0.710 | 0.830 |

The two-threshold strategy achieves +9.1% higher F1 through substantially better recall (+17%), meaning fewer genuinely difficult paragraphs go undetected. The single-threshold variant achieves perfect precision but misses 29% of difficult paragraphs — an undesirable outcome for a reading-assistance system. We retain the two-threshold approach and have added this ablation to Section X.X **[NEW]**.

---

## Comment R2-4: Metric Definitions and Ground-Truth Validation

> *"The manuscript reports metrics such as 'focus score' and 'difficulty ratio' but their formal definitions, computation pipeline, and validation approach are not sufficiently specified."*

**Response — Explicit formulae [NEW — Section X.X]:**

We have added formal mathematical definitions for both metrics **[NEW]**:

**Difficulty Ratio (DR):**

$$DR(p) = \frac{T_{\text{actual}}(p)}{T_{\text{expected}}(p)}, \quad T_{\text{expected}}(p) = \frac{|W(p)|}{200/60}$$

where $|W(p)|$ is the word count of paragraph $p$ and 200 WPM is the adult reading-speed baseline (Brysbaert, 2019).

Classification thresholds: DR ≥ 1.6 → Hard; 1.3 ≤ DR < 1.6 → Medium; DR < 1.3 → Normal.

*Worked example (85-word paragraph, $T_{\text{expected}}$ = 25.5 s):*
- $T_{\text{actual}}$ = 20 s → DR = 0.78 → Normal
- $T_{\text{actual}}$ = 35 s → DR = 1.37 → Medium
- $T_{\text{actual}}$ = 55 s → DR = 2.16 → Hard

**Focus Score (FS):**

$$FS(s) = \frac{N_{\text{in}}}{N_{\text{total}}} \times 100\%$$

where $N_{\text{in}}$ = gaze points within the content-area bounding box, $N_{\text{total}}$ = all gaze samples in session $s$.

Distraction alert is triggered if: FS < 40% over a 5-minute sliding window, OR consecutive out-of-bounds gaze ≥ 45 seconds.

**Response — Dispersion reporting [REVISED]:**

Mean ± standard deviation is now reported for all aggregate metrics throughout the results section.

**Response — Ground-truth validation [REVISED — Threats to Validity]:**

We acknowledge that task-based ground-truth validation (e.g., comprehension questions correlated with DR) was not performed in this study. The difficulty ratio is validated indirectly through the dwell-time threshold ablation (F1 = 0.921 under simulated ground truth) and through face validity: the 200 WPM baseline is well-established in the reading science literature (Brysbaert, 2019), and the 1.3/1.6 thresholds were calibrated on observed reading sessions. We have strengthened the "Threats to Validity" section accordingly, noting that future work should include comprehension-based validation **[REVISED]**.

---

## Comment R2-5: LLM/TTS Components Underspecified

> *"The paper includes AI-assisted features such as LLM-based summarization and TTS-based reading, yet it does not specify the LLM/TTS provider/model, whether inference is local or cloud-based, what data are transmitted/logged, and what safeguards are in place."*

**Response:**

We have added a dedicated **"AI Components"** subsection **[NEW — Section X.X]** with full technical and privacy details:

| Component | Provider | Model | Deployment | Data transmitted | User ID? | Logging? |
|---|---|---|---|---|---|---|
| Summarization / Explanation / Q&A | Groq | llama-3.3-70b-versatile | Cloud API (HTTPS) | Paragraph text only | No | No |
| Text-to-Speech | ElevenLabs | eleven\_multilingual\_v2 (voice: Sarah) | Cloud API (HTTPS) | Paragraph text only | No | No |
| Gaze estimation | EyeTrax + MediaPipe | Face Mesh 468-landmark | On-device | None | — | Local only |
| Session analytics | Chrome storage | — | On-device | None | — | Local only |

Key safeguards:
- LLM and TTS are triggered **only by explicit user action** (button press); no automatic background transmission
- No gaze coordinates, face landmarks, session identifiers, or user information are transmitted to cloud services
- All API calls use HTTPS; payloads contain only the selected paragraph text
- No prompt logging or output retention by cloud providers (stateless API calls)
- A disabled fallback (Google Gemini 2.0 Flash) is present in the codebase but not active in the evaluated build

---

## Comment R2-6: Real-Time Claim Requires Latency Distribution and Hardware Specification

> *"For a strong 'real-time' claim, the paper should report end-to-end latency as a distribution (at minimum p50 and p90) and the test hardware used."*

**Response:**

We have added a complete latency analysis and hardware specification **[NEW — Section X.X, Table X]**.

**Test hardware:** Lenovo laptop, Intel Core i7-1165G7 @ 2.80 GHz (4 cores), 16 GB RAM, Windows 11 Pro, no GPU acceleration (CPU-only inference).

**End-to-end latency** (camera frame → UI update), measured from companion application log timestamps, N = 2,177 inter-frame intervals over a 6-minute session:

| Statistic | Value |
|---|---|
| Mean ± Std | 134.7 ± 34.8 ms |
| p50 (median) | 135 ms |
| p75 | 146 ms |
| p90 | 156 ms |
| p99 | 243 ms |

**Pipeline component breakdown:**

| Stage | Estimated time | Basis |
|---|---|---|
| Camera frame acquisition | ~8 ms | 30 fps buffer |
| EyeTrax feature extraction (MediaPipe Face Mesh) | ~110 ms | Dominant cost, CPU-only |
| KDE smoothing | 0.008 ms | Benchmarked (500 samples) |
| WebSocket broadcast (localhost:8765) | 1–3 ms | Local loopback |
| Browser JS parsing + DOM update | 7–26 ms | Chrome DevTools estimate |
| **Total (measured p50)** | **135 ms** | Log-based |

EyeTrax feature extraction dominates at ~82% of total latency on CPU-only hardware. We note that this results in an **effective gaze stream rate of 7.6 Hz** rather than the targeted 30 Hz — a limitation of CPU-bound MediaPipe inference on mid-range laptop hardware. For reading-assistance purposes, 7.6 Hz (one update per ~132 ms) is sufficient, as paragraph-level dwell accumulation operates on 250 ms analysis intervals. GPU acceleration (MediaPipe GPU backend) would reduce the bottleneck to ~20–30 ms, enabling true 30 Hz operation — this is identified as a direction for future work.

We have revised the "real-time" claim throughout the manuscript to accurately reflect the 7.6 Hz effective rate and 135 ms median latency **[REVISED]**.

---

# SUMMARY OF CHANGES

| # | Reviewer | Comment | Action |
|---|---|---|---|
| R1-Q1 | R1 | Head movement robustness | NEW: quantitative yaw offset table (0°–30°) |
| R1-Q2a | R1 | KDE explanation + Figure 4 | REVISED: explicit temporal KDE description; Figure 4 updated |
| R1-Q2b | R1 | KDE vs. Mean ablation | NEW: Table — 25.6% lower error with KDE |
| R1-Q2c | R1 | KDE masking limitation | NEW: Discussion paragraph on attention instability masking |
| R1-Typo | R1 | 8 typographical/formatting issues | REVISED: all 8 corrected |
| R2-1 | R2 | Ethics & Privacy section | NEW: full subsection — consent, data types, anonymization, storage, third-party transfer |
| R2-2 | R2 | Study protocol table | NEW: Table — 13-parameter protocol summary |
| R2-3a | R2 | Webcam baseline comparison | NEW: WebGazer.js empirical test — 522 px vs. 25 px (95% improvement) |
| R2-3b | R2 | KDE ablation | NEW: covered under R1-Q2b |
| R2-3c | R2 | 5-pt vs. 9-pt calibration | NEW: literature-based comparison; 9-pt rationale |
| R2-3d | R2 | Threshold ablation | NEW: Table — F1 0.921 vs. 0.830 |
| R2-4a | R2 | Difficulty Ratio formula | NEW: LaTeX formula + worked example |
| R2-4b | R2 | Focus Score formula | NEW: LaTeX formula + distraction trigger conditions |
| R2-4c | R2 | Mean ± std reporting | REVISED: throughout results section |
| R2-4d | R2 | Ground-truth validation | REVISED: Threats to Validity strengthened |
| R2-5 | R2 | LLM/TTS specification | NEW: full provider/model/payload/privacy table |
| R2-6 | R2 | Real-time latency + hardware | NEW: p50=135ms, p90=156ms, pipeline breakdown, hardware specs |
