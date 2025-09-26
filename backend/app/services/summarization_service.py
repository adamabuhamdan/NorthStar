from typing import List
from app.models.schemas import SummarizationResponse
from app.services.ai_service import ai_service
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

class SummarizationService:
    async def summarize_posts(self, posts: List[str], max_length: int = 150) -> SummarizationResponse:
        """Summarize a list of social media posts using Gemini API."""
        try:
            if not posts:
                return SummarizationResponse(
                    success=False,
                    summary="",
                    key_points=[],
                    total_posts_processed=0,
                    error="No posts provided for summarization"
                )

            # Combine posts into a single text
            combined_text = "\n\n".join(posts)
            
            # Limit text length to avoid token limits
            if len(combined_text) > 10000:
                combined_text = combined_text[:10000] + "... [truncated]"

            logger.info(f"Summarizing {len(posts)} posts with Gemini API")

            # Use Gemini API for summarization
            result = await ai_service.summarize_text_gemini(combined_text, max_length)

            return SummarizationResponse(
                success=True,
                summary=result.get("summary", "Summary not available."),
                key_points=result.get("key_points", []),
                total_posts_processed=len(posts)
            )

        except Exception as e:
            logger.error(f"Summarization error: {str(e)}")
            return SummarizationResponse(
                success=False,
                summary="",
                key_points=[],
                total_posts_processed=0,
                error=f"Summarization failed: {str(e)}"
            )

# Global summarization service instance
summarization_service = SummarizationService()