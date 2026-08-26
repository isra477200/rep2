import hashlib
import json
import os
import sys
from pathlib import Path

import fitz
from PIL import Image


staging_project = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
client_root = staging_project / "dist" / "client"
data_root = client_root / "data"
media_root = client_root / "media"
preview_root = client_root / "document-previews"
preview_root.mkdir(parents=True, exist_ok=True)


def rewrite(value, mappings):
    if isinstance(value, str):
        return mappings.get(value, value)
    if isinstance(value, list):
        return [rewrite(child, mappings) for child in value]
    if not isinstance(value, dict):
        return value
    mapped_document = any(isinstance(child, str) and child in mappings for child in value.values())
    result = {key: rewrite(child, mappings) for key, child in value.items()}
    if mapped_document:
        if "mimeType" in result:
            result["mimeType"] = "image/webp"
        if isinstance(result.get("type"), str):
            result["type"] = "image/webp"
        if isinstance(result.get("kind"), str):
            result["kind"] = "image"
        if isinstance(result.get("mediaType"), str):
            result["mediaType"] = "image"
    return result


mappings = {}
before_bytes = 0
preview_bytes = 0
for pdf_path in sorted(media_root.rglob("*.pdf")):
    if media_root not in pdf_path.parents:
        raise RuntimeError(f"Ruta PDF fuera de media: {pdf_path}")
    source = pdf_path.read_bytes()
    digest = hashlib.sha256(source).hexdigest()
    output_path = preview_root / f"{digest}.webp"
    if not output_path.exists():
        with fitz.open(stream=source, filetype="pdf") as document:
            page = document.load_page(0)
            pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
            image.thumbnail((960, 1_400), Image.Resampling.LANCZOS)
            image.save(output_path, "WEBP", quality=62, method=6)
    public_source = "/media/" + pdf_path.relative_to(media_root).as_posix()
    mappings[public_source] = f"/document-previews/{output_path.name}"
    before_bytes += len(source)
    preview_bytes += output_path.stat().st_size

json_files = sorted(data_root.rglob("*.json"))
for json_path in json_files:
    value = json.loads(json_path.read_text(encoding="utf-8"))
    temporary = json_path.with_suffix(json_path.suffix + ".rvdocuments")
    temporary.write_text(json.dumps(rewrite(value, mappings), ensure_ascii=True, indent=2) + "\n", encoding="utf-8")
    os.replace(temporary, json_path)

for public_source in mappings:
    pdf_path = (client_root / public_source.lstrip("/")).resolve()
    if media_root not in pdf_path.parents:
        raise RuntimeError(f"Ruta PDF reescrita fuera de media: {pdf_path}")
    pdf_path.unlink()

print(json.dumps({
    "jsonFiles": len(json_files),
    "documents": len(mappings),
    "beforeBytes": before_bytes,
    "previewBytes": preview_bytes,
    "savedBytes": before_bytes - preview_bytes,
}, indent=2))
