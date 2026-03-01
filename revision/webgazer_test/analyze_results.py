"""
WebGazer test sonuçlarını analiz et ve ReaRead ile karşılaştır.
Kullanım: python analyze_results.py webgazer_accuracy_results.json
"""
import json, sys, math, statistics

def analyze(path):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)

    agg = data['aggregate']
    meta = data['meta']
    points = data['per_point']

    print('=' * 60)
    print('WEBGAZER.JS ACCURACY TEST RESULTS')
    print('=' * 60)
    print(f"Date       : {meta['date']}")
    print(f"Screen     : {meta['screen']}")
    print(f"Method     : {meta['method']}")
    print(f"Calibration: {meta['calibration']}")
    print(f"Valid pts  : {meta['valid_points']}/{meta['test_points']}")
    print()
    print('--- Aggregate Metrics ---')
    print(f"Mean error : {agg['mean_error_px']} px  ({agg['mean_error_deg']}°)")
    print(f"Std dev    : {agg['std_error_px']} px")
    print(f"p50        : {agg['p50_px']} px  ({agg['p50_deg']}°)")
    print(f"p90        : {agg['p90_px']} px  ({agg['p90_deg']}°)")
    print()

    print('--- Per-Point Results ---')
    print(f"{'Pt':<4} {'Target X,Y':<16} {'Pred X,Y':<16} {'Err (px)':<12} {'Samples'}")
    print('-' * 58)
    for p in points:
        if p.get('error'):
            tx, ty = p['target']['x'], p['target']['y']
            px_, py_ = p['predicted']['x'], p['predicted']['y']
            e = p['error']['euclidean']
            print(f"{p['point']:<4} ({tx:4d},{ty:4d})      ({px_:4d},{py_:4d})      {e:<12} {p['samples']}")
        else:
            print(f"{p['point']:<4} ({p['target']['x']},{p['target']['y']})  NO DATA  -  {p['samples']}")

    print()
    print('=' * 60)
    print('COMPARISON: WebGazer vs ReaRead (EyeTrax+KDE)')
    print('=' * 60)
    rearead_mean = 25.3  # frontal, from our simulation
    rearead_p50  = 23.7
    wg_mean = agg['mean_error_px']
    wg_p50  = agg['p50_px']

    print(f"{'Method':<30} {'Mean Error':>12} {'p50':>8} {'Visual Angle (mean)':>20}")
    print('-' * 72)
    print(f"{'WebGazer.js (TFFacemesh+Ridge)':<30} {wg_mean:>12} px {wg_p50:>8} px {wg_mean/33:>18.1f}°")
    print(f"{'ReaRead (EyeTrax+KDE)':<30} {rearead_mean:>12} px {rearead_p50:>8} px {rearead_mean/33:>18.1f}°")
    print()

    improvement = (wg_mean - rearead_mean) / wg_mean * 100 if wg_mean > 0 else 0
    print(f"ReaRead improvement over WebGazer: {improvement:.1f}% lower mean gaze error")
    print()

    # Generate table for paper
    print('--- LaTeX Table (copy to paper) ---')
    print(r'\begin{table}[h]')
    print(r'\caption{Gaze Accuracy Comparison: WebGazer.js vs. ReaRead (EyeTrax+KDE)}')
    print(r'\begin{tabular}{lccc}')
    print(r'\hline')
    print(r'Method & Mean Error (px) & p50 (px) & Visual Angle \\')
    print(r'\hline')
    print(f"WebGazer.js~\\cite{{papoutsaki2016webgazer}} & {wg_mean} & {wg_p50} & {wg_mean/33:.1f}° \\\\")
    print(f"ReaRead (EyeTrax+KDE) [Proposed] & {rearead_mean} & {rearead_p50} & {rearead_mean/33:.1f}° \\\\")
    print(r'\hline')
    print(r'\end{tabular}')
    print(r'\end{table}')

if __name__ == '__main__':
    path = sys.argv[1] if len(sys.argv) > 1 else 'webgazer_accuracy_results.json'
    try:
        analyze(path)
    except FileNotFoundError:
        print(f"Dosya bulunamadı: {path}")
        print("Önce webgazer_accuracy_test.html'i Chrome'da çalıştır ve JSON'u bu klasöre kaydet.")
