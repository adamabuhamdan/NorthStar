from typing import Optional
import base64
from app.models.schemas import Tag, AnalysisResponse
from app.services.ai_service import ai_service
from app.utils.file_utils import download_file, validate_file_size, get_file_type
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

class ImageService:
    async def analyze_image(self, media_url: Optional[str] = None, 
                          media_base64: Optional[str] = None) -> AnalysisResponse:
        try:
            image_content = None
            
            if media_url:
                image_content = await download_file(media_url)
            elif media_base64:
                image_content = base64.b64decode(media_base64.split(',')[-1])
            else:
                return AnalysisResponse(success=False, tags=[], error="No image data provided")

            if not validate_file_size(image_content):
                return AnalysisResponse(success=False, tags=[], error="File size exceeds limit")

            file_type = get_file_type(image_content)
            if not file_type.startswith('image/'):
                return AnalysisResponse(success=False, tags=[], error=f"Invalid file type: {file_type}")

            analysis_result = await ai_service.analyze_image_gemini(image_content, media_url)

            tags = [
                Tag(label=tag.get('label', 'unknown'),
                    confidence=float(tag.get('confidence', 0.5)),
                    category=tag.get('category', 'general'))
                for tag in analysis_result.get('tags', [])
            ]

            return AnalysisResponse(
                success=True,
                tags=tags,
                description=analysis_result.get('description')
            )

        except Exception as e:
            logger.error(f"Image analysis error: {str(e)}")
            return AnalysisResponse(success=False, tags=[], error=f"Analysis failed: {str(e)}")

image_service = ImageService()