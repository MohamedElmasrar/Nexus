# Nexus — AI-Powered Document Management Platform

Nexus is an intelligent document management platform that combines **ownCloud** file storage with a **Google Gemini**–powered RAG (Retrieval-Augmented Generation) pipeline. Users can browse, upload, and organize files through a modern dashboard, then ask natural-language questions about their documents and receive AI-generated answers with source citations.

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| **Backend** | FastAPI (Python 3.12), SQLAlchemy 2, Alembic |
| **Storage** | ownCloud 10 (WebDAV + OCS Provisioning API) |
| **AI / RAG** | Google Gemini, ChromaDB, Sentence Transformers |
| **Database** | PostgreSQL 16 |
| **Auth** | JWT (python-jose) + Fernet-encrypted ownCloud credentials |
| **Infra** | Docker Compose (PostgreSQL, ownCloud, MariaDB, Redis) |

## Architecture

```
┌─────────────────────┐     ┌──────────────────────────┐
│   Next.js Frontend  │────▶│   FastAPI Backend (API)   │
│   (port 3000)       │     │   (port 8000)             │
└─────────────────────┘     └──────┬───────────┬────────┘
                                   │           │
                    ┌──────────────┘           └──────────────┐
                    ▼                                         ▼
          ┌──────────────────┐                    ┌────────────────────┐
          │   PostgreSQL 16  │                    │   ownCloud 10      │
          │   (conversations,│                    │   (files, users,   │
          │    sync status)  │                    │    groups, shares)  │
          └──────────────────┘                    └────────────────────┘
                    │
                    ▼
          ┌──────────────────┐        ┌────────────────────┐
          │   ChromaDB       │◀───────│   Google Gemini     │
          │   (vector store) │        │   (LLM responses)   │
          └──────────────────┘        └────────────────────┘
```

## Project Structure

```
pfa2a/
├── nexus/                    # Next.js frontend
│   ├── app/                  # App Router pages
│   │   ├── admin/            # Admin dashboard (users, groups, files, drives)
│   │   ├── dashboard/        # User dashboard (file explorer, chat, settings)
│   │   ├── login/            # Login page
│   │   └── api/              # Next.js API routes (auth proxy, chat)
│   ├── components/           # React components
│   │   ├── Admin/            # Admin-specific components
│   │   ├── Chat/             # AI chat components
│   │   ├── FileExplorer/     # File browser components
│   │   ├── Sidebar/          # Navigation sidebar
│   │   └── ui/               # shadcn/ui primitives
│   ├── hooks/                # Custom React hooks (useAuth)
│   └── lib/                  # API client, utilities
│
├── nexus_backend/            # FastAPI backend
│   ├── app/
│   │   ├── core/             # Config, security, dependencies
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   ├── routers/          # API route handlers
│   │   └── services/         # Business logic & integrations
│   ├── alembic/              # Database migrations
│   ├── tests/                # Pytest test suite
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml        # Full-stack orchestration
└── .env.example              # Environment variables template
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- A [Google Gemini API Key](https://ai.google.dev/) (for AI features)

For local development without Docker:
- Node.js 20+
- Python 3.12+
- PostgreSQL 16

## Quick Start (Docker)

```bash
# 1. Clone the repository
git clone https://github.com/MohamedElmasrar/Nexus.git
cd Nexus

# 2. Set up environment variables
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY

# 3. Start all services
docker-compose up --build -d

# 4. Open the app
#    Frontend:   http://localhost:3000
#    API Docs:   http://localhost:8000/docs
#    ownCloud:   http://localhost:8080  (admin / admin)
```

## Local Development

### Backend

```bash
cd nexus_backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate       # Windows
source .venv/bin/activate    # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env — update DATABASE_URL for your local PostgreSQL

# Run migrations
alembic upgrade head

# Start the server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd nexus

# Install dependencies
npm install

# Set up environment
cp .env.example .env

# Start dev server
npm run dev
```

The frontend runs at `http://localhost:3000` and proxies API calls to `http://localhost:8000`.

## Environment Variables

See each `.env.example` file for the full list:

| Variable | Description | Required |
|---|---|---|
| `GEMINI_API_KEY` | Google Gemini API key for AI features | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `SECRET_KEY` | JWT signing secret (change in production!) | Yes |
| `OWNCLOUD_URL` | ownCloud server URL | Yes |
| `CORS_ORIGINS` | Allowed frontend origins (comma-separated) | Yes |

## Default Credentials

| Service | Username | Password |
|---|---|---|
| ownCloud Admin | `admin` | `admin` |
| PostgreSQL | `nexus` | `nexus` |

> **Note:** Change all default credentials before deploying to production.

## API Documentation

Once the backend is running, interactive API docs are available at:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Copy `.env.example` files to `.env` and fill in your values
4. Run `docker-compose up --build` to test locally
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to your branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is developed as a PFA (Projet de Fin d'Année) academic project.
