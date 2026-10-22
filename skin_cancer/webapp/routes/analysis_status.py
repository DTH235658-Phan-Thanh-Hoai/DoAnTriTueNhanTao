"""Task 7: API hỏi trạng thái phân tích (frontend gọi lặp lại mỗi giây)."""

try:
    from celery.result import AsyncResult
except ImportError:
    AsyncResult = None
from flask import Blueprint, abort, jsonify

from ..celery_app import celery
from ..extensions import db
from ..models import Analysis
from ..services.access import require_roles, visible_case_or_404

bp = Blueprint("analysis_status", __name__, url_prefix="/api")


def resolve_status(db_status, task_state):
    """Gộp trạng thái trong DB và trạng thái Celery thành một kết luận.

    DB cập nhật COMPLETED trước khi Celery kịp lưu kết quả vào Redis,
    nên nếu task chưa SUCCESS thì vẫn coi là đang xử lý.
    """
    if db_status == "FAILED":
        return "FAILED"
    if db_status != "COMPLETED":
        return db_status  # PENDING hoặc PROCESSING
    if task_state == "SUCCESS":
        return "COMPLETED"
    if task_state in ("STARTED", "RETRY"):
        return "PROCESSING"
    return "EXPIRED"  # kết quả trong Redis đã hết hạn


@bp.get("/analyses/<int:analysis_id>/status")
@require_roles("ADMIN", "DOCTOR")
def analysis_status(analysis_id):
    analysis = db.session.get(Analysis, analysis_id)
    if analysis is None:
        abort(404)
    visible_case_or_404(analysis.case_id)  # kiểm tra quyền xem ca bệnh

    if AsyncResult is None or celery is None:
        return jsonify(status="FAILED", error="Hệ thống Celery/Redis chưa sẵn sàng."), 503

    task = AsyncResult(f"analysis-{analysis_id}", app=celery)
    status = resolve_status(analysis.status, task.state)

    if status == "COMPLETED":
        return jsonify(status="COMPLETED", result=task.result)
    if status == "FAILED":
        return jsonify(status="FAILED", error="Không thể phân tích ảnh đã upload.")
    if status == "EXPIRED":
        return jsonify(status="FAILED", error="Kết quả đã hết hạn, hãy phân tích lại.")
    return jsonify(status=status)
