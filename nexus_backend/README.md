# Nexus Backend

FastAPI REST API for the Nexus document management platform. Provides authentication, file management, and AI-powered document Q&A — all backed by ownCloud for storage and user management.

## Tech Stack

- **Framework**: FastAPI (Python 3.12)
- **Database**: PostgreSQL 16 + SQLAlchemy 2.x + Alembic
- **Auth**: JWT (python-jose) + Fernet encryption for ownCloud credentials
- **Storage**: ownCloud 10 (WebDAV + OCS Provisioning API)
- **AI / RAG**: Google Gemini, ChromaDB, Sentence Transformers
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

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/auth/login` | Public | Authenticate via ownCloud, get JWT |

### Admin — Users & Groups (ownCloud OCS API)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/users/` | Admin | List ownCloud users |
| GET | `/api/v1/admin/users/{username}` | Admin | Get user details |
| GET | `/api/v1/admin/groups/` | Admin | List ownCloud groups |
| POST | `/api/v1/admin/groups/` | Admin | Create group |
| DELETE | `/api/v1/admin/groups/{group_id}` | Admin | Delete group |
| POST | `/api/v1/admin/groups/{gid}/users/{uid}` | Admin | Add user to group |
| DELETE | `/api/v1/admin/groups/{gid}/users/{uid}` | Admin | Remove user from group |

### Admin — Files & Sharing (ownCloud WebDAV)
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/admin/files/browse` | Admin | Browse ownCloud files |
| POST | `/api/v1/admin/files/upload` | Admin | Upload file |
| GET | `/api/v1/admin/files/download` | Admin | Download file |
| POST | `/api/v1/admin/files/folder` | Admin | Create folder |
| DELETE | `/api/v1/admin/files/` | Admin | Delete file/folder |
| GET | `/api/v1/admin/files/shares` | Admin | List ownCloud shares |
| POST | `/api/v1/admin/files/share` | Admin | Create share |
| DELETE | `/api/v1/admin/files/share/{id}` | Admin | Remove share |

### Current User
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/users/me/` | User | Profile info |
| GET | `/api/v1/users/me/groups` | User | User's groups |
| GET | `/api/v1/users/me/files` | User | Browse files |
| GET | `/api/v1/users/me/files/download` | User | Download file |
| POST | `/api/v1/users/me/files/upload` | User | Upload file |
| DELETE | `/api/v1/users/me/files` | User | Delete file |
| POST | `/api/v1/users/me/files/folder` | User | Create folder |

### AI & Chat
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/v1/ai/index` | Admin | Index file for RAG |
| POST | `/api/v1/ai/index-all` | Admin | Index all unsynced files |
| GET | `/api/v1/ai/index` | Admin | List indexed files |
| DELETE | `/api/v1/ai/index` | Admin | Remove file from index |
| GET | `/api/v1/chat/conversations` | User | List conversations |
| POST | `/api/v1/chat/conversations` | User | Create conversation |
| GET | `/api/v1/chat/conversations/{id}` | User | Get conversation |
| DELETE | `/api/v1/chat/conversations/{id}` | User | Delete conversation |
| PATCH | `/api/v1/chat/conversations/{id}` | User | Update title |
| POST | `/api/v1/chat/conversations/{id}/ask` | User | Send message, get AI response |

### Health
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/v1/health` | Public | Health check |

## Testing

```bash
pytest tests/ -v
```

## Project Structure

```
nexus_backend/
├── app/
│   ├── core/              # Config, security, JWT, dependencies
│   ├── models/            # SQLAlchemy ORM models (conversations, sync)
│   ├── schemas/           # Pydantic request/response schemas
│   ├── routers/           # FastAPI route handlers
│   │   ├── auth.py        # Login (ownCloud-backed)
│   │   ├── admin_users.py # Admin user management (OCS API)
│   │   ├── admin_groups.py# Admin group management (OCS API)
│   │   ├── admin_files.py # Admin file management (WebDAV)
│   │   ├── ai.py          # AI indexing endpoints
│   │   ├── chat.py        # Conversation & messaging
│   │   └── users_me.py    # Current user profile & files
│   └── services/          # Business logic
│       ├── owncloud_client.py  # ownCloud WebDAV + OCS wrapper
│       ├── ingestion.py        # Document ingestion pipeline
│       ├── chunker.py          # Text chunking
│       ├── document_parser.py  # PDF/DOCX/XLSX parsing
│       ├── vector_store.py     # ChromaDB vector operations
│       ├── llm_service.py      # Google Gemini integration
│       └── chat_service.py     # Conversation persistence
├── alembic/               # Database migrations
├── tests/                 # Pytest test suite
├── Dockerfile
└── requirements.txt
```

## Default Admin

On first startup via Docker, ownCloud auto-creates an admin user:
- Username: `admin`
- Password: `admin`
