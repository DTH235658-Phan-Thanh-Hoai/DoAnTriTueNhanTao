from datetime import timedelta
from pathlib import Path

import pytest
from flask_login import login_user as flask_login_user
from sqlalchemy.engine import make_url
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from skin_cancer.webapp import database_app
from skin_cancer.webapp.extensions import db
from skin_cancer.webapp.models import SecuritySetting, User
from skin_cancer.webapp.models.base import utcnow
from skin_cancer.webapp.routes import auth as auth_routes


OLD_PASSWORD = "Synthetic-Old-Password-1"
NEW_PASSWORD = "Synthetic-New-Password-2"
RESET_TOKEN = "synthetic-reset-token-only"
TEST_OTP = "000111"


@pytest.fixture
def app(tmp_path, monkeypatch):
    instance_dir = tmp_path / "instance"
    monkeypatch.setattr(database_app, "INSTANCE_DIR", instance_dir)
    app = database_app.create_app({
        "TESTING": True,
        "PROPAGATE_EXCEPTIONS": False,
        "SECRET_KEY": "synthetic-test-secret-never-for-production",
        "SQLALCHEMY_DATABASE_URI": f"sqlite:///{(tmp_path / 'session-test.sqlite').as_posix()}",
        "WTF_CSRF_ENABLED": True,
        "RATELIMIT_ENABLED": False,
        "RATELIMIT_STORAGE_URI": "memory://",
        "MAIL_SERVER": "",
        "MAIL_USERNAME": "",
        "MAIL_PASSWORD": "",
        "MAIL_DEFAULT_SENDER": "",
        "REPORT_FOLDER": str(tmp_path / "reports"),
        "UPLOAD_FOLDER": str(tmp_path / "uploads"),
        "MEASUREMENT_FOLDER": str(tmp_path / "measurements"),
    })
    test_root = tmp_path.resolve()
    assert Path(app.instance_path).resolve().is_relative_to(test_root)
    assert Path(make_url(app.config["SQLALCHEMY_DATABASE_URI"]).database).resolve().is_relative_to(test_root)
    for setting in ("REPORT_FOLDER", "UPLOAD_FOLDER", "MEASUREMENT_FOLDER"):
        assert Path(app.config[setting]).resolve().is_relative_to(test_root)

    with app.app_context():
        db.create_all()
        db.session.add(SecuritySetting(
            id=1,
            password_min_length=12,
            require_admin_2fa=False,
        ))
        for role in ("USER", "DOCTOR", "ADMIN"):
            user = User(
                full_name=f"Tài khoản tổng hợp {role}",
                email=f"{role.lower()}@example.test",
                role=role,
                email_verified=True,
                two_factor_enabled=False,
            )
            user.set_password(OLD_PASSWORD)
            db.session.add(user)
        db.session.commit()

    yield app

    with app.app_context():
        db.session.remove()
        db.drop_all()


def csrf_post(client, path, payload):
    token = client.get("/api/auth/csrf").get_json()["csrf_token"]
    return client.post(path, json=payload, headers={"X-CSRFToken": token})


def login(client, role="USER", password=OLD_PASSWORD):
    return csrf_post(client, "/api/auth/login", {
        "email": f"{role.lower()}@example.test",
        "password": password,
    })


def login_with_remember(client, monkeypatch, role="USER"):
    def remember_login(user, remember=False, fresh=False):
        return flask_login_user(user, remember=True, fresh=fresh)

    with monkeypatch.context() as patch:
        patch.setattr(auth_routes, "login_user", remember_login)
        return login(client, role)


def remember_cookie_name(app):
    return app.config.get("REMEMBER_COOKIE_NAME", "remember_token")


def account_id(app, role="USER"):
    with app.app_context():
        return db.session.scalar(
            db.select(User.id).where(User.email == f"{role.lower()}@example.test")
        )


def set_reset_token(app, raw_token=RESET_TOKEN, *, expired=False):
    with app.app_context():
        user = db.session.scalar(
            db.select(User).where(User.email == "user@example.test")
        )
        user.password_reset_token_hash = auth_routes._hash_token(raw_token)
        user.password_reset_expires_at = utcnow() + timedelta(minutes=-1 if expired else 5)
        db.session.commit()


def set_pending_2fa(app, enabled=True, role="USER"):
    with app.app_context():
        user = db.session.scalar(
            db.select(User).where(User.email == f"{role.lower()}@example.test")
        )
        user.two_factor_enabled = enabled
        db.session.commit()


def install_synthetic_otp(monkeypatch):
    def issue_otp(user):
        user.two_factor_code_hash = auth_routes._hash_token(TEST_OTP)
        user.two_factor_code_expires_at = utcnow() + timedelta(minutes=5)
        return "Mã xác thực tổng hợp đã được tạo."

    monkeypatch.setattr(auth_routes, "_issue_login_otp", issue_otp)


def reset_password(client, token=RESET_TOKEN, password=NEW_PASSWORD):
    return csrf_post(client, "/api/auth/reset-password", {
        "token": token,
        "new_password": password,
    })


def test_tc_014_01_change_password_keeps_current_client_and_revokes_other(app):
    client_a = app.test_client()
    client_b = app.test_client()
    assert login(client_a).status_code == 200
    assert login(client_b).status_code == 200

    response = csrf_post(client_a, "/api/auth/change-password", {
        "current_password": OLD_PASSWORD,
        "new_password": NEW_PASSWORD,
    })

    assert response.status_code == 200
    assert client_a.get("/api/auth/me").status_code == 200
    assert client_b.get("/api/auth/me").status_code == 401


def test_tc_014_02_old_remember_cookie_cannot_restore_after_change(app, monkeypatch):
    client_a = app.test_client()
    client_b = app.test_client()
    assert login(client_a).status_code == 200
    assert login_with_remember(client_b, monkeypatch).status_code == 200
    assert client_b.get_cookie(remember_cookie_name(app))
    client_b.delete_cookie(app.config["SESSION_COOKIE_NAME"])
    assert client_b.get("/api/auth/me").status_code == 200
    client_b.delete_cookie(app.config["SESSION_COOKIE_NAME"])

    assert csrf_post(client_a, "/api/auth/change-password", {
        "current_password": OLD_PASSWORD,
        "new_password": NEW_PASSWORD,
    }).status_code == 200

    assert client_b.get("/api/auth/me").status_code == 401


def test_tc_014_03_wrong_current_password_changes_nothing(app):
    client_a = app.test_client()
    client_b = app.test_client()
    login(client_a)
    login(client_b)

    response = csrf_post(client_a, "/api/auth/change-password", {
        "current_password": "Synthetic-Wrong-Password",
        "new_password": NEW_PASSWORD,
    })

    assert response.status_code == 400
    assert client_a.get("/api/auth/me").status_code == 200
    assert client_b.get("/api/auth/me").status_code == 200
    with app.app_context():
        user = db.session.get(User, account_id(app))
        assert user.check_password(OLD_PASSWORD)


def test_tc_014_04_failed_password_validation_and_commit_do_not_revoke_sessions(app, monkeypatch):
    client_a = app.test_client()
    client_b = app.test_client()
    login(client_a)
    login(client_b)

    invalid = csrf_post(client_a, "/api/auth/change-password", {
        "current_password": OLD_PASSWORD,
        "new_password": "short",
    })
    assert invalid.status_code == 400
    assert client_b.get("/api/auth/me").status_code == 200

    original_commit = Session.commit

    def fail_test_commit(session):
        raise SQLAlchemyError("synthetic transaction failure")

    with monkeypatch.context() as patch:
        patch.setattr(Session, "commit", fail_test_commit)
        failed = csrf_post(client_a, "/api/auth/change-password", {
            "current_password": OLD_PASSWORD,
            "new_password": NEW_PASSWORD,
        })

    assert failed.status_code == 500
    assert client_a.get("/api/auth/me").status_code == 200
    assert client_b.get("/api/auth/me").status_code == 200
    with app.app_context():
        user = db.session.get(User, account_id(app))
        assert user.check_password(OLD_PASSWORD)
    assert Session.commit is original_commit


def test_tc_014_05_reset_revokes_all_sessions_including_requester(app):
    client_a = app.test_client()
    client_b = app.test_client()
    login(client_a)
    login(client_b)
    set_reset_token(app)

    response = reset_password(client_a)

    assert response.status_code == 200
    assert client_a.get("/api/auth/me").status_code == 401
    assert client_b.get("/api/auth/me").status_code == 401
    assert login(app.test_client(), password=NEW_PASSWORD).status_code == 200


def test_tc_014_06_old_remember_cookie_cannot_restore_after_reset(app, monkeypatch):
    client = app.test_client()
    assert login_with_remember(client, monkeypatch).status_code == 200
    assert client.get_cookie(remember_cookie_name(app))
    client.delete_cookie(app.config["SESSION_COOKIE_NAME"])
    assert client.get("/api/auth/me").status_code == 200
    client.delete_cookie(app.config["SESSION_COOKIE_NAME"])
    set_reset_token(app)

    assert reset_password(app.test_client()).status_code == 200

    assert client.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize("expired", [False, True], ids=["invalid-token", "expired-token"])
def test_tc_014_07_invalid_or_expired_reset_keeps_hash_and_sessions(app, expired):
    client_a = app.test_client()
    client_b = app.test_client()
    login(client_a)
    login(client_b)
    set_reset_token(app, expired=expired)

    response = reset_password(client_a, token="wrong-synthetic-token" if not expired else RESET_TOKEN)

    assert response.status_code == 400
    assert client_a.get("/api/auth/me").status_code == 200
    assert client_b.get("/api/auth/me").status_code == 200
    with app.app_context():
        user = db.session.get(User, account_id(app))
        assert user.check_password(OLD_PASSWORD)


@pytest.mark.parametrize("role", ["USER", "DOCTOR", "ADMIN"])
def test_tc_014_08_09_10_change_password_preserves_valid_role_session_and_revokes_peer(app, role):
    client_a = app.test_client()
    client_b = app.test_client()
    assert login(client_a, role).status_code == 200
    assert login(client_b, role).status_code == 200

    response = csrf_post(client_a, "/api/auth/change-password", {
        "current_password": OLD_PASSWORD,
        "new_password": NEW_PASSWORD,
    })

    assert response.status_code == 200
    assert client_a.get("/api/auth/me").get_json()["role"] == role
    assert client_b.get("/api/auth/me").status_code == 401
    if role == "ADMIN":
        assert client_a.get("/api/auth/admin/me").status_code == 200
    else:
        assert client_a.get("/api/auth/admin/me").status_code == 403


@pytest.mark.parametrize("role", ["USER", "DOCTOR", "ADMIN"])
def test_tc_014_09_login_after_password_change_still_requires_and_completes_otp(app, monkeypatch, role):
    client = app.test_client()
    assert login(client, role).status_code == 200
    set_pending_2fa(app, role=role)
    assert csrf_post(client, "/api/auth/change-password", {
        "current_password": OLD_PASSWORD,
        "new_password": NEW_PASSWORD,
    }).status_code == 200
    install_synthetic_otp(monkeypatch)

    new_client = app.test_client()
    new_login = login(new_client, role, NEW_PASSWORD)

    assert new_login.status_code == 200
    assert new_login.get_json()["requires_2fa"] is True
    assert csrf_post(new_client, "/api/auth/verify-2fa", {"code": TEST_OTP}).status_code == 200
    assert new_client.get("/api/auth/me").get_json()["role"] == role


def test_tc_014_11_pending_2fa_before_reset_cannot_resend_or_verify(app, monkeypatch):
    install_synthetic_otp(monkeypatch)
    set_pending_2fa(app)
    pending_client = app.test_client()
    login_response = login(pending_client)
    assert login_response.status_code == 200
    assert login_response.get_json()["requires_2fa"] is True
    set_reset_token(app)

    assert reset_password(app.test_client()).status_code == 200
    assert csrf_post(pending_client, "/api/auth/resend-2fa", {}).status_code == 401
    assert csrf_post(pending_client, "/api/auth/verify-2fa", {"code": TEST_OTP}).status_code == 401


@pytest.mark.parametrize("inactive,deleted", [(True, False), (False, True)])
def test_tc_014_12_inactive_or_deleted_user_fails_loader(app, inactive, deleted):
    client = app.test_client()
    login(client)
    with app.app_context():
        user = db.session.get(User, account_id(app))
        user.is_active = not inactive
        user.deleted_at = utcnow() if deleted else None
        db.session.commit()

    assert client.get("/api/auth/me").status_code == 401


def test_tc_014_13_legacy_id_only_cookie_is_rejected(app):
    client = app.test_client()
    user_id = account_id(app)
    with client.session_transaction() as session:
        session["_user_id"] = str(user_id)
        session["_fresh"] = True

    assert client.get("/api/auth/me").status_code == 401


def test_tc_014_14_modified_hmac_identifier_is_rejected(app):
    client = app.test_client()
    login(client)
    with client.session_transaction() as session:
        signed_id = session["_user_id"]
        session["_user_id"] = signed_id[:-1] + ("0" if signed_id[-1] != "0" else "1")

    assert client.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize("bad_id", [
    "bad-id",
    "v1.not-a-number.abc",
    "v1.1.short",
    "v1.9223372036854775808." + ("0" * 64),
])
def test_tc_014_15_malformed_session_id_returns_unauthorized_not_500(app, bad_id):
    client = app.test_client()
    with client.session_transaction() as session:
        session["_user_id"] = bad_id

    assert client.get("/api/auth/me").status_code == 401


def test_tc_014_16_cookie_contains_no_password_hash_or_hmac_secret(app):
    client = app.test_client()
    assert login(client).status_code == 200
    cookie = client.get_cookie(app.config["SESSION_COOKIE_NAME"])
    payload = app.session_interface.get_signing_serializer(app).loads(cookie.value)
    with app.app_context():
        user = db.session.get(User, account_id(app))

    if user.password_hash in repr(payload):
        pytest.fail("Cookie chứa dữ liệu xác thực không được phép.")
    if app.config["SECRET_KEY"] in repr(payload):
        pytest.fail("Cookie chứa dữ liệu xác thực không được phép.")
    assert payload["_user_id"].startswith(f"v1.{user.id}.")


def test_tc_014_17_csrf_and_rbac_still_apply(app):
    client = app.test_client()
    login(client, "USER")

    no_csrf = client.post("/api/auth/change-password", json={
        "current_password": OLD_PASSWORD,
        "new_password": NEW_PASSWORD,
    })

    assert no_csrf.status_code == 400
    assert client.get("/api/auth/me").status_code == 200
    assert client.get("/api/auth/admin/me").status_code == 403
    with app.app_context():
        user = db.session.get(User, account_id(app))
        assert user.check_password(OLD_PASSWORD)


def test_tc_014_18_flask_login_callers_use_validated_user_loader(app):
    client = app.test_client()
    assert login(client).status_code == 200
    with app.app_context():
        user = db.session.get(User, account_id(app))
        signed_id = user.get_id()
        assert auth_routes.load_user(signed_id).id == user.id
        assert auth_routes.load_user(str(user.id)) is None
    assert client.get("/api/auth/me").status_code == 200
