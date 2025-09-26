import tempfile
import os
import base64
from typing import List, Optional
from app.models.schemas import Tag, VideoAnalysisResponse, AnalysisResponse
from app.services.ai_service import ai_service
from app.services.image_service import image_service
from app.utils.file_utils import download_file, get_file_type, validate_file_size
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

class VideoService:
    async def analyze_video(self, video_url: Optional[str] = None,
                          video_base64: Optional[str] = None,
                          extract_frames: int = 3,
                          include_transcription: bool = False) -> VideoAnalysisResponse:
        """Analyze video by extracting frames using Gemini API."""
        try:
            # Download video
            if video_url:
                logger.info(f"Downloading video from URL: {video_url}")
                video_content = await download_file(video_url)
            elif video_base64:
                logger.info("Processing base64 video data")
                if video_base64.startswith('data:video'):
                    video_base64 = video_base64.split(',')[1]
                video_content = base64.b64decode(video_base64)
            else:
                return VideoAnalysisResponse(
                    success=False,
                    frame_analyses=[],
                    summary_tags=[],
                    error="No video data provided"
                )

            # Validate file size and type
            if not validate_file_size(video_content):
                return VideoAnalysisResponse(
                    success=False,
                    frame_analyses=[],
                    summary_tags=[],
                    error="File size exceeds limit"
                )

            file_type = get_file_type(video_content)
            if not file_type.startswith('video/'):
                return VideoAnalysisResponse(
                    success=False,
                    frame_analyses=[],
                    summary_tags=[],
                    error=f"Invalid file type: {file_type}"
                )

            # Extract frames (simplified version without complex dependencies)
            frame_data_list = await self.extract_simple_frames(video_content, extract_frames)
            
            if not frame_data_list:
                return VideoAnalysisResponse(
                    success=False,
                    frame_analyses=[],
                    summary_tags=[],
                    error="Could not extract frames from video"
                )

            # Analyze frames
            frame_analyses = []
            for i, frame_data in enumerate(frame_data_list):
                logger.info(f"Analyzing frame {i+1}/{len(frame_data_list)}")
                analysis = await image_service.analyze_image(media_base64=frame_data)
                frame_analyses.append(analysis)

            # Generate summary tags
            summary_tags = await self.generate_summary_tags(frame_analyses)

            return VideoAnalysisResponse(
                success=True,
                frame_analyses=frame_analyses,
                transcription=None,  # Audio transcription removed for simplicity
                summary_tags=summary_tags
            )

        except Exception as e:
            logger.error(f"Video analysis error: {str(e)}")
            return VideoAnalysisResponse(
                success=False,
                frame_analyses=[],
                summary_tags=[],
                error=f"Video analysis failed: {str(e)}"
            )

    async def extract_simple_frames(self, video_content: bytes, num_frames: int) -> List[str]:
        """Simple frame extraction that returns base64 encoded frames."""
        try:
            # For now, return a placeholder since video processing requires additional dependencies
            # In a real implementation, you would use OpenCV or similar
            logger.warning("Video frame extraction not fully implemented. Using placeholder.")
            
            # Return empty list - actual implementation would extract frames
            # This is a placeholder for the real implementation
            return []
            
        except Exception as e:
            logger.warning(f"Frame extraction failed: {str(e)}")
            return []

    async def generate_summary_tags(self, frame_analyses: List[AnalysisResponse]) -> List[Tag]:
        """Generate summary tags from frame analyses."""
        try:
            # Combine all tags from successful frame analyses
            all_tags = []
            for analysis in frame_analyses:
                if analysis.success:
                    all_tags.extend(analysis.tags)

            if not all_tags:
                return [
                    Tag(label="video", confidence=0.9, category="media"),
                    Tag(label="content", confidence=0.7, category="general")
                ]

            # Simple tag aggregation
            tag_counts = {}
            for tag in all_tags:
                key = (tag.label, tag.category)
                if key in tag_counts:
                    tag_counts[key] = max(tag_counts[key], tag.confidence)
                else:
                    tag_counts[key] = tag.confidence

            # Convert to Tag objects and sort by confidence
            summary_tags = [
                Tag(label=label, category=category, confidence=confidence)
                for (label, category), confidence in sorted(
                    tag_counts.items(), key=lambda x: x[1], reverse=True
                )[:10]  # Top 10 tags
            ]

            return summary_tags

        except Exception as e:
            logger.error(f"Summary tag generation failed: {str(e)}")
            return [Tag(label="error", confidence=0.1, category="system")]

# Global video service instance
video_service = VideoService()