"""
pdm_feature_extractor.py
Module trích xuất đặc trưng chuỗi thời gian (Feature Engineering) cho bảo trì dự đoán.
Tính toán các chỉ số: RMS, Peak-to-Peak, Crest Factor, Kurtosis, Skewness, Variance.
"""

import numpy as np
from scipy import stats
from typing import Dict, Any, List

class TimeSeriesFeatureExtractor:
    @staticmethod
    def extract_scalar_features(signal_values: List[float]) -> Dict[str, float]:
        """
        Trích xuất bộ đặc trưng thống kê miền thời gian từ mảng số liệu cảm biến.
        Xử lý an toàn các trường hợp mảng rỗng, mảng hằng số hoặc dữ liệu nhiễu.
        """
        arr = np.array(signal_values, dtype=np.float64)
        n_samples = len(arr)

        if n_samples == 0:
            return {
                "mean": 0.0, "std": 0.0, "rms": 0.0, "peak_to_peak": 0.0,
                "crest_factor": 0.0, "kurtosis": 0.0, "skewness": 0.0, "sample_count": 0
            }

        mean_val = float(np.mean(arr))
        std_val = float(np.std(arr))
        
        # 1. Tính giá trị hiệu dụng RMS (Root Mean Square) - Đặc trưng cho công suất tiêu hao
        rms_val = float(np.sqrt(np.mean(arr ** 2)))
        
        # 2. Biên độ đỉnh-đỉnh Peak-to-Peak (P2P) - Phát hiện xung va đập cơ khí
        p2p_val = float(np.ptp(arr))
        peak_val = float(np.max(np.abs(arr)))

        # 3. Hệ số đỉnh Crest Factor = Peak / RMS (Tỷ lệ xung sốc trên năng lượng nền)
        crest_factor = float(peak_val / (rms_val + 1e-8))

        # 4. Độ nhọn Kurtosis & Độ lệch Skewness - Nhận diện méo dạng phân phối do mòn cơ khí
        if std_val < 1e-6:
            kurtosis_val = 0.0
            skewness_val = 0.0
        else:
            kurtosis_val = float(stats.kurtosis(arr, fisher=True)) # Fisher = 0 cho phân phối chuẩn
            skewness_val = float(stats.skew(arr))

        return {
            "mean": round(mean_val, 4),
            "std": round(std_val, 4),
            "rms": round(rms_val, 4),
            "peak_to_peak": round(p2p_val, 4),
            "crest_factor": round(crest_factor, 4),
            "kurtosis": round(kurtosis_val, 4),
            "skewness": round(skewness_val, 4),
            "sample_count": n_samples
        }

    @staticmethod
    def detect_micro_fluctuations(signal_values: List[float], threshold_sigma: float = 2.5) -> float:
        """
        Phát hiện tỷ lệ vi dao động bất thường (Micro-fluctuations) vượt ngưỡng 2.5 sigma.
        Dấu hiệu điển hình của rơ trục hoặc mòn bi giai đoạn khởi phát.
        """
        arr = np.array(signal_values, dtype=np.float64)
        if len(arr) < 5:
            return 0.0

        mean = np.mean(arr)
        std = np.std(arr)
        if std < 1e-5:
            return 0.0

        z_scores = np.abs((arr - mean) / std)
        outliers_ratio = float(np.mean(z_scores > threshold_sigma))
        return round(outliers_ratio, 4)