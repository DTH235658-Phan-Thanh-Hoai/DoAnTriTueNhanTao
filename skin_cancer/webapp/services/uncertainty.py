"""Task 3: Cảnh báo "model không chắc chắn" từ xác suất softmax."""

import math

# Chỉnh ngưỡng bằng tập val: xem các ca model đoán sai thường có margin/entropy bao nhiêu
MARGIN_THRESHOLD = 0.20  # top-1 hơn top-2 ít hơn 20% -> không chắc
ENTROPY_THRESHOLD = 0.60  # entropy chuẩn hóa (0..1) cao hơn -> không chắc


def neutralize_interpretation_if_uncertain(interpretation):
    """Replace categorical reassurance while preserving the existing threshold."""
    if not isinstance(interpretation, dict):
        return interpretation
    return {
        **interpretation,
        "severity": "caution",
        "severity_label": "C\u1ea7n b\u00e1c s\u0129 \u0111\u00e1nh gi\u00e1",
        "severity_note": "K\u1ebft qu\u1ea3 AI ch\u01b0a \u0111\u1ee7 ch\u1eafc ch\u1eafn.",
        "headline": "K\u1ebft qu\u1ea3 AI ch\u01b0a \u0111\u1ee7 ch\u1eafc ch\u1eafn",
        "summary": "C\u00e1c \u0111\u1ea7u ra AI ch\u1ec9 mang t\u00ednh tham kh\u1ea3o v\u00e0 ch\u01b0a \u0111\u1ee7 c\u01a1 s\u1edf \u0111\u1ec3 k\u1ebft lu\u1eadn an to\u00e0n hay lo\u1ea1i tr\u1eeb nguy c\u01a1. Vui l\u00f2ng trao \u0111\u1ed5i v\u1edbi b\u00e1c s\u0129.",
        "detail": "K\u1ebft qu\u1ea3 c\u1ea7n \u0111\u01b0\u1ee3c b\u00e1c s\u0129 xem x\u00e9t c\u00f9ng th\u00f4ng tin l\u00e2m s\u00e0ng ph\u00f9 h\u1ee3p.",
        "actions": ["\u0110\u1ec1 ngh\u1ecb b\u00e1c s\u0129 \u0111\u00e1nh gi\u00e1 k\u1ebft qu\u1ea3 v\u00e0 quy\u1ebft \u0111\u1ecbnh b\u01b0\u1edbc ti\u1ebfp theo."],
        "conclusion": "Ch\u01b0a th\u1ec3 \u0111\u01b0a ra k\u1ebft lu\u1eadn ch\u1eafc ch\u1eafn t\u1eeb k\u1ebft qu\u1ea3 AI n\u00e0y.",
        "doctor_suggestion": None,
        "chatgpt_powered": False,
    }


def uncertainty_for_probabilities(probs):
    """Return the existing uncertainty decision for a valid stored probability vector."""
    import math

    values = list(probs.values()) if isinstance(probs, dict) else probs
    if not isinstance(values, (list, tuple)) or len(values) < 2:
        return {
            "is_uncertain": True,
            "margin": None,
            "entropy": None,
            "message": "Không đủ dữ liệu xác suất để đánh giá; cần bác sĩ xem xét.",
        }
    if any(
        not isinstance(value, (int, float))
        or isinstance(value, bool)
        or not math.isfinite(value)
        or value < 0
        or value > 1
        for value in values
    ):
        return {
            "is_uncertain": True,
            "margin": None,
            "entropy": None,
            "message": "Dữ liệu xác suất không hợp lệ; cần bác sĩ đánh giá.",
        }
    if abs(sum(values) - 1.0) > 0.001:
        return {
            "is_uncertain": True,
            "margin": None,
            "entropy": None,
            "message": "Dữ liệu xác suất không hợp lệ; cần bác sĩ đánh giá.",
        }
    try:
        return check_uncertainty(values)
    except (ValueError, ZeroDivisionError):
        return None


def apply_uncertainty_safety(result):
    """Backfill old cached uncertainty and neutralize its interpretation in place."""
    if not isinstance(result, dict):
        return result
    uncertainty = result.get("uncertainty")
    multiclass = result.get("multiclass")
    has_probabilities = isinstance(multiclass, dict) and "probs" in multiclass
    if has_probabilities or not isinstance(uncertainty, dict) or not isinstance(uncertainty.get("is_uncertain"), bool):
        probabilities = multiclass.get("probs") if isinstance(multiclass, dict) else None
        uncertainty = uncertainty_for_probabilities(probabilities)
        if uncertainty is not None:
            result["uncertainty"] = uncertainty
    if uncertainty and uncertainty.get("is_uncertain"):
        result["interpretation"] = neutralize_interpretation_if_uncertain(
            result.get("interpretation")
        )
    return result


def check_uncertainty(probs):
    """probs: dict {tên_lớp: xác suất} hoặc list xác suất."""
    values = list(probs.values()) if isinstance(probs, dict) else list(probs)

    top = sorted(values, reverse=True)
    margin = top[0] - top[1]

    # Entropy chia cho log(số lớp) để về thang 0..1
    entropy = -sum(p * math.log(p) for p in values if p > 0)
    entropy_norm = entropy / math.log(len(values))

    is_uncertain = margin < MARGIN_THRESHOLD or entropy_norm > ENTROPY_THRESHOLD

    return {
        "is_uncertain": is_uncertain,
        "margin": round(margin, 3),
        "entropy": round(entropy_norm, 3),
        "message": "Ca này khó, nên hỏi bác sĩ." if is_uncertain else None,
    }
