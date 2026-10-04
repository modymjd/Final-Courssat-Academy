import html
import re
from html.parser import HTMLParser

ALLOWED_TAGS = {
    "p",
    "b",
    "i",
    "u",
    "em",
    "strong",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "a",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "span",
    "div",
    "br",
    "hr",
    "sub",
    "sup",
    "del",
    "s",
    "mark",
    "small",
}

ALLOWED_ATTRIBUTES = {
    "a": {"href", "title", "target", "rel"},
    "img": {"src", "alt", "title", "width", "height", "class"},
    "table": {"class", "border"},
    "th": {"class", "scope", "colspan", "rowspan"},
    "td": {"class", "colspan", "rowspan"},
    "code": {"class"},
    "pre": {"class"},
    "span": {"class"},
    "div": {"class"},
    "p": {"class"},
}

GLOBAL_ALLOWED_ATTRS = {"class", "dir", "lang"}
DANGEROUS_PROTOCOLS = ("javascript:", "vbscript:", "data:text/html", "data:application")


class SafeHTMLSanitizer(HTMLParser):
    """
    Zero-dependency, high-performance HTML AST sanitizer based on Python's standard HTMLParser.
    Safely whitelists permissible educational tags/attributes and strips script/XSS vectors
    while guaranteeing full Unicode and Arabic language fidelity.
    """

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.result = []

    def handle_starttag(self, tag, attrs):
        tag_lower = tag.lower()
        if tag_lower not in ALLOWED_TAGS:
            return

        cleaned_attrs = []
        allowed_for_tag = ALLOWED_ATTRIBUTES.get(tag_lower, set()) | GLOBAL_ALLOWED_ATTRS

        for attr_name, attr_val in attrs:
            attr_lower = attr_name.lower()
            if attr_lower.startswith("on"):
                # Strip all JS event handlers (onload, onerror, onclick, etc.)
                continue
            if attr_lower not in allowed_for_tag:
                continue

            if attr_val:
                val_clean = attr_val.strip()
                # Check for protocol injections in href/src
                if attr_lower in ("href", "src"):
                    if any(val_clean.lower().startswith(proto) for proto in DANGEROUS_PROTOCOLS):
                        continue
                cleaned_attrs.append(f'{attr_name}="{html.escape(val_clean, quote=True)}"')

        attrs_str = (" " + " ".join(cleaned_attrs)) if cleaned_attrs else ""
        if tag_lower in ("br", "hr", "img"):
            self.result.append(f"<{tag_lower}{attrs_str} />")
        else:
            self.result.append(f"<{tag_lower}{attrs_str}>")

    def handle_endtag(self, tag):
        tag_lower = tag.lower()
        if tag_lower in ALLOWED_TAGS and tag_lower not in ("br", "hr", "img"):
            self.result.append(f"</{tag_lower}>")

    def handle_data(self, data):
        self.result.append(html.escape(data, quote=False))

    def handle_entityref(self, name):
        self.result.append(f"&{name};")

    def handle_charref(self, name):
        self.result.append(f"&#{name};")

    def get_clean_html(self) -> str:
        return "".join(self.result)


def sanitize_html_content(raw_text: str) -> str:
    """
    Main entry point: sanitizes rich-text input.
    If plain string with no tags, returns trimmed string.
    If HTML is present, passes through SafeHTMLSanitizer.
    """
    if not raw_text or not isinstance(raw_text, str):
        return raw_text

    # Quick check if string contains any HTML tag
    if not re.search(r"<[a-zA-Z/!]", raw_text):
        return raw_text.strip()

    parser = SafeHTMLSanitizer()
    parser.feed(raw_text)
    parser.close()
    return parser.get_clean_html()
