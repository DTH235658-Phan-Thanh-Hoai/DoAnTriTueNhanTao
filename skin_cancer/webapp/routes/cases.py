from datetime import date
from uuid import uuid4

from flask import (
    Blueprint,
    abort,
    jsonify,
    request,
)

from flask_login import current_user

from ..extensions import db

from ..models import (
    User,
    Case,
    Analysis,
    DoctorReview,
)

from ..services.access import (
    require_roles,
    visible_cases,
    visible_case_or_404,
    create_case,
)


bp = Blueprint(
    'cases',
    __name__,
    url_prefix='/api',
)


# ============================================================
# GENERAL HELPERS
# ============================================================

def _optional_string(
    value,
    max_length,
):

    if value is None:

        return None


    if not isinstance(
        value,
        str,
    ):

        abort(
            400,
            description='Dữ liệu không hợp lệ.',
        )


    value = value.strip()


    if not value:

        return None


    if len(value) > max_length:

        abort(
            400,
            description='Dữ liệu vượt quá độ dài cho phép.',
        )


    return value


# ============================================================
# PATIENT HELPERS
# ============================================================

def _user_snapshot(
    user,
):

    if not user:

        return None


    return {

        'full_name':
            user.full_name,

        'date_of_birth':
            (
                user.date_of_birth.isoformat()
                if user.date_of_birth
                else None
            ),

        'gender':
            user.gender,

        'phone':
            user.phone,

        'email':
            user.email,

        'address':
            None,
    }


def _case_patient_snapshot(
    case,
):

    # Snapshot luôn được ưu tiên.
    if isinstance(
        case.patient_snapshot,
        dict,
    ):

        return case.patient_snapshot


    # Fallback cho Case cũ.
    return _user_snapshot(
        case.patient
    )


def _temporary_patient(
    payload,
):

    if not isinstance(
        payload,
        dict,
    ):

        abort(
            400,
            description='Thông tin bệnh nhân không hợp lệ.',
        )


    # ========================================================
    # FULL NAME
    # ========================================================

    full_name = _optional_string(
        payload.get(
            'full_name'
        ),
        150,
    )


    if not full_name:

        abort(
            400,
            description='Họ tên bệnh nhân là bắt buộc.',
        )


    # ========================================================
    # DATE OF BIRTH
    # ========================================================

    dob = _optional_string(
        payload.get(
            'date_of_birth'
        ),
        10,
    )


    if dob:

        try:

            date.fromisoformat(
                dob
            )

        except ValueError:

            abort(
                400,
                description='Ngày sinh không hợp lệ.',
            )


    # ========================================================
    # GENDER
    # ========================================================

    gender = _optional_string(
        payload.get(
            'gender'
        ),
        30,
    )


    # ========================================================
    # PHONE
    # ========================================================

    phone = _optional_string(
        payload.get(
            'phone'
        ),
        30,
    )


    # ========================================================
    # EMAIL
    # ========================================================

    email = _optional_string(
        payload.get(
            'email'
        ),
        254,
    )


    if email:

        if (
            '@' not in email
            or
            email.startswith('@')
            or
            email.endswith('@')
        ):

            abort(
                400,
                description='Email bệnh nhân không hợp lệ.',
            )


    # ========================================================
    # ADDRESS
    # ========================================================

    address = _optional_string(
        payload.get(
            'address'
        ),
        500,
    )


    return {

        'full_name':
            full_name,

        'date_of_birth':
            dob,

        'gender':
            gender,

        'phone':
            phone,

        'email':
            email,

        'address':
            address,
    }


# ============================================================
# CASE HELPERS
# ============================================================

def _new_case_code():

    # CASE- + 32 ký tự UUID
    # tổng < VARCHAR(40)

    return (
        'CASE-'
        +
        uuid4()
        .hex
        .upper()
    )


def _resolve_doctor_id(
    requested_doctor_id=None,
):

    # ========================================================
    # DOCTOR
    # ========================================================

    if current_user.role == 'DOCTOR':

        if (
            requested_doctor_id
            is not None
            and
            requested_doctor_id
            != current_user.id
        ):

            abort(403)


        return current_user.id


    # ========================================================
    # ADMIN
    # ========================================================

    if current_user.role == 'ADMIN':

        if (
            type(requested_doctor_id)
            is not int
            or
            requested_doctor_id <= 0
        ):

            abort(
                400,
                description=(
                    'Admin cần cung cấp doctor_id.'
                ),
            )


        doctor = db.session.get(
            User,
            requested_doctor_id,
        )


        if (
            not doctor
            or
            doctor.role != 'DOCTOR'
            or
            not doctor.is_active
        ):

            abort(
                400,
                description='Doctor không hợp lệ.',
            )


        return doctor.id


    abort(403)


def case_json(
    case,
):

    snapshot = (
        _case_patient_snapshot(
            case
        )
    )


    return {

        'id':
            case.id,

        'case_code':
            case.case_code,

        'patient_user_id':
            case.patient_user_id,

        'patient_snapshot':
            snapshot,

        'patient_source':
            (
                'ACCOUNT'
                if case.patient_user_id
                else 'TEMPORARY'
            ),

        'doctor_id':
            case.doctor_id,

        'lesion_location':
            case.lesion_location,

        'status':
            case.status,

        'created_at':
            (
                case.created_at.isoformat()
                + 'Z'
                if case.created_at
                else None
            ),
    }


# ============================================================
# REVIEW HELPERS
# ============================================================

def _review_json(
    review,
):

    if not review:

        return None


    return {

        'id':
            review.id,

        'case_id':
            review.case_id,

        'analysis_id':
            review.analysis_id,

        'doctor_id':
            review.doctor_id,

        'clinical_note':
            review.clinical_note,

        'doctor_conclusion':
            review.doctor_conclusion,

        'recommendation':
            review.recommendation,

        'review_status':
            review.review_status,

        'created_at':
            (
                review.created_at.isoformat()
                + 'Z'
                if review.created_at
                else None
            ),

        'updated_at':
            (
                review.updated_at.isoformat()
                + 'Z'
                if review.updated_at
                else None
            ),
    }


def _clean_review_text(
    value,
    max_length=3000,
):

    if value is None:

        return None


    if not isinstance(
        value,
        str,
    ):

        abort(
            400,
            description=(
                'Nội dung chẩn đoán không hợp lệ.'
            ),
        )


    value = value.strip()


    if len(value) > max_length:

        abort(
            400,
            description=(
                'Nội dung chẩn đoán quá dài.'
            ),
        )


    return value or None


# ============================================================
# PATIENT LIST
# ============================================================

@bp.get('/patients')
@require_roles(
    'ADMIN',
    'DOCTOR',
)
def list_patients():

    query = (
        db.select(
            User
        )
        .where(

            User.role
            ==
            'USER',

            User.is_active
            .is_(True),
        )
        .order_by(

            User.full_name.asc(),

            User.id.asc(),
        )
    )


    patients = (
        db.session
        .scalars(
            query
        )
        .all()
    )


    return jsonify(

        patients=[

            {

                'id':
                    patient.id,

                'full_name':
                    patient.full_name,

                'email':
                    patient.email,

                'date_of_birth':
                    (
                        patient.date_of_birth
                        .isoformat()
                        if patient.date_of_birth
                        else None
                    ),

                'gender':
                    patient.gender,

                'phone':
                    patient.phone,
            }

            for patient
            in patients
        ]
    )


# ============================================================
# GET CASE
# ============================================================

@bp.get(
    '/cases/<int:case_id>'
)
@require_roles()
def get_case(
    case_id,
):

    case = visible_case_or_404(
        case_id
    )


    payload = case_json(
        case
    )


    payload.update(

        image_ids=[
            image.id
            for image
            in case.images
        ],

        analysis_ids=[
            analysis.id
            for analysis
            in case.analyses
        ],

        report_ids=[
            report.id
            for report
            in case.reports
        ],

        review_ids=[
            review.id
            for review
            in case.reviews
        ],
    )


    return jsonify(
        payload
    )


# ============================================================
# USER HISTORY
# ============================================================

@bp.get(
    '/users/<int:user_id>/cases'
)
@require_roles()
def user_history(
    user_id,
):

    # USER chỉ được xem chính mình.

    if (
        current_user.role
        ==
        'USER'
        and
        current_user.id
        !=
        user_id
    ):

        abort(404)


    user = db.session.get(
        User,
        user_id,
    )


    if (
        not user
        or
        user.role != 'USER'
    ):

        abort(404)


    query = (
        visible_cases(
            current_user
        )
        .where(
            Case.patient_user_id
            ==
            user_id
        )
        .order_by(

            Case.created_at.desc(),

            Case.id.desc(),
        )
    )


    cases = (
        db.session
        .scalars(
            query
        )
        .all()
    )


    # Doctor không được dùng endpoint này
    # để dò xem User có tồn tại hay không.

    if (
        current_user.role
        ==
        'DOCTOR'
        and
        not cases
    ):

        abort(404)


    return jsonify(

        cases=[
            case_json(
                case
            )

            for case
            in cases
        ]
    )


# ============================================================
# CREATE CASE
# ============================================================

@bp.post('/cases')
@require_roles(
    'ADMIN',
    'DOCTOR',
)
def post_case():

    data = request.get_json(
        silent=True
    )


    if not isinstance(
        data,
        dict,
    ):

        abort(
            400,
            description='Payload không hợp lệ.',
        )


    patient_user_id = (
        data.get(
            'patient_user_id'
        )
    )


    temporary_patient = (
        data.get(
            'temporary_patient'
        )
    )


    # ========================================================
    # VALIDATE PATIENT SOURCE
    # ========================================================

    if (
        patient_user_id
        is not None
        and
        temporary_patient
        is not None
    ):

        abort(
            400,
            description=(
                'Chỉ được chọn một nguồn bệnh nhân.'
            ),
        )


    if (
        patient_user_id
        is None
        and
        temporary_patient
        is None
    ):

        abort(
            400,
            description=(
                'Cần chọn hoặc thêm bệnh nhân.'
            ),
        )


    doctor_id = (
        data.get(
            'doctor_id'
        )
    )


    lesion_location = _optional_string(
        data.get(
            'lesion_location'
        ),
        255,
    )


    # ========================================================
    # REGISTERED PATIENT
    # ========================================================

    if (
        patient_user_id
        is not None
    ):

        if (
            type(
                patient_user_id
            )
            is not int
            or
            patient_user_id <= 0
        ):

            abort(
                400,
                description='patient_user_id không hợp lệ.',
            )


        patient = db.session.get(
            User,
            patient_user_id,
        )


        if (
            not patient
            or
            patient.role != 'USER'
            or
            not patient.is_active
        ):

            abort(
                404,
                description=(
                    'Không tìm thấy bệnh nhân.'
                ),
            )


        # Doctor dùng helper create_case hiện tại.

        if (
            current_user.role
            ==
            'DOCTOR'
        ):

            case = create_case(

                current_user,

                patient_user_id,

                None,

                lesion_location,
            )


        else:

            resolved_doctor_id = (
                _resolve_doctor_id(
                    doctor_id
                )
            )


            case = create_case(

                current_user,

                patient_user_id,

                resolved_doctor_id,

                lesion_location,
            )


        # Snapshot dữ liệu hiện tại của bệnh nhân.
        # PDF về sau không bị thay đổi nếu profile User đổi.

        case.patient_snapshot = (
            _user_snapshot(
                patient
            )
        )


        db.session.commit()


        return jsonify(
            case_json(
                case
            )
        ), 201


    # ========================================================
    # TEMPORARY PATIENT
    # ========================================================

    snapshot = (
        _temporary_patient(
            temporary_patient
        )
    )


    resolved_doctor_id = (
        _resolve_doctor_id(
            doctor_id
        )
    )

    case = Case(
        case_code=
            _new_case_code(),
        patient_user_id=
            None,
        patient_snapshot=
            snapshot,

        doctor_id=
            resolved_doctor_id,

        lesion_location=
            lesion_location,

        status=
            'CREATED',
    )


    db.session.add(
        case
    )


    db.session.commit()


    return jsonify(
        case_json(
            case
        )
    ), 201


# ============================================================
# GET ANALYSIS
# ============================================================

@bp.get(
    '/analyses/<int:analysis_id>'
)
@require_roles()
def get_analysis(
    analysis_id,
):

    analysis = db.session.get(
        Analysis,
        analysis_id,
    )


    if not analysis:

        abort(404)


    visible_case_or_404(
        analysis.case_id
    )


    return jsonify(

        id=
            analysis.id,

        case_id=
            analysis.case_id,

        case_image_id=
            analysis.case_image_id,

        status=
            analysis.status,

        lesion_area_px=
            analysis.lesion_area_px,

        lesion_perimeter_px=
            analysis.lesion_perimeter_px,

        lesion_ratio=
            analysis.lesion_ratio,

        results=[

            {

                'id':
                    result.id,

                'model_name':
                    result.model_name,

                'binary_result':
                    result.binary_result,

                'binary_probability':
                    result.binary_probability,

                'predicted_class':
                    result.predicted_class,

                'predicted_probability':
                    result.predicted_probability,

                'class_probabilities':
                    result.class_probabilities,
            }

            for result
            in analysis.results
        ],
    )


# ============================================================
# GET REVIEW BY REVIEW ID
# ============================================================

@bp.get(
    '/reviews/<int:review_id>'
)
@require_roles()
def get_review(
    review_id,
):

    review = db.session.get(
        DoctorReview,
        review_id,
    )


    if not review:

        abort(404)


    visible_case_or_404(
        review.case_id
    )


    return jsonify(
        _review_json(
            review
        )
    )


# ============================================================
# GET LATEST REVIEW FOR ANALYSIS
# ============================================================

@bp.get(
    '/analyses/<int:analysis_id>/review'
)
@require_roles(
    'ADMIN',
    'DOCTOR',
)
def get_analysis_review(
    analysis_id,
):

    analysis = db.session.get(
        Analysis,
        analysis_id,
    )


    if not analysis:

        abort(404)


    # Kiểm tra Doctor/Admin có quyền với Case.
    visible_case_or_404(
        analysis.case_id
    )


    review = (
        db.session
        .scalars(

            db.select(
                DoctorReview
            )
            .where(

                DoctorReview.analysis_id
                ==
                analysis.id
            )
            .order_by(
                DoctorReview.id.desc()
            )
        )
        .first()
    )


    return jsonify(

        review=
            _review_json(
                review
            )
    )


# ============================================================
# SAVE / UPDATE DOCTOR DIAGNOSIS
# ============================================================

@bp.post(
    '/analyses/<int:analysis_id>/review'
)
@require_roles(
    'ADMIN',
    'DOCTOR',
)
def save_analysis_review(
    analysis_id,
):

    # ========================================================
    # ANALYSIS
    # ========================================================

    analysis = db.session.get(
        Analysis,
        analysis_id,
    )


    if not analysis:

        abort(
            404,
            description='Không tìm thấy Analysis.',
        )


    # ========================================================
    # CASE + AUTHORIZATION
    # ========================================================

    case = visible_case_or_404(
        analysis.case_id
    )


    # ========================================================
    # PAYLOAD
    # ========================================================

    data = request.get_json(
        silent=True
    )


    if not isinstance(
        data,
        dict,
    ):

        abort(
            400,
            description='Payload không hợp lệ.',
        )


    clinical_note = (
        _clean_review_text(
            data.get(
                'clinical_note'
            )
        )
    )


    doctor_conclusion = (
        _clean_review_text(
            data.get(
                'doctor_conclusion'
            )
        )
    )


    recommendation = (
        _clean_review_text(
            data.get(
                'recommendation'
            )
        )
    )


    # ========================================================
    # CONCLUSION REQUIRED
    # ========================================================

    if not doctor_conclusion:

        abort(
            400,
            description=(
                'Vui lòng nhập chẩn đoán của bác sĩ.'
            ),
        )


    # ========================================================
    # FIND EXISTING REVIEW
    #
    # Một bác sĩ sửa lại chẩn đoán thì UPDATE record hiện tại,
    # không tạo record mới mỗi lần nhấn Lưu.
    # ========================================================

    review = (
        db.session
        .scalars(

            db.select(
                DoctorReview
            )
            .where(

                DoctorReview.analysis_id
                ==
                analysis.id,

                DoctorReview.doctor_id
                ==
                current_user.id,
            )
            .order_by(
                DoctorReview.id.desc()
            )
        )
        .first()
    )


    # ========================================================
    # CREATE
    # ========================================================

    if not review:

        review = DoctorReview(

            case_id=
                case.id,

            analysis_id=
                analysis.id,

            doctor_id=
                current_user.id,

            review_status=
                'DRAFT',
        )


        db.session.add(
            review
        )


    # ========================================================
    # UPDATE CONTENT
    # ========================================================

    review.clinical_note = (
        clinical_note
    )


    review.doctor_conclusion = (
        doctor_conclusion
    )


    review.recommendation = (
        recommendation
    )


    review.review_status = (
        'REVIEWED'
    )


    # Case đã được bác sĩ review.

    case.status = (
        'REVIEWED'
    )


    db.session.commit()


    return jsonify(

        review=
            _review_json(
                review
            )
    )


# ============================================================
# OPTIONAL:
# SAVE DRAFT REVIEW
#
# Endpoint này chưa bắt buộc frontend phải dùng.
# Nó hữu ích nếu về sau bạn muốn Auto-save.
# ============================================================

@bp.post(
    '/analyses/<int:analysis_id>/review/draft'
)
@require_roles(
    'ADMIN',
    'DOCTOR',
)
def save_analysis_review_draft(
    analysis_id,
):

    analysis = db.session.get(
        Analysis,
        analysis_id,
    )


    if not analysis:

        abort(404)


    case = visible_case_or_404(
        analysis.case_id
    )


    data = request.get_json(
        silent=True
    )


    if not isinstance(
        data,
        dict,
    ):

        abort(400)


    clinical_note = (
        _clean_review_text(
            data.get(
                'clinical_note'
            )
        )
    )


    doctor_conclusion = (
        _clean_review_text(
            data.get(
                'doctor_conclusion'
            )
        )
    )


    recommendation = (
        _clean_review_text(
            data.get(
                'recommendation'
            )
        )
    )


    review = (
        db.session
        .scalars(

            db.select(
                DoctorReview
            )
            .where(

                DoctorReview.analysis_id
                ==
                analysis.id,

                DoctorReview.doctor_id
                ==
                current_user.id,
            )
            .order_by(
                DoctorReview.id.desc()
            )
        )
        .first()
    )


    if not review:

        review = DoctorReview(

            case_id=
                case.id,

            analysis_id=
                analysis.id,

            doctor_id=
                current_user.id,

            review_status=
                'DRAFT',
        )


        db.session.add(
            review
        )


    review.clinical_note = (
        clinical_note
    )


    review.doctor_conclusion = (
        doctor_conclusion
    )


    review.recommendation = (
        recommendation
    )


    review.review_status = (
        'DRAFT'
    )


    db.session.commit()


    return jsonify(

        review=
            _review_json(
                review
            )
    )