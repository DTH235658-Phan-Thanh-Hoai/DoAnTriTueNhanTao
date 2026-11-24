"""Task 7: API hỏi trạng thái phân tích (frontend gọi lặp lại mỗi giây).

Hỗ trợ cả 2 chế độ:
- Chế độ Celery + Redis: Lấy trạng thái qua AsyncResult.
- Chế độ Local Threading: Lấy trạng thái từ Database + SQLite Cache (hoàn toàn không cần Docker/Redis).
"""

try:
    from celery.result import AsyncResult
except ImportError:
    AsyncResult = None
from flask import Blueprint, abort, jsonify

from ..celery_app import celery
from ..extensions import db
from ..models import Analysis
from ..services.access import require_roles, visible_case_or_404
from ..services.result_cache import get_cached

bp = Blueprint("analysis_status", __name__, url_prefix="/api")


@bp.get("/analyses/<int:analysis_id>/status")
@require_roles("ADMIN", "DOCTOR")
def analysis_status(analysis_id):
    analysis = db.session.get(Analysis, analysis_id)
    if analysis is None:
        abort(404)
    visible_case_or_404(analysis.case_id)  # kiểm tra quyền xem ca bệnh

    # 1. Trạng thái đã hoàn thành: lấy kết quả từ Celery hoặc SQLite Cache
    if analysis.status == "COMPLETED":
        task_res = None
        if AsyncResult is not None and celery is not None:
            try:
                task = AsyncResult(f"analysis-{analysis_id}", app=celery)
                if task.state == "SUCCESS" and task.result:
                    task_res = task.result
            except Exception:
                pass

        if task_res is None:
            task_res = get_cached(f"analysis-result:{analysis_id}")

        if task_res is not None:
            return jsonify(status="COMPLETED", result=task_res)

        # Fallback an toàn: nếu database đã hoàn thành nhưng cache chưa có
        if analysis.results:
            ar = analysis.results[0]
            p_malig = float(ar.binary_probability or 0.0)
            pred_class = ar.predicted_class or "UNKNOWN"
            pred_conf = float(ar.predicted_probability or 0.0)
            probs = ar.class_probabilities or {}

            task_res = {
                "success": True,
                "analysis_id": analysis.id,
                "case_image_id": analysis.case_image_id,
                "case_id": analysis.case_id,
                "binary": {
                    "prob_malignant": p_malig,
                    "prediction": int(p_malig > 0.5),
                    "label_vi": "NGHI NGỜ ÁC TÍNH" if p_malig > 0.5 else "LÀNH TÍNH",
                    "confidence_pct": round(max(p_malig, 1 - p_malig) * 100, 1),
                },
                "multiclass": {
                    "pred_class": pred_class,
                    "pred_conf": pred_conf,
                    "probs": probs,
                },
                "gradcam_url": f"/api/case-images/{analysis.case_image_id}/gradcam" if analysis.gradcam_path else None,
                "meta": {"from_db": True},
            }
            return jsonify(status="COMPLETED", result=task_res)

        return jsonify(status="PROCESSING")

    # 2. Trạng thái lỗi
    if analysis.status == "FAILED":
        return jsonify(
            status="FAILED",
            error=analysis.error_message or "Không thể phân tích ảnh đã upload.",
        )

    # 3. Trạng thái đang chờ hoặc đang xử lý ("PENDING" / "PROCESSING")
    return jsonify(status=analysis.status)
