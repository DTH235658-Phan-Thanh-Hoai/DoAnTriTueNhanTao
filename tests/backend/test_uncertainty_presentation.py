from skin_cancer.webapp.services.uncertainty import (
    apply_uncertainty_safety,
    check_uncertainty,
    neutralize_interpretation_if_uncertain,
    uncertainty_for_probabilities,
)
from skin_cancer.webapp.routes.cases import _binary_result_label, _probability_percent


def test_uncertain_interpretation_replaces_reassuring_copy():
    original = {
        "severity": "normal",
        "severity_label": "LÀNH TÍNH",
        "severity_note": "Không đáng lo ngại",
        "headline": "Không phát hiện dấu hiệu ung thư rõ ràng",
        "summary": "Kết quả khả quan, không có nguy cơ ung thư.",
        "detail": "Thông điệp an toàn tuyệt đối.",
        "conclusion": "Không có nguy cơ.",
        "actions": [],
        "doctor_suggestion": "Không cần lo lắng",
        "chatgpt_powered": True,
    }
    result = neutralize_interpretation_if_uncertain(original)
    copy = " ".join(
        str(result.get(key, "")) for key in
        ("severity_label", "severity_note", "headline", "summary", "detail", "conclusion")
    )
    assert "chưa đủ chắc chắn" in copy.lower()
    assert "bác sĩ" in copy.lower()
    assert "không đáng lo" not in copy.lower()
    assert "không có nguy cơ" not in copy.lower()
    assert result["doctor_suggestion"] is None
    assert result["chatgpt_powered"] is False


def test_non_dict_interpretation_is_left_absent():
    assert neutralize_interpretation_if_uncertain(None) is None


def test_existing_low_confidence_rule_keeps_its_threshold_and_gets_neutral_copy():
    probabilities = [0.342, 0.30, 0.20, 0.08, 0.04, 0.02, 0.01, 0.008]
    uncertainty = check_uncertainty(probabilities)
    assert uncertainty["is_uncertain"] is True
    result = neutralize_interpretation_if_uncertain({"summary": "Không có nguy cơ."})
    assert "chưa đủ cơ sở" in result["summary"].lower()


def test_persisted_probability_vector_reuses_existing_uncertainty_rule():
    result = uncertainty_for_probabilities({
        "BKL": 0.342, "NV": 0.30, "MEL": 0.20, "BCC": 0.08,
        "AK": 0.04, "SCC": 0.02, "DF": 0.01, "VASC": 0.008,
    })
    assert result["is_uncertain"] is True
    assert uncertainty_for_probabilities(None)["is_uncertain"] is True
    assert uncertainty_for_probabilities([0.5])["is_uncertain"] is True
    assert uncertainty_for_probabilities([0.8, float("nan")])["is_uncertain"] is True
    assert uncertainty_for_probabilities([0.8, 0.1])["is_uncertain"] is True


def test_legacy_cached_result_without_uncertainty_is_recomputed_and_neutralized():
    cached = {
        "multiclass": {"probs": [0.342, 0.30, 0.20, 0.08, 0.04, 0.02, 0.01, 0.008]},
        "interpretation": {"summary": "Không có nguy cơ ung thư."},
    }
    assert apply_uncertainty_safety(cached) is cached
    assert cached["uncertainty"]["is_uncertain"] is True
    assert "chưa đủ cơ sở" in cached["interpretation"]["summary"].lower()


def test_cached_confident_result_preserves_interpretation():
    cached = {
        "uncertainty": {"is_uncertain": False},
        "interpretation": {"summary": "Nội dung hiện có."},
    }
    apply_uncertainty_safety(cached)
    assert cached["interpretation"]["summary"] == "Nội dung hiện có."


def test_cached_confident_flag_cannot_override_uncertain_probability_vector():
    cached = {
        "uncertainty": {"is_uncertain": False},
        "multiclass": {"probs": [0.342, 0.30, 0.20, 0.08, 0.04, 0.02, 0.01, 0.008]},
        "interpretation": {"summary": "Không có nguy cơ."},
    }

    apply_uncertainty_safety(cached)

    assert cached["uncertainty"]["is_uncertain"] is True
    assert "chưa đủ cơ sở" in cached["interpretation"]["summary"].lower()


def test_doctor_history_does_not_infer_missing_binary_result_as_benign():
    assert _binary_result_label(0) == "benign"
    assert _binary_result_label(1) == "malignant"
    assert _binary_result_label(None) is None
    assert _binary_result_label(2) is None
    assert _binary_result_label(True) is None
    assert _binary_result_label(False) is None


def test_doctor_history_preserves_missing_or_invalid_multiclass_probability():
    assert _probability_percent(0.896) == 89.6
    assert _probability_percent(None) is None
    assert _probability_percent(1.2) is None

