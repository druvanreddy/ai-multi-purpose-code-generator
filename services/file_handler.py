"""
DMIXERAI
File Handler Service
"""

TEXT_EXTENSIONS = {
    "py", "java", "js", "jsx", "ts", "tsx", "cpp", "cc", "c", "h", "hpp", "cs",
    "go", "rs", "rb", "kt", "swift", "scala", "dart", "lua", "r",
    "php", "sql", "sh", "bash", "ps1", "pl",
    "txt", "md", "json", "yaml", "yml", "toml", "ini", "html", "css", "scss",
    "xml", "dockerfile", "gitignore",
}


def extract_text(filename, raw_bytes):
    """Return (content, is_text) for an uploaded file."""

    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if extension not in TEXT_EXTENSIONS:
        return None, False

    try:
        return raw_bytes.decode("utf-8"), True
    except UnicodeDecodeError:
        return None, False
