from typing import List, Dict, Any
from app.models.schemas import DistractionAnalysisResponse
from app.services.ai_service import ai_service
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

class DistractionService:
    async def analyze_distraction(self, posts: List[str], analysis_type: str = "distraction_impact") -> DistractionAnalysisResponse:
        """تحليل المحتوى المشتت وتأثيره على التركيز باستخدام Gemini API."""
        try:
            if not posts:
                return DistractionAnalysisResponse(
                    success=False,
                    analysis={},
                    error="No posts provided for distraction analysis"
                )

            # دمج النصوص للتحليل
            combined_text = "\n\n".join(posts)
            
            # تحديد الطول لتجنب حدود الـ tokens
            if len(combined_text) > 8000:
                combined_text = combined_text[:8000] + "... [truncated]"

            logger.info(f"Analyzing {len(posts)} distracting posts with Gemini API")

            # استخدام Gemini API لتحليل التشتت
            result = await ai_service.analyze_distraction_gemini(combined_text, analysis_type)

            return DistractionAnalysisResponse(
                success=True,
                analysis=result  # تغيير هنا: استخدام result مباشرة بدلاً من result.get("analysis")
            )

        except Exception as e:
            logger.error(f"Distraction analysis error: {str(e)}")
            return DistractionAnalysisResponse(
                success=False,
                analysis={},
                error=f"Distraction analysis failed: {str(e)}"
            )

    def get_fallback_analysis(self, posts: List[str]) -> Dict[str, Any]:
        """تحليل احتياطي عندما يفشل الـ API"""
        distraction_count = len(posts)
        time_wasted_minutes = distraction_count * 3
        
        return {
            "summary": f"تم تحليل {distraction_count} منشور مشتت. قد يكون هذا المحتوى أضاع حوالي {time_wasted_minutes} دقيقة من وقتك.",
            "distraction_level": "medium" if distraction_count > 5 else "low",
            "time_impact": f"{time_wasted_minutes} دقيقة",
            "focus_impact": "متوسط" if distraction_count > 5 else "منخفض",
            "recommendation": "حاول تقليل الوقت الذي تقضيه في المحتوى غير المهم لتحسين إنتاجيتك."
        }

# إنشاء instance من الخدمة
distraction_service = DistractionService()