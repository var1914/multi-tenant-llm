# TokenTrail Tech Stack

Complete list of technologies, frameworks, and dependencies used in TokenTrail.

## Backend (Python)

### Core Framework
- **FastAPI** `^0.104.1` - Modern async web framework
- **Python** `3.11+` - Programming language
- **Uvicorn** - ASGI server for FastAPI
- **Pydantic** `^2.0` - Data validation using Python type hints

### Database
- **PostgreSQL** `15-alpine` - Primary database
- **SQLAlchemy** `^2.0` - ORM with async support
- **Alembic** - Database migrations
- **asyncpg** - Async PostgreSQL driver
- **psycopg2-binary** - Sync PostgreSQL driver (for Alembic)

### Caching & Queue
- **Redis** `7-alpine` - Caching and session storage
- **redis-py** - Python Redis client

### LLM Proxy
- **LiteLLM** `main-stable` - Universal LLM proxy (OpenAI, Anthropic, etc.)
- **httpx** - Async HTTP client for callbacks

### Authentication & Security
- **python-jose[cryptography]** - JWT token handling
- **passlib[bcrypt]** - Password hashing
- **python-multipart** - Form data parsing

### Dependencies
```txt
# backend/requirements.txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
alembic==1.12.1
asyncpg==0.29.0
psycopg2-binary==2.9.9
pydantic==2.5.0
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
redis==5.0.1
httpx==0.25.2
```

## Frontend (React/TypeScript)

### Core Framework
- **React** `^18.2.0` - UI library
- **TypeScript** `^5.2.2` - Type-safe JavaScript
- **Vite** `^5.0.0` - Build tool and dev server
- **React Router DOM** `^6.20.0` - Client-side routing

### State Management & Data Fetching
- **TanStack Query (React Query)** `^5.0.0` - Server state management
- **Zustand** `^4.4.0` - Client state management
- **Axios** - HTTP client

### UI & Styling
- **Tailwind CSS** `^3.3.0` - Utility-first CSS
- **Headless UI** `^1.7.0` - Unstyled UI components
- **Heroicons** `^2.0.0` - Icon library
- **React Hot Toast** `^2.4.0` - Toast notifications

### Charts & Visualization
- **Recharts** `^2.10.0` - React chart library

### Dependencies
```json
// frontend/package.json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@tanstack/react-query": "^5.0.0",
    "zustand": "^4.4.0",
    "axios": "^1.6.0",
    "react-hot-toast": "^2.4.0",
    "recharts": "^2.10.0",
    "@headlessui/react": "^1.7.0",
    "@heroicons/react": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.2.2",
    "vite": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
}
```

## Infrastructure & DevOps

### Containerization
- **Docker** - Containerization platform
- **Docker Compose** - Multi-container orchestration
- **PostgreSQL** `15-alpine` Docker image
- **Redis** `7-alpine` Docker image
- **LiteLLM** `ghcr.io/berriai/litellm:main-stable` Docker image

### Reverse Proxy & Load Balancing
- **Nginx** (for production) - Reverse proxy and static file serving
- **PgBouncer** - PostgreSQL connection pooling

### Cloud Infrastructure (Terraform)
- **Terraform** - Infrastructure as Code
- **AWS**:
  - EC2 (t3.small) - Application server
  - RDS PostgreSQL (db.t3.micro) - Managed database
  - VPC - Network isolation
  - Security Groups - Firewall rules
  - Optional NAT Gateway - Outbound internet for private subnet

### Deployment
- **Gunicorn** - WSGI HTTP server for Python
- **Systemd** - Service management (production)

## Documentation

### Docs Site
- **VitePress** `^1.0.0` - Static site generator for docs
- **Vue** `^3.3.0` - VitePress framework dependency
- **Markdown** - Documentation format

### Dependencies
```json
// docs-site/package.json
{
  "devDependencies": {
    "vitepress": "^1.0.0",
    "vue": "^3.3.0"
  }
}
```

## Testing (Future)

### Backend Testing
- **pytest** - Python testing framework
- **pytest-asyncio** - Async test support
- **httpx** - For API testing

### Frontend Testing
- **Vitest** - Vite-native test runner
- **React Testing Library** - Component testing
- **Playwright** - E2E testing

### E2E Testing
- **Playwright** `^1.40.0` - End-to-end testing
- Located in: `/e2e/`

## Development Tools

### Code Quality
- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **Ruff** - Python linting (fast alternative to Flake8)
- **Black** - Python code formatting

### Type Checking
- **TypeScript** - Frontend type checking
- **Pydantic** - Runtime type validation (Python)
- **mypy** - Static type checking for Python

## Third-Party Services

### LLM Providers
- **OpenAI API** - GPT-4, GPT-3.5-turbo, etc.
- **Anthropic API** - Claude 3 models
- **Azure OpenAI** - Enterprise OpenAI deployment

### Payment Processing
- **Stripe** - Payment and billing
  - `stripe` Python SDK
  - Stripe Checkout
  - Stripe Webhooks

### Monitoring (Planned)
- **Sentry** - Error tracking
- **Prometheus** - Metrics collection
- **Grafana** - Metrics visualization

## Database Schema

### Migration Tool
- **Alembic** - Database migration management

### Current Migrations
1. `001_initial_schema` - Base tables (users, tenants, api_keys)
2. `002_add_usage_events` - Usage tracking
3. `003_add_routing_decisions` - Smart routing data
4. `007_add_prediction_alerts` - Budget predictions
5. `008_add_agent_workflows` - Agentic AI tracking
6. `009_add_workflow_budgets` - Workflow cost limits
7. `010_add_outcome_pricing` - Outcome-based billing
8. `011_add_usage_events_partitioning` - Table partitioning by month
9. `012_add_performance_indexes` - Performance optimization
10. `013_add_usage_limit_blocking` - Budget limit blocking

## Environment Variables

### Required for Development
```bash
# Database
POSTGRES_USER=tokentrail
POSTGRES_PASSWORD=tokentrail_dev
POSTGRES_DB=tokentrail

# API Keys
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# JWT Secret
JWT_SECRET_KEY=your-random-secret-key

# LiteLLM
LITELLM_MASTER_KEY=sk-litellm-master-key
TOKENTRAIL_INTERNAL_API_KEY=internal-api-key
```

## System Requirements

### Development
- **Node.js** `18+` or `20+`
- **Python** `3.11+`
- **Docker** `20.10+` & Docker Compose `2.0+`
- **PostgreSQL** `15+` (or via Docker)
- **Redis** `7+` (or via Docker)

### Production (Recommended)
- **CPU**: 2+ cores
- **RAM**: 4GB+ (8GB recommended)
- **Storage**: 20GB+ SSD
- **OS**: Ubuntu 22.04 LTS or similar Linux distribution

## Build & Bundle Sizes

### Frontend Build
- **Gzipped bundle**: ~180KB
- **Uncompressed**: ~550KB
- **Build time**: ~8-12 seconds

### Docker Images
- **Backend**: ~500MB (Python + dependencies)
- **Frontend**: ~150MB (Node + Vite build)
- **LiteLLM**: ~2GB (includes ML dependencies)
- **PostgreSQL**: ~250MB (Alpine-based)
- **Redis**: ~30MB (Alpine-based)

## License

- **TokenTrail**: MIT License (or your chosen license)
- **Dependencies**: Various open-source licenses (see individual packages)

## Version History

### Current Version: 1.0.0-beta

**Latest Features:**
- Budget limits with automatic request blocking
- Smart model routing (save 40-60%)
- Per-customer usage tracking
- Real-time cost analytics
- LiteLLM proxy integration

**Upcoming:**
- Stripe billing integration (completed in backend)
- Advanced analytics dashboard
- Custom routing rules UI
- Webhook notifications
- Multi-region deployment support

## Contributing

See individual framework documentation:
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [React Docs](https://react.dev/)
- [Vite Docs](https://vitejs.dev/)
- [VitePress Docs](https://vitepress.dev/)
- [LiteLLM Docs](https://docs.litellm.ai/)

---

**Last Updated**: January 2026
**Maintained By**: TokenTrail Team
