from pydantic import BaseModel, HttpUrl, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class MediaType(str, Enum):
    IMAGE = "image"
    VIDEO = "video"

class AnalysisRequest(BaseModel):
    media_url: Optional[HttpUrl] = None
    media_base64: Optional[str] = None
    media_type: MediaType
class DistractionAnalysisRequest(BaseModel):
    posts: List[str] = Field(..., min_items=1)
    analysis_type: str = Field(default="distraction_impact")

class DistractionAnalysisResponse(BaseModel):
    success: bool
    analysis: Dict[str, Any]
    error: Optional[str] = None
class SummarizationRequest(BaseModel):
    posts: List[str] = Field(..., min_items=1)
    max_length: int = Field(default=150, ge=50, le=500)

class Tag(BaseModel):
    label: str
    confidence: float
    category: str

class AnalysisResponse(BaseModel):
    success: bool
    tags: List[Tag]
    description: Optional[str] = None
    error: Optional[str] = None

class SummarizationResponse(BaseModel):
    success: bool
    summary: str
    key_points: List[str]
    total_posts_processed: int
    error: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    version: str
    ai_services: Dict[str, bool]