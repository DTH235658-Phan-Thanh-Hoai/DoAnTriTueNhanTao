"""Guard permanent account deletion without removing medical or review history."""

from sqlalchemy import select

from ..extensions import db
from ..models import DoctorApplication, User


def deletion_blocker(user: User) -> str | None:
    """Return a reason if removing this user would damage retained records."""
    application = db.session.scalar(
        select(DoctorApplication).where(DoctorApplication.user_id == user.id)
    )
    if application is not None and application.status != "PENDING":
        return "Tài khoản có lịch sử xét duyệt bác sĩ cần lưu giữ."

    # Models use RESTRICT for medical records, uploads, reports and site content.
    # Check *every* such FK, so future models cannot silently lose records.
    for table in db.metadata.tables.values():
        if table.name == "users":
            continue
        for column in table.columns:
            for foreign_key in column.foreign_keys:
                if foreign_key.column.table.name != "users":
                    continue
                if (foreign_key.ondelete or "RESTRICT").upper() in {"CASCADE", "SET NULL"}:
                    continue
                if db.session.execute(select(column).where(column == user.id).limit(1)).first():
                    return "Tài khoản có ca khám hoặc dữ liệu liên quan cần lưu giữ."
    return None


def delete_unrelated_user(user: User) -> str | None:
    """Delete the user in the active transaction, or return a blocking reason.

    Existing approved/rejected applications are always protected; a pending
    application has no review history and may be discarded with the account.
    """
    blocker = deletion_blocker(user)
    if blocker:
        return blocker
    application = db.session.scalar(
        select(DoctorApplication).where(DoctorApplication.user_id == user.id)
    )
    if application is not None:
        db.session.delete(application)
        db.session.flush()
    db.session.delete(user)
    db.session.flush()
    return None