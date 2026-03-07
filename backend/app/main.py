from fastapi import FastAPI

from app.api.v1.router import router

app = FastAPI(
    title="Aiyedun Enterprise AI",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(router)
