backend/app/
  main.py            # lifespan, CORS, router mounts
  database.py        # async engine, SessionLocal, settings
  routers/           # HTTP only
  services/          # business logic
  models/            # SQLAlchemy tables only
  schemas/           # Pydantic v2 models only
