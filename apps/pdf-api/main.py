from io import BytesIO

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pypdf import PdfReader
from pypdf.errors import PdfReadError


MAX_FILE_SIZE = 4 * 1024 * 1024
PREVIEW_MAX_LENGTH = 1000

app = FastAPI(
    title="PDF Inspector API",
    version="0.1.0",
)

# ローカル開発時にNext.jsから直接APIへアクセスするための設定。
# Vercel上で同一オリジンにまとめる場合は不要になります。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze_pdf(
    file: UploadFile = File(...),
) -> dict:
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail="PDFファイルを選択してください。",
        )

    file_bytes = await file.read()

    if not file_bytes:
        raise HTTPException(
            status_code=400,
            detail="ファイルが空です。",
        )

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="ファイルサイズは4MB以下にしてください。",
        )

    try:
        reader = PdfReader(BytesIO(file_bytes))
    except PdfReadError as error:
        raise HTTPException(
            status_code=400,
            detail="PDFファイルを読み込めませんでした。",
        ) from error
    except Exception as error:
        raise HTTPException(
            status_code=400,
            detail="有効なPDFファイルではありません。",
        ) from error

    if reader.is_encrypted:
        try:
            # 空のパスワードで開けるPDFもあるため試行する
            reader.decrypt("")
        except Exception:
            pass

        if reader.is_encrypted:
            return {
                "filename": file.filename or "unknown.pdf",
                "fileSize": len(file_bytes),
                "pageCount": len(reader.pages),
                "encrypted": True,
                "metadata": {
                    "title": None,
                    "author": None,
                    "subject": None,
                    "creator": None,
                },
                "text": {
                    "totalCharacters": 0,
                    "preview": "",
                },
                "pages": [],
            }

    metadata = reader.metadata

    page_results: list[dict] = []
    extracted_texts: list[str] = []
    total_characters = 0

    for index, page in enumerate(reader.pages):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""

        normalized_text = text.strip()
        character_count = len(normalized_text)

        total_characters += character_count

        page_results.append(
            {
                "pageNumber": index + 1,
                "characters": character_count,
                "hasText": character_count > 0,
            }
        )

        if normalized_text:
            extracted_texts.append(normalized_text)

    preview = "\n\n".join(extracted_texts)[:PREVIEW_MAX_LENGTH]

    return {
        "filename": file.filename or "unknown.pdf",
        "fileSize": len(file_bytes),
        "pageCount": len(reader.pages),
        "encrypted": False,
        "metadata": {
            "title": metadata.title if metadata else None,
            "author": metadata.author if metadata else None,
            "subject": metadata.subject if metadata else None,
            "creator": metadata.creator if metadata else None,
        },
        "text": {
            "totalCharacters": total_characters,
            "preview": preview,
        },
        "pages": page_results,
    }