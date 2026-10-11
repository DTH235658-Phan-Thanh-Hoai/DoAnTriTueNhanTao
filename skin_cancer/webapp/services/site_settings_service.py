"""Fallbacks, validation and safe asset resolution for singleton site settings."""
from pathlib import Path, PureWindowsPath
from urllib.parse import urlparse

from ..extensions import db
from ..models import SiteSetting


class SiteSettingsValidationError(ValueError):
    """Raised when site settings contain an invalid public value."""


class SiteSettingsService:
    FIELDS = (
        'site_name', 'logo_path', 'favicon_path', 'footer_title',
        'footer_description', 'phone', 'email', 'address',
        'facebook_url', 'copyright_text',
    )
    ASSET_FIELDS = {'logo_path', 'favicon_path'}
    ASSET_SUFFIXES = {'.gif', '.ico', '.jpeg', '.jpg', '.png', '.webp'}
    FALLBACKS = {
        'site_name': 'DermaScan AI',
        'logo_path': 'skin_cancer/webapp/assets/dermascan_logo.png',
        'favicon_path': 'skin_cancer/webapp/assets/dermascan_logo.png',
        'footer_title': 'DermaScan AI',
        'footer_description': 'Phân loại tổn thương da bằng EfficientNet',
        'phone': '',
        'email': '',
        'address': '',
        'facebook_url': '',
        'copyright_text': '© 2026 DermaScan AI',
    }
    LIMITS = {
        'site_name': 150,
        'logo_path': 500,
        'favicon_path': 500,
        'footer_title': 255,
        'footer_description': 10000,
        'phone': 30,
        'email': 254,
        'address': 500,
        'facebook_url': 500,
        'copyright_text': 255,
    }

    def __init__(self, app):
        self.app = app

    def get_record(self):
        return db.session.get(SiteSetting, 1)

    def resolve(self):
        setting = self.get_record()
        values = {
            'id': setting.id if setting else None,
            **self._effective_values(setting),
        }
        values['logo_url'] = '/api/site-settings/assets/logo'
        values['favicon_url'] = '/api/site-settings/assets/favicon'
        return values

    def serialize(self, setting=None, include_admin=False):
        if setting is None:
            setting = self.get_record()
        result = {
            'id': setting.id if setting else None,
            **self._effective_values(setting),
            'logo_url': '/api/site-settings/assets/logo',
            'favicon_url': '/api/site-settings/assets/favicon',
        }
        if include_admin:
            result.update({
                'updated_by': setting.updated_by if setting else None,
                'updated_at': setting.updated_at.isoformat() if setting and setting.updated_at else None,
            })
        return result

    def validate_payload(self, payload):
        if not isinstance(payload, dict):
            raise SiteSettingsValidationError('Payload site settings không hợp lệ.')
        unknown = set(payload) - set(self.FIELDS)
        if unknown:
            raise SiteSettingsValidationError('Payload chứa field không được phép.')

        result = {}
        for name, value in payload.items():
            if name in self.ASSET_FIELDS:
                result[name] = self._asset_value(value, name)
            elif name == 'facebook_url':
                result[name] = self._facebook_url(value)
            elif name == 'email':
                result[name] = self._email(value)
            else:
                result[name] = self._string(value, name, self.LIMITS[name], optional=name != 'site_name')

        if 'site_name' in result and result['site_name'] is None:
            raise SiteSettingsValidationError('site_name là bắt buộc.')
        return result

    def resolve_asset_path(self, path_value):
        if not isinstance(path_value, str) or not path_value.strip():
            raise SiteSettingsValidationError('Đường dẫn asset không hợp lệ.')
        raw_value = path_value.strip()
        raw = Path(raw_value)
        windows = PureWindowsPath(raw_value)
        if raw.is_absolute() or windows.is_absolute() or windows.drive or '..' in raw.parts or '..' in windows.parts:
            raise SiteSettingsValidationError('Đường dẫn asset không an toàn.')
        if raw.suffix.lower() not in self.ASSET_SUFFIXES:
            raise SiteSettingsValidationError('Định dạng asset không được hỗ trợ.')

        roots = [Path(self.app.config['PROJECT_ROOT']), Path(self.app.instance_path)]
        for root_value in roots:
            root = root_value.resolve()
            candidate = (root / raw).resolve()
            if candidate.is_relative_to(root) and candidate.is_file():
                return candidate
        raise SiteSettingsValidationError('File asset không tồn tại hoặc không hợp lệ.')

    def _effective_values(self, setting):
        values = {}
        for name in self.FIELDS:
            value = getattr(setting, name, None) if setting else None
            fallback = self.FALLBACKS[name]
            if value in (None, ''):
                value = fallback
            if name in self.ASSET_FIELDS:
                try:
                    self.resolve_asset_path(value)
                except SiteSettingsValidationError:
                    value = fallback
            values[name] = value
        return values

    def _asset_value(self, value, name):
        value = self._string(value, name, self.LIMITS[name], optional=True)
        if value is None:
            return None
        self._validate_relative_asset(value)
        return value

    @staticmethod
    def _validate_relative_asset(value):
        raw = Path(value)
        windows = PureWindowsPath(value)
        if (raw.is_absolute() or windows.is_absolute() or windows.drive
                or '..' in raw.parts or '..' in windows.parts):
            raise SiteSettingsValidationError('Đường dẫn asset không an toàn.')
        if urlparse(value).scheme:
            raise SiteSettingsValidationError('Đường dẫn asset không được là URL.')

    @staticmethod
    def _email(value):
        if value in (None, ''):
            return None
        if not isinstance(value, str) or len(value.strip()) > 254:
            raise SiteSettingsValidationError('email không hợp lệ.')
        value = value.strip()
        local, separator, domain = value.rpartition('@')
        if not separator or not local or not domain or any(char.isspace() for char in value) or '.' not in domain:
            raise SiteSettingsValidationError('email không hợp lệ.')
        return value

    @staticmethod
    def _facebook_url(value):
        if value in (None, ''):
            return None
        if not isinstance(value, str) or len(value.strip()) > 500:
            raise SiteSettingsValidationError('facebook_url không hợp lệ.')
        value = value.strip()
        parsed = urlparse(value)
        if parsed.scheme.lower() not in {'http', 'https'} or not parsed.netloc:
            raise SiteSettingsValidationError('facebook_url phải là URL http(s).')
        return value

    @staticmethod
    def _string(value, name, limit, optional=False):
        if value in (None, '') and optional:
            return None
        if not isinstance(value, str):
            raise SiteSettingsValidationError(f'{name} phải là chuỗi.')
        value = value.strip()
        if not value and not optional:
            raise SiteSettingsValidationError(f'{name} là bắt buộc.')
        if len(value) > limit:
            raise SiteSettingsValidationError(f'{name} vượt quá giới hạn ký tự.')
        return value
