"""Admin portal pages and the small set of admin dashboard APIs."""
from datetime import date

from flask import Blueprint, abort, jsonify, render_template, request
from flask_login import current_user
from sqlalchemy import func, or_

from ..extensions import db
from ..models import Analysis, AnalysisResult, Case, User
from ..services.access import require_roles

bp = Blueprint("admin", __name__)


@bp.get("/admin")
@require_roles("ADMIN")
def portal():
    return render_template("admin.html", admin=current_user)


@bp.get("/api/admin/overview")
@require_roles("ADMIN")
def overview():
    counts = {
        "users": db.session.scalar(db.select(func.count(User.id))) or 0,
        "cases": db.session.scalar(db.select(func.count(Case.id))) or 0,
        "analyses": db.session.scalar(db.select(func.count(Analysis.id))) or 0,
        "doctors": db.session.scalar(
            db.select(func.count(User.id)).where(User.role == "DOCTOR")
        ) or 0,
    }
    recent_cases = db.session.scalars(
        db.select(Case).order_by(Case.created_at.desc()).limit(6)
    ).all()
    recent_analyses = db.session.scalars(
        db.select(Analysis).order_by(Analysis.created_at.desc()).limit(6)
    ).all()
    class_labels = {
        "MEL": ("Melanoma", "Nghi ngờ ác tính", "warning"),
        "NV": ("Nevus", "Nốt ruồi lành tính", "benign"),
        "BCC": ("Basal cell carcinoma", "Ung thư tế bào đáy", "warning"),
        "AK": ("Actinic keratosis", "Dày sừng ánh sáng", "warning"),
        "AKIEC": ("Actinic keratosis", "Dày sừng ánh sáng", "warning"),
        "BKL": ("Benign keratosis", "Sừng hóa lành tính", "benign"),
        "DF": ("Dermatofibroma", "U xơ da lành tính", "benign"),
        "VASC": ("Vascular lesion", "Tổn thương mạch máu", "benign"),
        "SCC": ("Squamous cell carcinoma", "Ung thư tế bào vảy", "warning"),
    }
    class_counts = {key: 0 for key in ("MEL", "NV", "BCC", "AKIEC", "BKL", "DF", "VASC", "SCC")}
    grouped_results = db.session.execute(
        db.select(
            func.upper(AnalysisResult.predicted_class),
            func.count(AnalysisResult.id),
        )
        .where(AnalysisResult.predicted_class.is_not(None))
        .group_by(func.upper(AnalysisResult.predicted_class))
    )
    for predicted_class, count in grouped_results:
        if predicted_class in class_counts:
            class_counts[predicted_class] += count
        elif predicted_class == "AK":
            class_counts["AKIEC"] += count
    total_results = sum(class_counts.values())
    analysis_distribution = [
        {
            "key": key,
            "name": class_labels[key][0],
            "label": class_labels[key][1],
            "type": class_labels[key][2],
            "count": count,
            "percentage": round(count / total_results * 100, 1) if total_results else 0,
        }
        for key, count in class_counts.items()
    ]
    month_keys = []
    cursor = date.today().replace(day=1)
    for _ in range(6):
        month_keys.append(cursor.strftime("%Y-%m"))
        cursor = (
            cursor.replace(day=1) - date.resolution
        ).replace(day=1)
    month_keys.reverse()
    case_by_month = dict(
        db.session.execute(
            db.select(
                func.strftime("%Y-%m", Case.created_at),
                func.count(Case.id),
            )
            .where(func.strftime("%Y-%m", Case.created_at).in_(month_keys))
            .group_by(func.strftime("%Y-%m", Case.created_at))
        ).all()
    )
    analysis_by_month = dict(
        db.session.execute(
            db.select(
                func.strftime("%Y-%m", Analysis.created_at),
                func.count(Analysis.id),
            )
            .where(func.strftime("%Y-%m", Analysis.created_at).in_(month_keys))
            .group_by(func.strftime("%Y-%m", Analysis.created_at))
        ).all()
    )
    trends = [
        {
            "key": month_key,
            "label": f"Thg {int(month_key[5:])}",
            "cases": case_by_month.get(month_key, 0),
            "analyses": analysis_by_month.get(month_key, 0),
        }
        for month_key in month_keys
    ]
    return jsonify(
        counts=counts,
        trends=trends,
        recent_cases=[
            {
                "code": case.case_code,
                "status": case.status,
                "doctor": case.doctor.full_name if case.doctor else "Chưa phân công",
                "created_at": case.created_at.strftime("%d/%m/%Y"),
            }
            for case in recent_cases
        ],
        recent_analyses=[
            {
                "id": analysis.id,
                "status": analysis.status,
                "model": (
                    analysis.results[0].model_name
                    if analysis.results
                    else "EfficientNet-B0"
                ),
                "prediction": (
                    analysis.results[0].predicted_class
                    if analysis.results and analysis.results[0].predicted_class
                    else "Đang xử lý",
            ),
            }
            for analysis in recent_analyses
        ],
        analysis_distribution=analysis_distribution,
    )


@bp.get("/api/admin/users")
@require_roles("ADMIN")
def users():
    search = request.args.get("search", "").strip()
    role = request.args.get("role", "").strip().upper()
    query = db.select(User).order_by(User.created_at.desc())
    if search:
        term = f"%{search}%"
        query = query.where(or_(User.full_name.ilike(term), User.email.ilike(term)))
    if role in {"ADMIN", "DOCTOR", "USER"}:
        query = query.where(User.role == role)
    records = db.session.scalars(query.limit(100)).all()
    return jsonify(
        users=[
            {
                "id": user.id,
                "name": user.full_name,
                "email": user.email,
                "role": user.role,
                "active": user.is_active,
                "created_at": user.created_at.strftime("%d/%m/%Y"),
            }
            for user in records
        ]
    )


@bp.post("/api/admin/users")
@require_roles("ADMIN")
def create_user():
    payload = request.get_json(silent=True) or {}
    name = payload.get("name", "").strip()
    email = payload.get("email", "").strip().lower()
    password = payload.get("password", "")
    role = payload.get("role", "USER").upper()
    if not (2 <= len(name) <= 150) or "@" not in email:
        abort(400, description="Họ tên hoặc email không hợp lệ.")
    if role not in {"ADMIN", "DOCTOR", "USER"}:
        abort(400, description="Vai trò không hợp lệ.")
    if not isinstance(password, str) or not 12 <= len(password) <= 256:
        abort(400, description="Mật khẩu phải có từ 12 đến 256 ký tự.")
    if db.session.scalar(db.select(User).where(User.email == email)):
        return jsonify(success=False, message="Email đã được sử dụng."), 409
    user = User(email=email, full_name=name, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    return jsonify(success=True), 201


@bp.patch("/api/admin/users/<int:user_id>/status")
@require_roles("ADMIN")
def update_user_status(user_id):
    user = db.session.get(User, user_id)
    if user is None:
        abort(404)
    if user.id == current_user.id:
        return jsonify(success=False, message="Không thể khóa tài khoản đang đăng nhập."), 400
    user.is_active = not user.is_active
    db.session.commit()
    return jsonify(success=True, active=user.is_active)
