"""API local HeatCity: catálogo, PDI e localização de placas em quadros de vídeo."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from .catalog import router as catalog_router
from .sign_api import router as sign_router


@asynccontextmanager
async def lifespan(app):
    from .seed import seed_hospital

    seed_hospital()
    yield


app = FastAPI(title="HeatCity — placas em vídeo", version="2.0.0", lifespan=lifespan)
app.include_router(catalog_router)
app.include_router(sign_router)


@app.get("/health")
def health():
    return {"service": "HeatCity", "status": "ok", "version": "2.0.0"}


@app.middleware("http")
async def request_limit(request, call_next):
    if request.method in ("POST", "PUT", "PATCH") and len(await request.body()) > 8_000_000:
        return JSONResponse({"detail": "Requisição muito grande (máximo 8 MB)."}, status_code=413)
    return await call_next(request)
