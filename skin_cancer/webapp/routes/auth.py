from flask import Blueprint, current_app, request, jsonify, session, abort
from flask_login import current_user, login_user, logout_user
from flask_wtf.csrf import generate_csrf
from sqlalchemy.exc import IntegrityError
from ..extensions import db, limiter, login_manager
from ..models import User
from ..services.access import require_roles

bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@login_manager.user_loader
def load_user(user_id):
    try:
        user = db.session.get(User, int(user_id))
    except (TypeError, ValueError):
        return None
    return user if user and user.is_active else None


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify(success=False, message='Cần đăng nhập'), 401


def public_user(user):
    return {
        'id': user.id,
        'full_name': user.full_name,
        'email': user.email,
        'role': user.role,
        'phone': user.phone,
        'gender': user.gender,
        'date_of_birth': user.date_of_birth.isoformat() if user.date_of_birth else None,
    }


def role_redirect(role):
    return {
        'ADMIN': '/admin',
        'DOCTOR': '/doctor',
        'USER': '/patient',
    }.get(role, '/')


def login_response(user):
    return jsonify(
        success=True,
        role=user.role,
        redirect_url=role_redirect(user.role),
        user=public_user(user),
    )


@bp.get('/csrf')
def get_csrf():
    return jsonify(csrf_token=generate_csrf())


@bp.post('/login')
@limiter.limit(
    lambda: current_app.config["RATELIMIT_LOGIN"]
)
def login():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        abort(400)
    email, password = payload.get('email'), payload.get('password')
    if not isinstance(email,str) or not isinstance(password,str) or len(email)>254 or len(password)>256:
        abort(400)
    user = db.session.scalar(db.select(User).where(User.email == email.strip().lower()))
    if not user or not user.is_active or not user.check_password(password):
        return jsonify(success=False, message='Email hoặc mật khẩu không hợp lệ'), 401
    session.clear()
    login_user(user, remember=False, fresh=True)
    session['role'] = user.role
    return login_response(user)


@bp.post('/admin/login')
@limiter.limit(
    lambda: current_app.config["RATELIMIT_LOGIN"]
)
def admin_login():
    """Authenticate an administrator for the Admin Portal."""
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        abort(400)

    email = payload.get('email', payload.get('username'))
    password = payload.get('password')
    if (
        not isinstance(email, str)
        or not isinstance(password, str)
        or not 1 <= len(email.strip()) <= 254
        or not 1 <= len(password) <= 256
    ):
        return jsonify(success=False, message='Sai tài khoản hoặc mật khẩu'), 401

    user = db.session.scalar(
        db.select(User).where(User.email == email.strip().lower())
    )
    if user is None or not user.is_active or not user.check_password(password):
        return jsonify(success=False, message='Sai tài khoản hoặc mật khẩu'), 401
    if user.role != 'ADMIN':
        return jsonify(
            success=False,
            message='Tài khoản không có quyền quản trị',
        ), 403

    session.clear()
    login_user(user, remember=False, fresh=True)
    session['role'] = user.role
    return login_response(user)


@bp.post('/logout')
@require_roles()
def logout():
    logout_user()
    session.clear()
    return jsonify(success=True, redirect_url='/')


@bp.post('/admin/logout')
@require_roles('ADMIN')
def admin_logout():
    """End the administrator session and remove all session data."""
    logout_user()
    session.clear()
    return jsonify(success=True, redirect_url='/')


@bp.get('/admin/me')
@require_roles('ADMIN')
def admin_me():
    return jsonify(public_user(current_user))


@bp.get('/me')
@require_roles()
def me():
    return jsonify(public_user(current_user))


@bp.put('/profile')
@require_roles()
def update_profile():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        abort(400)
    
    full_name = payload.get('full_name')
    if full_name is not None:
        if not isinstance(full_name, str) or not (2 <= len(full_name.strip()) <= 150):
            return jsonify(success=False, message='Họ tên không hợp lệ (2-150 ký tự).'), 400
        current_user.full_name = full_name.strip()
    
    phone = payload.get('phone')
    if phone is not None:
        phone_str = str(phone).strip() if phone else None
        if phone_str and len(phone_str) > 30:
            return jsonify(success=False, message='Số điện thoại không hợp lệ.'), 400
        current_user.phone = phone_str
        
    gender = payload.get('gender')
    if gender is not None:
        gender_str = str(gender).strip() if gender else None
        if gender_str and len(gender_str) > 30:
            return jsonify(success=False, message='Giới tính không hợp lệ.'), 400
        current_user.gender = gender_str
        
    dob = payload.get('date_of_birth')
    if dob is not None:
        if dob:
            from datetime import date
            try:
                current_user.date_of_birth = date.fromisoformat(str(dob).strip())
            except (ValueError, TypeError):
                return jsonify(success=False, message='Ngày sinh không đúng định dạng YYYY-MM-DD.'), 400
        else:
            current_user.date_of_birth = None
            
    db.session.commit()
    return jsonify(success=True, user=public_user(current_user))


@bp.post('/register')
@limiter.limit(
    lambda: current_app.config["RATELIMIT_LOGIN"]
)
def register():
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        abort(400)

    full_name = payload.get('full_name')
    email = payload.get('email')
    password = payload.get('password')
    role = payload.get('role', 'USER')

    if not isinstance(full_name, str) or not (2 <= len(full_name.strip()) <= 150):
        return jsonify(
            success=False,
            message='Họ tên không hợp lệ (2-150 ký tự).',
        ), 400

    if not isinstance(email, str) or not (3 <= len(email.strip()) <= 254) or '@' not in email:
        return jsonify(success=False, message='Email không hợp lệ.'), 400

    # User.set_password yêu cầu 12-256 ký tự
    if not isinstance(password, str) or not (12 <= len(password) <= 256):
        return jsonify(
            success=False,
            message='Mật khẩu phải có 12–256 ký tự',
        ), 400

    # Không cho phép tự đăng ký quyền ADMIN
    if role not in ('DOCTOR', 'USER'):
        role = 'USER'

    existing = db.session.scalar(
        db.select(User).where(User.email == email.strip().lower())
    )
    if existing:
        return jsonify(success=False, message='Email đã được sử dụng.'), 409

    try:
        user = User(email=email.strip(), full_name=full_name.strip(), role=role)
        user.set_password(password)
    except ValueError as error:
        return jsonify(success=False, message=str(error)), 400

    db.session.add(user)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(success=False, message='Email đã được sử dụng.'), 409

    return jsonify(success=True, user=public_user(user)), 201
