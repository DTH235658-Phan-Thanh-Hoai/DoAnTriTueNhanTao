from flask import Blueprint, abort, current_app, jsonify, request, send_file
from flask_login import current_user

from ..extensions import db
from ..models import SiteSetting
from ..services.access import require_roles
from ..services.site_settings_service import SiteSettingsService, SiteSettingsValidationError


bp = Blueprint('site_settings', __name__)


def _payload():
    payload = request.get_json(silent=True)
    return payload if isinstance(payload, dict) else None


def _validation_response(error):
    return jsonify(success=False, message=str(error)), 400


@bp.get('/api/site-settings')
def public_site_settings():
    return jsonify(SiteSettingsService(current_app).serialize())


@bp.put('/api/admin/site-settings')
@require_roles('ADMIN')
def admin_update_site_settings():
    payload = _payload()
    if payload is None:
        return _validation_response('Payload site settings không hợp lệ.')

    # The singleton identity is server-owned; a client-provided id is ignored.
    payload = dict(payload)
    payload.pop('id', None)
    service = SiteSettingsService(current_app)
    try:
        data = service.validate_payload(payload)
    except SiteSettingsValidationError as error:
        return _validation_response(error)

    setting = service.get_record()
    if setting is None:
        setting = SiteSetting(id=1, **service.FALLBACKS)
        db.session.add(setting)
    for name, value in data.items():
        setattr(setting, name, value)
    setting.updated_by = current_user.id
    db.session.commit()
    return jsonify(service.serialize(setting, include_admin=True))


@bp.get('/api/site-settings/assets/<asset_kind>')
def site_settings_asset(asset_kind):
    field = {'logo': 'logo_path', 'favicon': 'favicon_path'}.get(asset_kind)
    if field is None:
        abort(404)
    service = SiteSettingsService(current_app)
    resolved = service.resolve()
    try:
        path = service.resolve_asset_path(resolved[field])
    except SiteSettingsValidationError:
        abort(404)
    return send_file(path, conditional=True, max_age=300)
