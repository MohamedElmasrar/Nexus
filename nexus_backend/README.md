# Nexus Backend

FastAPI REST API for the Nexus document management platform. Provides authentication, user/group management, file operations, projects collaboration, and AI-powered document analysis and Q&A — backed by ownCloud for file storage, PostgreSQL for session metadata, ChromaDB for vector storage, and Google Gemini.

---

## Tech Stack

- **Framework**: FastAPI (Python 3.12)
- **Database**: PostgreSQL 16 + SQLAlchemy 2.x + Alembic
- **Auth**: JWT (python-jose) + Fernet encryption for ownCloud credentials
- **Storage**: ownCloud 10 (WebDAV + OCS Provisioning API)
- **AI / RAG**: Google Gemini (via `google-genai` SDK: `gemini-2.5-flash` for completions/summaries, `gemini-embedding-2` for text embedding), ChromaDB (in-process persistent vector store)
- **Containerization**: Docker + Docker Compose

---

## Quick Start

### Docker (Recommended)

1. Copy settings template:
   ```bash
   cp .env.example .env
   # Edit .env and supply your GEMINI_API_KEY
   ```
2. Build and start containers:
   ```bash
   docker-compose up --build -d
   ```

The API server runs on port `8000`. Interactive documentation is available at [http://localhost:8000/docs](http://localhost:8000/docs).

### Local Development

1. Create virtual environment and activate:
   ```bash
   # Windows
   python -m venv .venv
   .venv\Scripts\activate

   # macOS / Linux
   python -m venv .venv
   source .venv/bin/activate
   ```
2. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```
3. Initialize PostgreSQL and configure `.env`:
   ```bash
   cp .env.example .env
   # Edit .env with your local PostgreSQL DATABASE_URL
   ```
4. Run migrations:
   ```bash
   alembic upgrade head
   ```
5. Start the Uvicorn server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

---

## API Endpoints

### Authentication
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/login` | Public | Authenticate credentials via ownCloud, retrieve JWT |

### Admin — Users & Groups (ownCloud OCS API)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/admin/users/` | Admin | List ownCloud users |
| `GET` | `/api/v1/admin/users/{username}` | Admin | Get user details |
| `GET` | `/api/v1/admin/groups/` | Admin | List ownCloud groups |
| `POST` | `/api/v1/admin/groups/` | Admin | Create a new ownCloud group |
| `DELETE` | `/api/v1/admin/groups/{group_id}` | Admin | Delete an ownCloud group |
| `POST` | `/api/v1/admin/groups/{gid}/users/{uid}` | Admin | Add user to group |
| `DELETE` | `/api/v1/admin/groups/{gid}/users/{uid}` | Admin | Remove user from group |

### Admin — Files & Sharing (ownCloud WebDAV)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/admin/files/browse` | Admin | Browse all shared files |
| `POST` | `/api/v1/admin/files/upload` | Admin | Upload a file to general storage |
| `GET` | `/api/v1/admin/files/download` | Admin | Download a general storage file |
| `POST` | `/api/v1/admin/files/folder` | Admin | Create a folder |
| `DELETE` | `/api/v1/admin/files/` | Admin | Delete a file or folder |
| `GET` | `/api/v1/admin/files/shares` | Admin | List active file shares |
| `POST` | `/api/v1/admin/files/share` | Admin | Create file share |
| `DELETE` | `/api/v1/admin/files/share/{id}` | Admin | Revoke share |

### Current User
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/users/me/` | User | Get current user profile information |
| `GET` | `/api/v1/users/me/groups` | User | List groups the user belongs to |
| `GET` | `/api/v1/users/me/files` | User | Browse user's ownCloud folder |
| `GET` | `/api/v1/users/me/files/download` | User | Download user's file |
| `POST` | `/api/v1/users/me/files/upload` | User | Upload a file (auto-triggers RAG indexing) |
| `DELETE` | `/api/v1/users/me/files` | User | Delete a file |
| `POST` | `/api/v1/users/me/files/folder` | User | Create a directory |
| `GET` | `/api/v1/users/me/files/summary` | User | Get/generate AI summary, key takeaways, and tags |
| `GET` | `/api/v1/users/me/files/search` | User | Search document contents via vector similarity |
| `GET` | `/api/v1/users/me/favorites` | User | List bookmarked favorite files |
| `POST` | `/api/v1/users/me/favorites` | User | Bookmark a file as favorite |
| `DELETE` | `/api/v1/users/me/favorites` | User | Remove file from favorites |
| `GET` | `/api/v1/users/me/recent-views` | User | List recently viewed files |
| `POST` | `/api/v1/users/me/recent-views` | User | Record a file view event |
| `DELETE` | `/api/v1/users/me/recent-views` | User | Clear all file view records |

### AI & Indexing (RAG Pipeline)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/v1/ai/index` | Admin | Manually index an ownCloud file for Q&A |
| `POST` | `/api/v1/ai/index-all` | Admin | Index all unsynced files in directory recursively |
| `GET` | `/api/v1/ai/index` | Admin | List all indexed files in the vector store |
| `DELETE` | `/api/v1/ai/index` | Admin | Remove a file's embeddings from the index |
| `GET` | `/api/v1/ai/search` | Admin | Direct vector query tool (admin sandbox) |

### AI Chat Q&A
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/chat/conversations` | User | List chat sessions |
| `POST` | `/api/v1/chat/conversations` | User | Create a new chat conversation |
| `GET` | `/api/v1/chat/conversations/{id}` | User | Get conversation details and message list |
| `PATCH` | `/api/v1/chat/conversations/{id}` | User | Update conversation title |
| `DELETE` | `/api/v1/chat/conversations/{id}` | User | Delete conversation and messages |
| `POST` | `/api/v1/chat/conversations/{id}/ask` | User | Send a message (text + images) and get AI response |

### Projects Collaboration
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/projects/` | User | List projects (filtered by user group membership) |
| `POST` | `/api/v1/projects/` | Admin | Create a new project linked to an ownCloud group & shared directory |
| `GET` | `/api/v1/projects/{project_id}` | User | Get project details, including group members list |
| `DELETE` | `/api/v1/projects/{project_id}` | Admin | Delete a project registry entry |
| `GET` | `/api/v1/projects/{project_id}/files` | User | Browse files in a project's shared directory |
| `POST` | `/api/v1/projects/{project_id}/files/upload` | User | Upload a file to project folder (auto-indexes for RAG) |
| `POST` | `/api/v1/projects/{project_id}/files/folder` | User | Create a subfolder in the project folder |

### Health Check
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/v1/health` | Public | Check service status |

---

## Testing

Verify operations using Pytest:
```bash
pytest tests/ -v
```

---

## Project Structure

```
nexus_backend/
├── app/
│   ├── core/              # Config, security, JWT dependencies
│   ├── models/            # SQLAlchemy database models
│   │   ├── conversation.py# Conversations & messages models
│   │   ├── file_sync.py   # Vector sync registry & metadata cache
│   │   ├── project.py     # Team collaboration structures
│   │   ├── favorite.py    # Bookmark definitions
│   │   └── recent_view.py # History tracking
│   ├── schemas/           # Pydantic schema validation models
│   ├── routers/           # FastAPI controller routes
│   │   ├── auth.py        # Authentication handlers
│   │   ├── admin_users.py # User provisioners
│   │   ├── admin_groups.py# Group provisioners
│   │   ├── admin_files.py # Admin WebDAV interfaces
│   │   ├── users_me.py    # User WebDAV, bookmarks, summaries, search
│   │   ├── ai.py          # Embedding sync handlers
│   │   ├── chat.py        # Conversations endpoints
│   │   └── projects.py    # Team workspace handlers
│   └── services/          # Business logic providers
│       ├── owncloud_client.py # HTTP client wrapping WebDAV + OCS
│       ├── ingestion.py       # File sync pipeline orchestrator
│       ├── document_parser.py # File parsers (PDF, DOCX, XLSX, TXT)
│       ├── chunker.py         # Text chunk builder
│       ├── vector_store.py    # ChromaDB engine wrapper
│       └── llm_service.py     # Google Gemini API caller
│
├── alembic/               # Database migration files
├── tests/                 # pytest unit testing suite
├── Dockerfile             # Container definition
└── requirements.txt       # Dependency listing
```

---

## Default Admin

Upon initial database seeding (on first startup), an default administrator credential is created:
- **Username**: `admin`
- **Password**: `admin`
- **Email**: `admin@nexus.local`

> [!NOTE]
> This matches the seeded account in ownCloud. Be sure to configure safe credentials for public deployments.
