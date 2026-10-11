"""Explicit, transactional development seed.

Does not run inference, create PDFs, or delete existing records.
"""

import os

import click
from flask import current_app

from .extensions import db
from .models import (
    Analysis,
    AnalysisResult,
    Case,
    CaseImage,
    DoctorReview,
    SiteSetting,
    Slide,
    User,
)

ACCOUNTS = [
    ("admin@dermascan.local", "DEMO Admin", "ADMIN"),
    ("doctor@dermascan.local", "DEMO Doctor", "DOCTOR"),
    ("patient@dermascan.local", "DEMO Patient A", "USER"),
    ("patient2@dermascan.local", "DEMO Patient B", "USER"),
]

DEMO_SLIDES = [
    {
        "title": "Kiến thức về ung thư da",
        "subtitle": "Nhận biết sớm các dấu hiệu bất thường trên da.",
        "image_path": "skin_cancer/webapp/assets/demoslide1.png",
        "button_text": "Tìm hiểu ngay",
        "button_url": "https://www.aad.org/public/diseases/skin-cancer",
    },
    {
        "title": "Tìm hiểu các bệnh lý da",
        "subtitle": "Khám phá kiến thức y khoa về tổn thương da.",
        "image_path": "skin_cancer/webapp/assets/demoslide2.png",
        "button_text": "Xem chi tiết",
        "button_url": "https://dermnetnz.org/topics/skin-cancer",
    },
]


def _seed_users(password):
    users = {}
    for email, name, role in ACCOUNTS:
        user = db.session.scalar(db.select(User).where(User.email == email))
        if user and (user.role != role or user.full_name != name):
            raise ValueError(
                f"Tài khoản {email} đã tồn tại và không phải dữ liệu demo phù hợp"
            )
        if user is None:
            user = User(email=email, full_name=name, role=role)
            user.set_password(password)
            db.session.add(user)
        users[email] = user
    db.session.flush()
    return users


def _seed_cases(users):
    doctor = users["doctor@dermascan.local"]
    patient_emails = ["patient@dermascan.local", "patient2@dermascan.local"]

    for number, email in enumerate(patient_emails, start=1):
        code = f"DEMO-CASE-{number:03d}"
        case = db.session.scalar(db.select(Case).where(Case.case_code == code))
        if case:
            if case.patient_user_id != users[email].id or case.doctor_id != doctor.id:
                raise ValueError("Mã ca demo đã được dùng bởi dữ liệu khác")
            continue

        case = Case(
            case_code=code,
            patient=users[email],
            doctor=doctor,
            lesion_location="DEMO – dữ liệu giả lập",
            status="ANALYZED",
        )
        db.session.add(case)
        db.session.flush()

        image = CaseImage(
            case_id=case.id,
            image_path="skin_cancer/test_examples/NV_1.jpg",
            original_filename="DEMO_NV_1.jpg",
            mime_type="image/jpeg",
            file_size=0,
            uploaded_by=doctor.id,
            status="COMPLETED",
        )
        db.session.add(image)
        db.session.flush()

        analysis = Analysis(
            case_id=case.id,
            case_image_id=image.id,
            status="COMPLETED",
        )
        db.session.add(analysis)
        db.session.flush()

        db.session.add(
            AnalysisResult(
                analysis_id=analysis.id,
                model_name="DEMO – not inference",
            )
        )
        db.session.add(
            DoctorReview(
                case_id=case.id,
                analysis_id=analysis.id,
                doctor_id=doctor.id,
                clinical_note=(
                    "Dữ liệu giả lập để kiểm tra database, "
                    "không phải kết quả AI/y khoa."
                ),
            )
        )


def _seed_site_setting(admin):
    if db.session.get(SiteSetting, 1) is None:
        db.session.add(
            SiteSetting(
                id=1,
                site_name="DermaScan AI",
                updated_by=admin.id,
                footer_description="Chỉ dùng cho mục đích nghiên cứu.",
            )
        )


def _seed_slides(admin):
    for number, data in enumerate(DEMO_SLIDES, start=1):
        legacy_title = f"DEMO Slide {number}"
        slide = db.session.scalar(
            db.select(Slide).where(
                Slide.created_by == admin.id,
                Slide.title.in_([legacy_title, data["title"]]),
            )
        )

        if slide is None:
            slide = Slide(title=data["title"], created_by=admin.id)
            db.session.add(slide)

        slide.title = data["title"]
        slide.subtitle = data["subtitle"]
        slide.image_path = data["image_path"]
        slide.button_text = data["button_text"]
        slide.button_url = data["button_url"]
        slide.display_order = number
        slide.is_active = True

    obsolete_titles = ["DEMO Slide 3", "Kho dữ liệu ISIC"]
    obsolete_slides = db.session.scalars(
        db.select(Slide).where(
            Slide.created_by == admin.id,
            Slide.title.in_(obsolete_titles),
        )
    )
    for slide in obsolete_slides:
        slide.is_active = False


def seed_demo(password):
    try:
        users = _seed_users(password)
        admin = users["admin@dermascan.local"]
        _seed_cases(users)
        _seed_site_setting(admin)
        _seed_slides(admin)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def register_seed(app):
    @app.cli.command("seed-demo")
    def command():
        if not current_app.config.get("ALLOW_DEMO_SEED"):
            raise click.ClickException(
                "Chỉ seed development: đặt ALLOW_DEMO_SEED=true"
            )

        password = os.getenv("DEMO_PASSWORD")
        if not password or not 12 <= len(password) <= 256:
            raise click.ClickException(
                "Đặt DEMO_PASSWORD có 12–256 ký tự; "
                "không dùng mật khẩu production"
            )

        try:
            seed_demo(password)
        except ValueError as exc:
            raise click.ClickException(str(exc)) from exc

        click.echo(
            "Demo seed hoàn tất. Tài khoản có sẵn giữ nguyên mật khẩu; "
            "chưa tạo PDF/email."
        )
