from fastapi import APIRouter, HTTPException
from app.models.schemas import SummarizationRequest, SummarizationResponse, DistractionAnalysisRequest, DistractionAnalysisResponse
from app.services.summarization_service import summarization_service  # إضافة هذا
from app.services.distraction_service import distraction_service
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

router = APIRouter()

# Endpoint الحالي للمحتوى المرغوب
@router.post("/summarize", response_model=SummarizationResponse)
async def summarize_posts(request: SummarizationRequest):
    """تلخيص المحتوى المرغوب (المهم)"""
    try:
        logger.info(f"Summarization request received - Posts: {len(request.posts)}")
        
        result = await summarization_service.summarize_posts(
            posts=request.posts,
            max_length=request.max_length
        )
        
        logger.info(f"Summarization completed - Success: {result.success}")
        return result
        
    except Exception as e:
        logger.error(f"Summarization endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Endpoint الجديد للمحتوى غير المرغوب
@router.post("/analyze_distraction", response_model=DistractionAnalysisResponse)
async def analyze_distraction(request: DistractionAnalysisRequest):
    """تحليل تأثير المحتوى المشتت على التركيز"""
    try:
        logger.info(f"Distraction analysis request received - Posts: {len(request.posts)}")
        
        result = await distraction_service.analyze_distraction(
            posts=request.posts,
            analysis_type=request.analysis_type
        )
        
        logger.info(f"Distraction analysis completed - Success: {result.success}")
        return result
        
    except Exception as e:
        logger.error(f"Distraction analysis endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))