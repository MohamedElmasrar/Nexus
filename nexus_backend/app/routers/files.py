"""
File upload router — admin-only.

POST /api/v1/files/upload
POST /api/v1/files/folder
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import get_db, require_admin
from app.models.user import User
from app.schemas.file_record import FileRecordRead, FileUploadResponse, FolderCreate
from app.services import file_service, group_service

router = APIRouter(prefix="/api/v1/files", tags=["Files"])


@router.post(
    "/upload",
    response_model=FileUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    file: UploadFile = File(...),
    group_id: int = Form(...),
    drive_id: int | None = Form(default=None),
    parent_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Upload a file to the default (or specified) storage provider
    and associate it with a group.

    Admin-only endpoint.
    """
    settings = get_settings()

    # Validate group exists
    group = group_service.get_group_by_id(db, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")

    # Read file content (respecting size limit)
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit",
        )

    try:
        record = await file_service.upload_file(
            db=db,
            file_content=content,
            filename=file.filename or "untitled",
            group_id=group_id,
            user=current_user,
            drive_id=drive_id,
            parent_id=parent_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Storage provider error: {exc}",
        )

    return FileUploadResponse(file=FileRecordRead.model_validate(record))


@router.post(
    "/folder",
    response_model=FileRecordRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_folder(
    data: FolderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Create a new virtual folder in a group.

    Admin-only endpoint.
    """
    # Validate group exists
    group = group_service.get_group_by_id(db, data.group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")

    try:
        record = await file_service.create_folder(
            db=db,
            name=data.name,
            group_id=data.group_id,
            user=current_user,
            parent_id=data.parent_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Folder creation error: {exc}",
        )

    return FileRecordRead.model_validate(record)
