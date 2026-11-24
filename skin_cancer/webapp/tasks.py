"""Task 7: Việc phân tích AI chạy trong worker Celery (hoặc thread nền cục bộ).

Đặt file này ở skin_cancer/webapp/tasks.py
"""

import sys
import importlib
from uuid import uuid4

from PIL import Image, UnidentifiedImageError

from skin_cancer.webapp.celery_app import celery
from skin_cancer.webapp.extensions import db
from skin_cancer.webapp.models import Analysis, AnalysisResult, Case, CaseImage
from skin_cancer.webapp.services.ai_analysis import mark_analysis_failed
from skin_cancer.webapp.services.focus_region import apply_focus_region  # task 1
from skin_cancer.webapp.services.result_cache import save_cached


def _webapp():
    # Import muộn để tránh import vòng (app.py cũng import tasks.py)
    if "skin_cancer.webapp.app" in sys.modules:
        return sys.modules["skin_cancer.webapp.app"]
    if "__main__" in sys.modules and hasattr(sys.modules["__main__"], "run_ai_inference"):
        return sys.modules["__main__"]
    return importlib.import_module("skin_cancer.webapp.app")


def _run_analysis(analysis_id, case_image_id):
    webapp = _webapp()

    with webapp.app.app_context():
        analysis = db.session.get(Analysis, analysis_id)
        case_image = db.session.get(CaseImage, case_image_id)
        case = db.session.get(Case, case_image.case_id)
        gradcam_path = None

        try:
            webapp.app.logger.info("[ANALYSIS #%s] Bắt đầu xử lý case_image=%s...", analysis_id, case_image_id)
            analysis.status = "PROCESSING"
            analysis.started_at = webapp.utcnow_naive()
            case_image.status = "PROCESSING"
            db.session.commit()

            try:
                pil_img = Image.open(case_image.image_path).convert("RGB")
            except (UnidentifiedImageError, OSError, ValueError) as img_err:
                webapp.app.logger.error("[ANALYSIS #%s] File ảnh không hợp lệ: %s", analysis_id, img_err)
                raise ValueError("File ảnh không hợp lệ")
            pil_img = apply_focus_region(pil_img, case_image.focus_region)  # task 1

            context = {
                "lesion_location": case.lesion_location or "",
                "patient": case.patient_snapshot or (
                    {
                        "full_name": getattr(case.patient, "full_name", None),
                        "gender": getattr(case.patient, "gender", None),
                        "dob": str(getattr(case.patient, "dob", "")) if getattr(case.patient, "dob", None) else None,
                    }
                    if getattr(case, "patient", None)
                    else None
                ),
            }
            webapp.app.logger.info("[ANALYSIS #%s] Bắt đầu chạy suy luận AI...", analysis_id)
            data, cam_vis, inference_time_ms = webapp.run_ai_inference(pil_img, context=context)
            webapp.app.logger.info("[ANALYSIS #%s] Suy luận hoàn tất sau %.1f ms! Đang lưu kết quả...", analysis_id, inference_time_ms)

            # Lưu ảnh Grad-CAM
            gradcam_dir = (webapp.PROJECT_ROOT / "instance" / "gradcam").resolve()
            gradcam_dir.mkdir(parents=True, exist_ok=True)
            gradcam_path = gradcam_dir / f"analysis_{analysis.id}_{uuid4().hex}.png"
            Image.fromarray(cam_vis).save(gradcam_path, format="PNG")

            analysis.gradcam_path = str(gradcam_path)
            analysis.status = "COMPLETED"
            analysis.completed_at = webapp.utcnow_naive()
            analysis.error_message = None

            db.session.add(
                AnalysisResult(
                    analysis_id=analysis.id,
                    model_name="EfficientNet-B0",
                    binary_result=data["binary"]["prediction"],
                    binary_probability=data["binary"]["prob_malignant"],
                    predicted_class=data["multiclass"]["pred_class"],
                    predicted_probability=data["multiclass"]["pred_conf"],
                    class_probabilities=data["multiclass"]["probs"],
                    inference_time_ms=inference_time_ms,
                )
            )

            case_image.status = "COMPLETED"
            if case.status in {"CREATED", "UPLOADED"}:
                case.status = "ANALYZED"
            db.session.commit()

            data["analysis_id"] = analysis.id
            data["case_image_id"] = case_image.id
            data["case_id"] = case.id

            # Lưu vào cache để dù không có Redis/Celery web vẫn đọc được ngay
            save_cached(f"analysis-result:{analysis.id}", data)
            webapp.app.logger.info("[ANALYSIS #%s] Thành công! Đã lưu kết quả vào database & cache.", analysis_id)
            return data

        except Exception as exc:
            import traceback
            tb = traceback.format_exc()
            webapp.app.logger.error("[ANALYSIS #%s] THẤT BẠI: %s\n%s", analysis_id, exc, tb)
            mark_analysis_failed(analysis_id, case_image_id, f"{exc}\n{tb}")
            if gradcam_path:
                gradcam_path.unlink(missing_ok=True)
            return None


if celery is not None:
    analyze_task = celery.task(name="analyze_case_image")(_run_analysis)
else:
    def analyze_task(analysis_id, case_image_id):
        return _run_analysis(analysis_id, case_image_id)

    def _apply_async_fallback(*args, **kwargs):
        raise RuntimeError("Thư viện 'celery' chưa được cài đặt.")

    analyze_task.apply_async = _apply_async_fallback
