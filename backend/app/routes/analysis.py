from fastapi import APIRouter, HTTPException
from app.models.schemas import AnalysisRequest, AnalysisResponse
from app.services.image_service import image_service
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

router = APIRouter()

@router.post("/analyze_image", response_model=AnalysisResponse)
async def analyze_image(request: AnalysisRequest):
    """Analyze an image and extract relevant tags/description."""
    try:
        logger.info(f"Image analysis request received - Type: {request.media_type}")
        
        if request.media_type != "image":
            raise HTTPException(status_code=400, detail="Endpoint only supports images")
        
        result = await image_service.analyze_image(
            media_url=request.media_url,
            media_base64=request.media_base64
        )
        
        logger.info(f"Image analysis completed - Success: {result.success}")
        return result
        
    except Exception as e:
        logger.error(f"Image analysis endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))