# Nexus Backend

Production-ready FastAPI REST API for document management with role-based access control, group-based file organisation, and pluggable storage providers.

## Tech Stack

- **Framework**: FastAPI (Python 3.12)
- **Database**: PostgreSQL 16 + SQLAlchemy 2.x + Alembic
- **Auth**: JWT (python-jose) + bcrypt (passlib)
- **Storage**: ownCloud 10 WebDAV (default), Google Drive & OneDrive (stubs)
- **Containerization**: Docker + Docker Compose

## Quick Start

### Docker (recommended)

```bash
cp .env.example .env
# Edit .env with your settings
docker-compose up --build -d
```

The API will be available at `http://localhost:8000`.
Swagger docs at `http://localhost:8000/docs`.

### Local Development

```bash
# Create virtual environment
python -m venv .venv
.venv\Scripts\activate   # Windows
source .venv/bin/activate # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Start PostgreSQL (or use docker-compose up db)
# Update DATABASE_URL in .env

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload --port 8000
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/login` | Public | Get JWT token |
| GET | `/api/v1/admin/users/` | Admin | List users |
| POST | `/api/v1/admin/users/` | Admin | Create user |
| PATCH | `/api/v1/admin/users/{id}` | Admin | Update user |
| DELETE | `/api/v1/admin/users/{id}` | Admin | Deactivate user |
| GET | `/api/v1/admin/groups/` | Admin | List groups |
| POST | `/api/v1/admin/groups/` | Admin | Create group |
| POST | `/api/v1/admin/groups/{gid}/users/{uid}` | Admin | Assign user to group |
| DELETE | `/api/v1/admin/groups/{gid}/users/{uid}` | Admin | Remove user from group |
| POST | `/api/v1/admin/drives/` | Admin | Add drive config |
| GET | `/api/v1/admin/drives/` | Admin | List drive configs |
| DELETE | `/api/v1/admin/drives/{id}` | Admin | Remove drive config |
| POST | `/api/v1/files/upload` | Admin | Upload file to group |
| GET | `/api/v1/users/me/` | User | Current user profile |
| GET | `/api/v1/users/me/groups` | User | User's groups (sidebar) |
| GET | `/api/v1/users/me/groups/{gid}/files` | User | Files in group |
| GET | `/api/v1/users/me/files/{fid}/download` | User | Download file |
| GET | `/api/v1/health` | Public | Health check |

## Testing

```bash
pytest tests/ -v
```

## Project Structure

```
nexus_backend/
├── app/
│   ├── core/          # Config, security, dependencies
│   ├── models/        # SQLAlchemy ORM models
│   ├── schemas/       # Pydantic request/response schemas
│   ├── routers/       # FastAPI route handlers
│   └── services/      # Business logic + storage providers
│       └── storage/   # StorageProvider strategy pattern
├── alembic/           # Database migrations
├── tests/             # Pytest test suite
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## Default Admin

On first startup, the system auto-creates an admin user from env vars:
- Username: `FIRST_ADMIN_USERNAME` (default: `admin`)
- Password: `FIRST_ADMIN_PASSWORD` (default: `admin`)
