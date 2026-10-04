import os
from io import BytesIO

import arabic_reshaper
import qrcode
from bidi.algorithm import get_display
from django.conf import settings
from django.core.files.base import ContentFile
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ARABIC_FONT_NAME = "ArabicFont"
_arabic_font_registered = False


def build_activation_url(frontend_url: str, batch_type: str, code: str, course_ids: list[int]) -> str:
    """Build the QR destination without leaking the PIN into the URL."""
    if batch_type == "course_access" and len(course_ids) == 1:
        return f"{frontend_url}/course/{course_ids[0]}/checkout?code={code}"
    return f"{frontend_url}/activate?code={code}"


def _ensure_arabic_font() -> str:
    global _arabic_font_registered
    if _arabic_font_registered:
        return ARABIC_FONT_NAME

    current_dir = os.path.dirname(os.path.abspath(__file__))
    bundled_font = os.path.normpath(os.path.join(current_dir, "..", "fonts", "arial.ttf"))

    candidates = [
        bundled_font,
        "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/tahoma.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(ARABIC_FONT_NAME, path))
                _arabic_font_registered = True
                return ARABIC_FONT_NAME
            except Exception:
                pass
    return "Helvetica-Bold"


def reshape_text(text: str) -> str:
    if not text:
        return ""
    if any(
        "\u0600" <= c <= "\u06FF"
        or "\u0750" <= c <= "\u077F"
        or "\u08A0" <= c <= "\u08FF"
        or "\uFB50" <= c <= "\uFDFF"
        or "\uFE70" <= c <= "\uFEFF"
        for c in text
    ):
        try:
            return get_display(arabic_reshaper.reshape(text))
        except Exception:
            return text
    return text


class PDFGeneratorService:
    @staticmethod
    def generate_pdf_for_batch(batch):
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        font_name = _ensure_arabic_font()

        codes = batch.codes.all()
        x_positions = [1.5 * cm, 11.0 * cm]
        y_positions = [23.0 * cm, 17.2 * cm, 11.4 * cm, 5.6 * cm]

        default_frontend = "https://courssat.online" if not getattr(settings, "DEBUG", True) else "http://localhost:8080"
        frontend_url = getattr(settings, "FRONTEND_URL", default_frontend).rstrip("/")

        # Bound the course lookup to two rows: we only need to distinguish
        # single-course batches from multi-course/general batches.
        batch_courses = list(batch.courses.all()[:2])
        course_ids = [course.id for course in batch_courses]

        # Determine batch label with Arabic support
        if batch.batch_type == "digital_balance" or batch.balance_amount > 0:
            batch_label = f"رصيد رقمي: {batch.balance_amount} ج.م"
        elif batch.batch_type == "course_access":
            first_course = batch_courses[0] if batch_courses else None
            batch_label = f"كورس: {first_course.title[:24]}" if first_course else "وصول لكورس"
        elif batch.batch_type == "center_student":
            batch_label = "كود طالب سنتر"
        elif batch.batch_type == "instructor_student":
            batch_label = "كود طالب عام"
        else:
            batch_label = "كود تفعيل إديوسمارت"

        page_codes = 0
        for code_obj in codes:
            if page_codes == 8:
                c.showPage()
                page_codes = 0

            col = page_codes % 2
            row = page_codes // 2

            x = x_positions[col]
            y = y_positions[row]

            # Card cutting dashed border
            c.setStrokeColorRGB(0.75, 0.75, 0.8)
            c.setLineWidth(0.8)
            c.setDash(2, 2)
            c.roundRect(x, y, 8.5 * cm, 5.0 * cm, 0.25 * cm, stroke=1, fill=0)
            c.setDash([])

            # Header inside card
            c.setFont("Helvetica-Bold", 9.5)
            c.setFillColorRGB(0.12, 0.25, 0.55)
            c.drawString(x + 0.4 * cm, y + 4.45 * cm, "EduSmart")
            c.setFont("Helvetica", 7.5)
            c.setFillColorRGB(0.45, 0.45, 0.45)
            c.drawString(x + 2.3 * cm, y + 4.45 * cm, "| Educational Platform")

            # Separator line
            c.setStrokeColorRGB(0.88, 0.88, 0.92)
            c.setLineWidth(0.5)
            c.line(x + 0.4 * cm, y + 4.2 * cm, x + 8.1 * cm, y + 4.2 * cm)

            # Batch info (Course / Voucher Name) using Arabic-capable Font and Reshaper
            c.setFont(font_name, 7.5)
            c.setFillColorRGB(0.2, 0.2, 0.25)
            c.drawString(x + 0.4 * cm, y + 3.8 * cm, reshape_text(batch_label))

            activation_url = build_activation_url(
                frontend_url=frontend_url,
                batch_type=batch.batch_type,
                code=code_obj.code,
                course_ids=course_ids,
            )
            qr = qrcode.QRCode(version=1, box_size=3, border=1)
            qr.add_data(activation_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white")

            img_buffer = BytesIO()
            qr_img.save(img_buffer)
            img_buffer.seek(0)
            qr_ir = ImageReader(img_buffer)

            qr_x = x + 5.1 * cm
            qr_y = y + 0.5 * cm
            c.drawImage(qr_ir, qr_x, qr_y, width=3.0 * cm, height=3.0 * cm)

            # Monospace Code Box & Security PIN
            c.setFont("Helvetica", 6.5)
            c.setFillColorRGB(0.5, 0.5, 0.5)
            c.drawString(x + 0.4 * cm, y + 3.0 * cm, "ACTIVATION CODE:")

            c.setFont("Courier-Bold", 11)
            c.setFillColorRGB(0.05, 0.05, 0.05)
            c.drawString(x + 0.4 * cm, y + 2.45 * cm, code_obj.code)

            c.setFont("Helvetica", 6.5)
            c.setFillColorRGB(0.5, 0.5, 0.5)
            c.drawString(x + 0.4 * cm, y + 1.7 * cm, "SECURITY PIN:")

            c.setFont("Courier-Bold", 12)
            c.setFillColorRGB(0.75, 0.15, 0.15)
            c.drawString(x + 0.4 * cm, y + 1.15 * cm, code_obj.password)

            c.setFont("Helvetica", 5.5)
            c.setFillColorRGB(0.55, 0.55, 0.55)
            c.drawString(x + 0.4 * cm, y + 0.45 * cm, "Scan QR or enter PIN at /activate")

            page_codes += 1

        c.save()
        buffer.seek(0)

        filename = f"batch_{batch.id}.pdf"
        batch.pdf_file.save(filename, ContentFile(buffer.read()))

        return batch.pdf_file.url
