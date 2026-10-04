"""Curriculum Taxonomy and Validation Service.

Defines the Single Source of Truth for the Egyptian educational stages,
grades, tracks (شُعب / مسارات), subjects, and subject branches, along
with strict validation rules adhering to Egyptian Ministry of Education specifications.
"""

from typing import Any

CURRICULUM_TAXONOMY: dict[str, Any] = {
    "stages": [
        {
            "id": "primary",
            "name": "المرحلة الابتدائية",
            "name_en": "Primary Stage",
            "description": "من الصف الأول حتى السادس الابتدائي، تنقسم إلى صفوف أولى وصفوف عليا.",
            "grades": [
                {
                    "id": "primary_1",
                    "name": "الصف الأول الابتدائي",
                    "group": "early_primary",
                    "requires_track": False,
                    "subjects": ["arabic", "english_connect", "math", "religious_education", "islamic_religion", "christian_religion"],
                },
                {
                    "id": "primary_2",
                    "name": "الصف الثاني الابتدائي",
                    "group": "early_primary",
                    "requires_track": False,
                    "subjects": ["arabic", "english_connect", "math", "religious_education", "islamic_religion", "christian_religion"],
                },
                {
                    "id": "primary_3",
                    "name": "الصف الثالث الابتدائي",
                    "group": "early_primary",
                    "requires_track": False,
                    "subjects": ["arabic", "english_connect", "math", "religious_education", "islamic_religion", "christian_religion"],
                },
                {
                    "id": "primary_4",
                    "name": "الصف الرابع الابتدائي",
                    "group": "upper_primary",
                    "requires_track": False,
                    "subjects": ["arabic", "english", "math", "science", "social_studies", "ict", "vocational_skills", "religious_education", "islamic_religion", "christian_religion"],
                },
                {
                    "id": "primary_5",
                    "name": "الصف الخامس الابتدائي",
                    "group": "upper_primary",
                    "requires_track": False,
                    "subjects": ["arabic", "english", "math", "science", "social_studies", "ict", "vocational_skills", "religious_education", "islamic_religion", "christian_religion"],
                },
                {
                    "id": "primary_6",
                    "name": "الصف السادس الابتدائي",
                    "group": "upper_primary",
                    "requires_track": False,
                    "subjects": ["arabic", "english", "math", "science", "social_studies", "ict", "vocational_skills", "religious_education", "islamic_religion", "christian_religion"],
                },
            ],
        },
        {
            "id": "prep",
            "name": "المرحلة الإعدادية",
            "name_en": "Preparatory Stage",
            "description": "دراسة المواد المدمجة بعمق مع دخول اللغة الأجنبية الثانية وتفرع الرياضيات والدراسات.",
            "grades": [
                {
                    "id": "prep_1",
                    "name": "الصف الأول الإعدادي",
                    "requires_track": False,
                    "subjects": ["arabic", "english", "second_foreign_lang", "french", "german", "italian", "spanish", "math", "science", "social_studies", "religious_education", "computer"],
                },
                {
                    "id": "prep_2",
                    "name": "الصف الثاني الإعدادي",
                    "requires_track": False,
                    "subjects": ["arabic", "english", "second_foreign_lang", "french", "german", "italian", "spanish", "math", "science", "social_studies", "religious_education", "computer"],
                },
                {
                    "id": "prep_3",
                    "name": "الصف الثالث الإعدادي (الشهادة الإعدادية)",
                    "requires_track": False,
                    "subjects": ["arabic", "english", "second_foreign_lang", "french", "german", "italian", "spanish", "math", "science", "social_studies", "religious_education", "computer"],
                },
            ],
        },
        {
            "id": "secondary",
            "name": "المرحلة الثانوية العامة",
            "name_en": "General Secondary Stage",
            "description": "الصف الأول عام للكل مع العلوم المتكاملة، والصفان الثاني والثالث ينقسمان إلى شُعب تخصصية.",
            "grades": [
                {
                    "id": "secondary_1",
                    "name": "الصف الأول الثانوي",
                    "requires_track": False,
                    "subjects": ["arabic", "english", "second_foreign_lang", "french", "german", "italian", "spanish", "math", "history", "integrated_sciences", "philosophy_logic", "religious_education"],
                },
                {
                    "id": "secondary_2",
                    "name": "الصف الثاني الثانوي",
                    "requires_track": True,
                    "allowed_tracks": ["scientific_science", "scientific_math", "literary"],
                },
                {
                    "id": "secondary_3",
                    "name": "الصف الثالث الثانوي (الشهادة العامة)",
                    "requires_track": True,
                    "allowed_tracks": ["scientific_science", "scientific_math", "literary"],
                },
            ],
            "tracks": [
                {
                    "id": "scientific_science",
                    "name": "شعبة علمي علوم",
                    "common_subjects": ["arabic", "english", "second_foreign_lang", "french", "german", "italian", "spanish", "religious_education"],
                    "specialized_subjects": ["physics", "chemistry", "biology"],
                    "grade_3_exclusive": ["geology"],
                },
                {
                    "id": "scientific_math",
                    "name": "شعبة علمي رياضة",
                    "common_subjects": ["arabic", "english", "second_foreign_lang", "french", "german", "italian", "spanish", "religious_education"],
                    "specialized_subjects": ["physics", "chemistry", "pure_math", "applied_math"],
                },
                {
                    "id": "literary",
                    "name": "شعبة أدبي",
                    "common_subjects": ["arabic", "english", "second_foreign_lang", "french", "german", "italian", "spanish", "religious_education"],
                    "specialized_subjects": ["history", "geography", "psychology_sociology", "philosophy_logic"],
                },
            ],
        },
        {
            "id": "baccalaureate",
            "name": "نظام البكالوريا المصرية",
            "name_en": "Egyptian Baccalaureate",
            "description": "مسار دولي ووطني حديث ينفصل بعد الإعدادية؛ صف أول تمهيدي ثم مسارات تخصصية في 2 و 3 بكالوريا.",
            "grades": [
                {
                    "id": "baccalaureate_1",
                    "name": "الصف الأول بكالوريا (تمهيدي)",
                    "requires_track": False,
                    "subjects": ["arabic", "english", "egyptian_history", "history", "math", "physics"],
                },
                {
                    "id": "baccalaureate_2",
                    "name": "الصف الثاني بكالوريا",
                    "requires_track": True,
                    "allowed_tracks": ["bac_medical", "bac_engineering", "bac_business", "bac_humanities"],
                },
                {
                    "id": "baccalaureate_3",
                    "name": "الصف الثالث بكالوريا",
                    "requires_track": True,
                    "allowed_tracks": ["bac_medical", "bac_engineering", "bac_business", "bac_humanities"],
                },
            ],
            "tracks": [
                {
                    "id": "bac_medical",
                    "name": "مسار الطب والعلوم الصحية",
                    "common_subjects": ["arabic", "english", "egyptian_history", "history", "religious_education"],
                    "specialized_subjects": ["biology", "chemistry"],
                },
                {
                    "id": "bac_engineering",
                    "name": "مسار الهندسة والتكنولوجيا",
                    "common_subjects": ["arabic", "english", "egyptian_history", "history", "religious_education"],
                    "specialized_subjects": ["advanced_math", "physics"],
                },
                {
                    "id": "bac_business",
                    "name": "مسار إدارة الأعمال والاقتصاد",
                    "common_subjects": ["arabic", "english", "egyptian_history", "history", "religious_education"],
                    "specialized_subjects": ["economics", "math"],
                },
                {
                    "id": "bac_humanities",
                    "name": "مسار العلوم الإنسانية والأدبي",
                    "common_subjects": ["arabic", "english", "egyptian_history", "history", "religious_education"],
                    "specialized_subjects": ["geography", "statistics"],
                },
            ],
        },
        {
            "id": "university",
            "name": "المرحلة الجامعية والمعاهد",
            "name_en": "University Stage",
            "description": "مقررات التعليم العالي والكليات والمعاهد المتخصصة.",
            "grades": [
                {
                    "id": "university",
                    "name": "المرحلة الجامعية",
                    "requires_track": False,
                    "subjects": [],
                }
            ],
        },
    ],
    "subject_branches": {
        "prep": {
            "math": [
                {"id": "algebra_stats", "name": "جبر وإحصاء"},
                {"id": "geometry", "name": "هندسة"},
            ],
            "social_studies": [
                {"id": "history", "name": "تاريخ"},
                {"id": "geography", "name": "جغرافيا"},
            ],
        },
        "secondary": {
            "secondary_1": {
                "math": [
                    {"id": "algebra_trig", "name": "جبر وحساب مثلثات"},
                    {"id": "analytic_geom", "name": "هندسة تحليلية"},
                ]
            }
        },
        "baccalaureate": {
            "baccalaureate_1": {
                "elective": [
                    {"id": "elective_math", "name": "مادة اختيارية: رياضيات"},
                    {"id": "elective_physics", "name": "مادة اختيارية: فيزياء"},
                ]
            }
        },
    },
}


def get_stage_config(stage_id: str) -> dict[str, Any] | None:
    for st in CURRICULUM_TAXONOMY["stages"]:
        if st["id"] == stage_id:
            return st
    return None


def get_grade_config(stage_config: dict[str, Any], grade_id: str) -> dict[str, Any] | None:
    for gr in stage_config.get("grades", []):
        if gr["id"] == grade_id:
            return gr
    return None


def get_track_config(stage_config: dict[str, Any], track_id: str) -> dict[str, Any] | None:
    for tr in stage_config.get("tracks", []):
        if tr["id"] == track_id:
            return tr
    return None


def get_allowed_subjects(stage: str, grade: str, track: str = "") -> list[str]:
    """Returns list of allowed subject codes for the given educational targeting."""
    stage_conf = get_stage_config(stage)
    if not stage_conf:
        return []

    # University is open/flexible
    if stage == "university":
        return ["*"]

    grade_conf = get_grade_config(stage_conf, grade)
    if not grade_conf:
        return []

    # If grade defines explicit subjects (primary 1-6, prep 1-3, secondary_1, baccalaureate_1)
    if "subjects" in grade_conf and not grade_conf.get("requires_track"):
        return grade_conf["subjects"]

    # If grade requires track (secondary_2, secondary_3, baccalaureate_2, baccalaureate_3)
    if grade_conf.get("requires_track"):
        if not track or track == "general":
            return []
        track_conf = get_track_config(stage_conf, track)
        if not track_conf:
            return []
        allowed = list(track_conf.get("common_subjects", [])) + list(track_conf.get("specialized_subjects", []))
        if grade == "secondary_3":
            allowed += track_conf.get("grade_3_exclusive", [])
        return allowed

    return []


def validate_academic_targeting(
    stage: str,
    grade: str,
    track: str = "",
    subject: str = "",
    branch: str = "",
    require_all: bool = True,
) -> dict[str, str]:
    """Strictly validates stage, grade, track, subject, and branch against official rules.

    Returns a dict of error messages keyed by field name, empty if valid.
    """
    errors: dict[str, str] = {}

    if not stage and not grade and not subject:
        if require_all:
            errors["educational_stage"] = "المرحلة التعليمية مطلوبة."
            errors["educational_grade"] = "الصف الدراسي مطلوب."
            errors["subject"] = "المادة الدراسية مطلوبة."
        return errors

    stage_conf = get_stage_config(stage)
    if not stage_conf:
        errors["educational_stage"] = "المرحلة التعليمية المختارة غير صالحة."
        return errors

    grade_conf = get_grade_config(stage_conf, grade)
    if not grade_conf:
        errors["educational_grade"] = "الصف الدراسي لا يتوافق مع المرحلة التعليمية المختارة."
        return errors

    # Track Validation
    requires_track = grade_conf.get("requires_track", False)
    allowed_tracks = grade_conf.get("allowed_tracks", [])

    if requires_track:
        if not track or track == "general":
            errors["educational_track"] = "الشعبة أو المسار التخصصي مطلوب لهذا الصف الدراسي."
        elif track not in allowed_tracks:
            errors["educational_track"] = f"الشعبة '{track}' غير صالحة لهذا الصف. المتاح: {', '.join(allowed_tracks)}."
    else:
        if track and track not in ("", "general"):
            errors["educational_track"] = "هذا الصف الدراسي عام ولا يقبل تشعيباً أو مسارات خاصة."

    # Subject Validation
    if subject:
        allowed_subjects = get_allowed_subjects(stage, grade, track)
        if allowed_subjects != ["*"] and subject not in allowed_subjects:
            if subject == "geology" and stage == "secondary" and grade == "secondary_2":
                errors["subject"] = "مادة الجيولوجيا مقررة فقط في الصف الثالث الثانوي (علمي علوم)."
            elif subject == "integrated_sciences" and (stage != "secondary" or grade != "secondary_1"):
                errors["subject"] = "مادة العلوم المتكاملة مقررة فقط في الصف الأول الثانوي."
            elif subject == "advanced_math" and (stage != "baccalaureate" or track != "bac_engineering"):
                errors["subject"] = "مادة الرياضيات المتقدمة مقررة حصراً في مسار الهندسة بنظام البكالوريا."
            else:
                errors["subject"] = f"المادة '{subject}' غير مطابقة للمنهج المعتمد لهذا الصف والشعبة."

    # Branch Validation (Optional check if branch specified)
    if branch and branch not in ("", "general"):
        if stage == "prep":
            if subject == "math" and branch not in ("algebra_stats", "geometry"):
                errors["subject_branch"] = "فروع مادة الرياضيات للإعدادي هي: جبر وإحصاء / هندسة."
            elif subject == "social_studies" and branch not in ("history", "geography"):
                errors["subject_branch"] = "فروع مادة الدراسات للإعدادي هي: تاريخ / جغرافيا."
        elif stage == "secondary" and grade == "secondary_1":
            if subject == "math" and branch not in ("algebra_trig", "analytic_geom"):
                errors["subject_branch"] = "فروع رياضيات الصف الأول الثانوي هي: جبر وحساب مثلثات / هندسة تحليلية."

    return errors
