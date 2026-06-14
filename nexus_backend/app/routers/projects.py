"""
Projects router — CRUD for projects linked to ownCloud groups.

Each project maps to an ownCloud group and a shared folder.
Admin users can create/delete projects. All users can list projects
they have access to (based on group membership).
"""

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user, get_db, require_admin
from app.models.project import Project
from app.services.owncloud_client import get_owncloud_client

router = APIRouter(prefix="/api/v1/projects", tags=["Projects"])


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    group_id: str  # Existing ownCloud group to link


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


@router.get("/")
async def list_projects(
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List projects the current user has access to (based on group membership)."""
    oc = get_owncloud_client()
    user_info = await oc.get_current_user(current_user.username, current_user.oc_password)
    user_groups = user_info.groups if user_info else []
    
    # If admin, show all projects; otherwise filter by group membership
    if current_user.is_admin:
        projects = db.query(Project).order_by(Project.created_at.desc()).all()
    else:
        projects = (
            db.query(Project)
            .filter(Project.group_id.in_(user_groups))
            .order_by(Project.created_at.desc())
            .all()
        )
    
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
            "group_id": p.group_id,
            "root_path": p.root_path,
            "created_by": p.created_by,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
        }
        for p in projects
    ]


@router.post("/")
async def create_project(
    data: ProjectCreate,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Create a new project linked to an ownCloud group."""
    # Check if project name already exists
    existing = db.query(Project).filter(Project.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project name already exists")
    
    oc = get_owncloud_client()
    
    # Create the shared folder for the project
    root_path = f"/ProjectDocs/{data.name}"
    try:
        # Create folder as admin
        await oc.create_folder(current_user.username, current_user.oc_password, "/ProjectDocs")
        await oc.create_folder(current_user.username, current_user.oc_password, root_path)
    except Exception:
        pass  # Folder may already exist
    
    # Share the folder with the group
    try:
        await oc.create_share(
            current_user.username, current_user.oc_password,
            root_path, share_type=1, share_with=data.group_id, permissions=15,
        )
    except Exception:
        pass  # Share may already exist
    
    project = Project(
        name=data.name,
        description=data.description,
        group_id=data.group_id,
        root_path=root_path,
        created_by=current_user.username,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "group_id": project.group_id,
        "root_path": project.root_path,
        "created_by": project.created_by,
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }


@router.get("/{project_id}")
async def get_project(
    project_id: int,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get project details."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Get group members
    oc = get_owncloud_client()
    try:
        members = await oc.get_group_members(
            current_user.username, current_user.oc_password, project.group_id
        )
    except Exception:
        members = []
    
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "group_id": project.group_id,
        "root_path": project.root_path,
        "created_by": project.created_by,
        "created_at": project.created_at.isoformat() if project.created_at else None,
        "updated_at": project.updated_at.isoformat() if project.updated_at else None,
        "members": members,
    }


@router.delete("/{project_id}")
async def delete_project(
    project_id: int,
    current_user: CurrentUser = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete a project (admin only). Does NOT delete the ownCloud group or files."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(project)
    db.commit()
    return {"detail": f"Project '{project.name}' deleted"}


@router.get("/{project_id}/files")
async def browse_project_files(
    project_id: int,
    path: str = Query("/", description="Relative path within the project folder"),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Browse files in the project's shared folder."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    oc = get_owncloud_client()
    full_path = f"{project.root_path.rstrip('/')}/{path.lstrip('/')}".replace("//", "/")
    
    try:
        files = await oc.list_files(current_user.username, current_user.oc_password, full_path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"ownCloud error: {e}")
    
    return [
        {
            "name": f.name,
            "path": f.path,
            "is_directory": f.is_directory,
            "size": f.size,
            "content_type": f.content_type,
            "last_modified": f.last_modified,
        }
        for f in files
    ]


@router.post("/{project_id}/files/upload")
async def upload_project_file(
    project_id: int,
    path: str = Query("/", description="Destination path within the project folder"),
    file: UploadFile = File(...),
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a file to the project's shared folder."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    oc = get_owncloud_client()
    content = await file.read()
    full_path = f"{project.root_path.rstrip('/')}/{path.lstrip('/').rstrip('/')}/{file.filename}".replace("//", "/")
    
    try:
        ok = await oc.upload_file(current_user.username, current_user.oc_password, full_path, content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upload failed: {e}")
    if not ok:
        raise HTTPException(status_code=500, detail="Upload failed")
    
    # Auto-index for AI
    try:
        from app.services import ingestion
        await ingestion.ingest_file(db, full_path, current_user.username, current_user.oc_password)
    except Exception:
        pass
    
    return {"detail": f"Uploaded {file.filename}", "path": full_path}


@router.post("/{project_id}/files/folder")
async def create_project_folder(
    project_id: int,
    data: dict,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a folder in the project's shared folder."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    folder_path = data.get("path", "")
    if not folder_path:
        raise HTTPException(status_code=400, detail="Path required")
    
    oc = get_owncloud_client()
    full_path = f"{project.root_path.rstrip('/')}/{folder_path.lstrip('/')}".replace("//", "/")
    
    try:
        ok = await oc.create_folder(current_user.username, current_user.oc_password, full_path)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Create folder error: {e}")
    if not ok:
        raise HTTPException(status_code=500, detail="Failed to create folder")
    
    return {"detail": f"Created folder at {full_path}"}
