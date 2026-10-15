"""Admin portal pages and the small set of admin dashboard APIs."""
from datetime import date, datetime, timedelta

from flask import Blueprint, abort, current_app, jsonify, render_template, request, send_from_directory
from flask_login import current_user
from sqlalchemy import func, or_
from pathlib import Path
from uuid import uuid4
from werkzeug.utils import secure_filename

from ..extensions import db
from ..models import Analysis, AnalysisResult, Case, User, AuditLog, DoctorApplication, SecuritySetting
from ..models.base import utcnow
from ..services.access import require_roles

bp = Blueprint("admin", __name__)


@bp.get("/api/admin/doctor-certificates/<path:filename>")
@require_roles("ADMIN")
def doctor_certificate(filename):
    root = (Path(current_app.config["UPLOAD_FOLDER"]) / "doctor-certificates").resolve()
    safe_path = (root / secure_filename(filename)).resolve()
    if root not in safe_path.parents or not safe_path.is_file():
        abort(404)
    return send_from_directory(root, safe_path.name, as_attachment=True)


@bp.post("/api/admin/doctor-applications/<int:application_id>/certificate")
@require_roles("ADMIN")
def upload_doctor_certificate(application_id):
    application = db.session.get(DoctorApplication, application_id)
    if application is None:
        abort(404)
    uploaded = request.files.get("certificate")
    if not uploaded or not uploaded.filename:
        abort(400, description="Vui lòng chọn file chứng chỉ.")
    suffix = Path(secure_filename(uploaded.filename)).suffix.lower()
    if suffix not in {".pdf", ".jpg", ".jpeg", ".png"}:
        abort(400, description="Chỉ nhận chứng chỉ PDF, JPG hoặc PNG.")
    data = uploaded.stream.read(5 * 1024 * 1024 + 1)
    if len(data) > 5 * 1024 * 1024:
        abort(413, description="File chứng chỉ tối đa 5 MB.")
    if suffix == ".pdf" and not data.startswith(b"%PDF-"):
        abort(400, description="Nội dung file PDF không hợp lệ.")
    if suffix in {".jpg", ".jpeg"} and not data.startswith(b"\xff\xd8\xff"):
        abort(400, description="Nội dung file JPG không hợp lệ.")
    if suffix == ".png" and not data.startswith(b"\x89PNG\r\n\x1a\n"):
        abort(400, description="Nội dung file PNG không hợp lệ.")
    root = Path(current_app.config["UPLOAD_FOLDER"]) / "doctor-certificates"
    root.mkdir(parents=True, exist_ok=True)
    filename = f"{application.id}-{uuid4().hex}{suffix}"
    (root / filename).write_bytes(data)
    application.certificate_path = filename
    _admin_audit("DOCTOR_CERTIFICATE_UPLOADED", application.user)
    db.session.commit()
    return jsonify(success=True, filename=filename)


def _admin_audit(event, target, success=True):
    db.session.add(AuditLog(
        user_id=current_user.id,
        email=current_user.email,
        event=event,
        success=success,
        ip_address=request.remote_addr,
        user_agent=request.headers.get("User-Agent", "")[:500],
    ))


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
    status = request.args.get("status", "").strip().upper()
    query = db.select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.desc())
    if search:
        term = f"%{search}%"
        query = query.where(or_(User.full_name.ilike(term), User.email.ilike(term)))
    if role in {"ADMIN", "DOCTOR", "USER"}:
        query = query.where(User.role == role)
    if status == "ACTIVE":
        query = query.where(User.is_active.is_(True))
    elif status == "LOCKED":
        query = query.where(User.is_active.is_(False))
    records = db.session.scalars(query.limit(100)).all()
    return jsonify(
        users=[
            {
                "id": user.id,
                "name": user.full_name,
                "email": user.email,
                "role": user.role,
                "active": user.is_active,
                "deleted": user.deleted_at is not None,
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
    _admin_audit("USER_CREATED", user)
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
    _admin_audit("USER_UNLOCK" if user.is_active else "USER_LOCK", user)
    db.session.commit()
    return jsonify(success=True, active=user.is_active)


@bp.patch("/api/admin/users/<int:user_id>/role")
@require_roles("ADMIN")
def update_user_role(user_id):
    user = db.session.get(User, user_id)
    payload = request.get_json(silent=True) or {}
    role = str(payload.get("role", "")).upper()
    if user is None:
        abort(404)
    if role not in {"ADMIN", "DOCTOR", "USER"}:
        abort(400, description="Vai trò không hợp lệ.")
    if user.id == current_user.id and role != "ADMIN":
        return jsonify(success=False, message="Không thể hạ quyền tài khoản đang đăng nhập."), 400
    user.role = role
    _admin_audit("USER_ROLE_CHANGED", user)
    db.session.commit()
    return jsonify(success=True, role=user.role)


@bp.delete("/api/admin/users/<int:user_id>")
@require_roles("ADMIN")
def soft_delete_user(user_id):
    user = db.session.get(User, user_id)
    if user is None or user.deleted_at is not None:
        abort(404)
    if user.id == current_user.id:
        return jsonify(success=False, message="Không thể xóa tài khoản đang đăng nhập."), 400
    user.deleted_at = utcnow()
    user.is_active = False
    _admin_audit("USER_SOFT_DELETED", user)
    db.session.commit()
    return jsonify(success=True)


@bp.get("/api/admin/doctor-applications")
@require_roles("ADMIN")
def doctor_applications():
    applications = db.session.scalars(
        db.select(DoctorApplication)
        .where(DoctorApplication.status == "PENDING")
        .order_by(DoctorApplication.created_at.asc())
    ).all()
    return jsonify(applications=[{
        "id": item.id,
        "user_id": item.user_id,
        "name": item.user.full_name,
        "email": item.user.email,
        "certificate_path": item.certificate_path,
        "created_at": item.created_at.isoformat(),
    } for item in applications])


@bp.patch("/api/admin/doctor-applications/<int:application_id>")
@require_roles("ADMIN")
def review_doctor_application(application_id):
    application = db.session.get(DoctorApplication, application_id)
    payload = request.get_json(silent=True) or {}
    decision = str(payload.get("decision", "")).upper()
    if application is None or application.status != "PENDING":
        abort(404)
    if decision not in {"APPROVE", "REJECT"}:
        abort(400, description="Quyết định duyệt không hợp lệ.")
    if decision == "APPROVE" and not application.certificate_path:
        return jsonify(success=False, message="C?n t?i ch?ng ch? tr??c khi ph? duy?t."), 400
    application.status = "APPROVED" if decision == "APPROVE" else "REJECTED"
    application.reviewed_by = current_user.id
    application.reviewed_at = utcnow()
    application.user.is_active = decision == "APPROVE"
    _admin_audit("DOCTOR_APPLICATION_" + decision, application.user)
    db.session.commit()
    return jsonify(success=True, status=application.status)


@bp.get("/api/admin/audit-logs")
@require_roles("ADMIN")
def audit_logs():
    try:
        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, max(1, int(request.args.get("per_page", 25))))
    except ValueError:
        abort(400, description="Trang audit log không hợp lệ.")
    query = db.select(AuditLog)
    actor_email = request.args.get("actor", "").strip()
    if actor_email:
        query = query.where(AuditLog.email.ilike(f"%{actor_email}%"))
    search = request.args.get("search", "").strip()
    if search:
        query = query.where(or_(AuditLog.email.ilike(f"%{search}%"), AuditLog.event.ilike(f"%{search}%")))
    event = request.args.get("event", "").strip().upper()
    if event:
        query = query.where(AuditLog.event == event)
    start = request.args.get("start", "").strip()
    end = request.args.get("end", "").strip()
    try:
        if start:
            query = query.where(AuditLog.created_at >= datetime.fromisoformat(start))
        if end:
            query = query.where(AuditLog.created_at < datetime.fromisoformat(end) + timedelta(days=1))
    except ValueError:
        abort(400, description="Khoảng ngày audit log không hợp lệ.")
    total = db.session.scalar(db.select(func.count()).select_from(query.subquery())) or 0
    records = db.session.scalars(query.order_by(AuditLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page)).all()
    return jsonify(logs=[{
        "id": item.id, "email": item.email, "event": item.event,
        "ip_address": item.ip_address, "user_agent": item.user_agent,
        "success": item.success, "created_at": item.created_at.isoformat(),
    } for item in records], page=page, per_page=per_page, total=total,
        pages=max(1, (total + per_page - 1) // per_page))


@bp.get("/api/admin/audit-logs.csv")
@require_roles("ADMIN")
def export_audit_logs():
    query = db.select(AuditLog)
    start = request.args.get("start", "").strip()
    end = request.args.get("end", "").strip()
    try:
        if start:
            query = query.where(AuditLog.created_at >= datetime.fromisoformat(start))
        if end:
            query = query.where(AuditLog.created_at < datetime.fromisoformat(end) + timedelta(days=1))
    except ValueError:
        abort(400, description="Kho?ng ng?y audit log kh?ng h?p l?.")
    records = db.session.scalars(query.order_by(AuditLog.created_at.desc()).limit(10000)).all()
    def csv_cell(value):
        return '"' + str(value or "").replace('"', '""') + '"'
    rows = ["created_at,email,event,ip_address,success"]
    rows.extend(",".join(csv_cell(value) for value in (
        item.created_at.isoformat(), item.email, item.event, item.ip_address,
        "true" if item.success else "false",
    )) for item in records)
    from flask import Response
    return Response("\ufeff" + "\r\n".join(rows), mimetype="text/csv",
                    headers={"Content-Disposition": "attachment; filename=audit-log.csv"})


@bp.get("/api/admin/security-settings")
@require_roles("ADMIN")
def get_security_settings():
    setting = db.session.get(SecuritySetting, 1) or SecuritySetting(id=1)
    if setting.id is None:
        db.session.add(setting)
        db.session.commit()
    return jsonify(
        session_timeout_minutes=setting.session_timeout_minutes,
        password_min_length=setting.password_min_length,
        require_admin_2fa=setting.require_admin_2fa,
    )


@bp.put("/api/admin/security-settings")
@require_roles("ADMIN")
def update_security_settings():
    payload = request.get_json(silent=True) or {}
    setting = db.session.get(SecuritySetting, 1)
    if setting is None:
        setting = SecuritySetting(id=1)
        db.session.add(setting)
    try:
        timeout = int(payload.get("session_timeout_minutes", setting.session_timeout_minutes))
        minimum = int(payload.get("password_min_length", setting.password_min_length))
    except (TypeError, ValueError):
        abort(400, description="Cấu hình bảo mật không hợp lệ.")
    if timeout < 5 or timeout > 1440 or minimum < 8 or minimum > 128:
        abort(400, description="Cấu hình bảo mật nằm ngoài giới hạn cho phép.")
    setting.session_timeout_minutes = timeout
    setting.password_min_length = minimum
    setting.require_admin_2fa = bool(payload.get("require_admin_2fa", setting.require_admin_2fa))
    if setting.require_admin_2fa:
        active_admins = db.session.scalars(db.select(User).where(User.role == "ADMIN", User.deleted_at.is_(None), User.is_active.is_(True))).all()
        for admin_user in active_admins:
            admin_user.two_factor_enabled = True
    _admin_audit("SECURITY_SETTINGS_UPDATED", current_user)
    db.session.commit()
    return jsonify(success=True)
