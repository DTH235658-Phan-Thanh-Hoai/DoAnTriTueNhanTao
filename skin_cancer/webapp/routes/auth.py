from flask import Blueprint, current_app, request, jsonify, session, abort
from flask_login import current_user, login_user, logout_user
from flask_wtf.csrf import generate_csrf
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
    return {'id':user.id, 'full_name':user.full_name, 'role':user.role}


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
    return jsonify(success=True, user=public_user(user))


@bp.post('/logout')
@require_roles()
def logout():
    logout_user()
    session.clear()
    return jsonify(success=True)


@bp.get('/me')
@require_roles()
def me():
    return jsonify(public_user(current_user))
