from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routes.analysis import router as analysis_router
from app.routes.summarization import router as summarization_router
from app.models.schemas import HealthResponse
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-powered backend API for social media content filtering and summarization using Gemini",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analysis_router, prefix=settings.API_V1_STR)
app.include_router(summarization_router, prefix=settings.API_V1_STR)
 

@app.get("/")
async def root():
    return {
        "message": "Social Media Filter API is running",
        "version": "1.0.0",
        "ai_provider": "Google Gemini",
        "endpoints": {
            "documentation": "/docs",
            "health_check": "/health",
            "analyze_image": "/api/v1/analyze_image",
            "summarize": "/api/v1/summarize"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        ai_services={
            "gemini_configured": bool(settings.GEMINI_API_KEY),
            "api_ready": True
        }
    )

@app.on_event("startup")
async def startup_event():
    logger.info("Starting Social Media Filter API with Gemini integration")
    if settings.GEMINI_API_KEY:
        logger.info("Gemini API is configured")
    else:
        logger.warning("Gemini API key not configured - some features will not work")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Social Media Filter API")