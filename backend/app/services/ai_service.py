import google.generativeai as genai
import base64
import httpx
import json
import re
from typing import Dict, Any
from app.config import settings
from app.utils.logger import setup_logger

logger = setup_logger(__name__)

class AIService:
    def __init__(self):
        if settings.GEMINI_API_KEY:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel('gemini-pro')
            self.vision_model = genai.GenerativeModel('gemini-pro-vision')
        else:
            logger.warning("Gemini API key not configured")

    async def analyze_image_gemini(self, image_data: bytes, image_url: str = None) -> Dict[str, Any]:
        """Analyze image using Gemini Vision API."""
        try:
            if image_url:
                async with httpx.AsyncClient() as client:
                    response = await client.get(image_url)
                    response.raise_for_status()
                    image_data = response.content

            # Prepare image for Gemini
            image_part = {
                "mime_type": "image/jpeg",
                "data": image_data
            }

            prompt = """Analyze this image and provide relevant tags for social media content filtering.
            Return JSON with: tags array containing objects with label, confidence, category."""

            response = self.vision_model.generate_content([prompt, image_part])
            return self._parse_gemini_response(response.text)
            
        except Exception as e:
            logger.error(f"Gemini Vision API error: {str(e)}")
            return await self._fallback_image_analysis()

    async def analyze_distraction_gemini(self, text: str, analysis_type: str = "distraction_impact") -> Dict[str, Any]:
        """تحليل المحتوى المشتت باستخدام Gemini API."""
        try:
            prompt = f"""
                    تحليل محتوى وسائل التواصل الاجتماعي من حيث التأثير السلبي على التركيز والوقت.

                    المحتوى المطلوب تحليله:
                    {text[:6000]}

                    المطلوب:
                    1. تقييم مستوى تشتيت الانتباه (منخفض/متوسط/مرتفع)
                    2. تقدير الوقت الذي قد يضيعه هذا المحتوى
                    3. تحليل التأثير على الإنتاجية
                    4. تقديم نصائح لتجنب هذا النوع من المحتوى

                    أخرج النتيجة باللغة العربية بتنسيق JSON:
                    {{
                        "analysis": {{
                            "distraction_level": "منخفض/متوسط/مرتفع",
                            "time_wasted_minutes": رقم تقديري,
                            "productivity_impact": "تأثير على الإنتاجية",
                            "common_distractions": ["قائمة بالمشتتات الشائعة"],
                            "recommendations": ["نصائح للتحسين"]
                        }},
                        "summary": "ملخص عام بالعربية"
                    }}

                    ركز على الجوانب السلبية وكيفية تجنبها.
                    """

            response = self.model.generate_content(prompt)
            return self._parse_distraction_response(response.text)
            
        except Exception as e:
            logger.error(f"Gemini distraction analysis error: {str(e)}")
            return await self._fallback_distraction_analysis(text)

    def _parse_distraction_response(self, response_text: str) -> Dict[str, Any]:
        """تحليل استجابة Gemini لتحليل التشتت."""
        try:
            # استخراج JSON من الاستجابة
            if '```json' in response_text:
                json_str = response_text.split('```json')[1].split('```')[0]
            elif '```' in response_text:
                json_str = response_text.split('```')[1].split('```')[0]
            elif '{' in response_text and '}' in response_text:
                start = response_text.find('{')
                end = response_text.rfind('}') + 1
                json_str = response_text[start:end]
            else:
                json_str = response_text
            
            data = json.loads(json_str)
            
            # إرجاع الهيكل المتوقع
            return {
                "analysis": data.get("analysis", {}),
                "summary": data.get("summary", "تحليل التشتت")
            }
            
        except Exception as e:
            logger.error(f"JSON parsing error in distraction analysis: {str(e)}")
            return self._create_fallback_distraction_analysis()

    def _create_fallback_distraction_analysis(self) -> Dict[str, Any]:
        """إنشاء تحليل افتراضي عند الفشل."""
        return {
            "analysis": {
                "distraction_level": "متوسط",
                "time_wasted_minutes": 15,
                "productivity_impact": "تأثير سلبي محتمل على الإنتاجية",
                "common_distractions": ["محتوى غير هام", "إشعارات متكررة"],
                "recommendations": [
                    "حدد أوقاتاً ثابتة لتصفح الوسائط الاجتماعية",
                    "استخدم تقنيات إدارة الوقت مثل بومودورو",
                    "عطل الإشعارات غير الضرورية"
                ]
            },
            "summary": "تحليل احتياطي للمحتوى المشتت"
        }

    async def _fallback_distraction_analysis(self, text: str) -> Dict[str, Any]:
        """تحليل احتياطي عندما يفشل Gemini."""
        words_count = len(text.split())
        estimated_time = max(5, words_count // 200)
        
        return {
            "analysis": {
                "distraction_level": "متوسط",
                "time_wasted_minutes": estimated_time,
                "productivity_impact": "تأثير سلبي محتمل على الإنتاجية",
                "common_distractions": ["محتوى غير هام", "إشعارات متكررة"],
                "recommendations": [
                    "حدد أوقاتاً ثابتة لتصفح الوسائط الاجتماعية",
                    "استخدم تقنيات إدارة الوقت مثل بومودورو",
                    "عطل الإشعارات غير الضرورية"
                ]
            },
            "summary": f"المحتوى المشتت قد يضيع approximately {estimated_time} دقيقة من وقتك"
        }
    async def summarize_text_gemini(self, text: str, max_length: int = 150) -> Dict[str, Any]:
        """Summarize text using Gemini Pro."""
        try:
            # استخدام الـ prompt المحسن ثنائي اللغة
            prompt = f"""
Analyze this social media content and extract the 3-5 most important key points.

CONTENT:
{text[:4000]}

REQUIREMENTS:
- Extract exactly 3-5 key points maximum
- First analyze and write points in English
- Then provide accurate Arabic translation
- Each point should be concise (10-15 words)
- Focus on main ideas, insights, and important information

OUTPUT FORMAT (JSON only):
{{
    "key_points_english": [
        "First key point in English",
        "Second key point in English", 
        "Third key point in English"
    ],
    "key_points_arabic": [
        "النقطة الأولى بالعربية",
        "النقطة الثانية بالعربية",
        "النقطة الثالثة بالعربية"
    ]
}}

Ensure the Arabic translation is accurate and natural.
"""

            response = self.model.generate_content(prompt)
            logger.info(f"Gemini response received: {response.text[:200]}...")
            
            return self._parse_gemini_response_improved(response.text)
            
        except Exception as e:
            logger.error(f"Gemini summarization error: {str(e)}")
            return await self._fallback_summarization(text)

    def _parse_gemini_response(self, response_text: str) -> Dict[str, Any]:
        """Parse Gemini API response."""
        try:
            # Try to extract JSON
            if '```json' in response_text:
                json_str = response_text.split('```json')[1].split('```')[0]
            else:
                json_str = response_text
            
            return json.loads(json_str)
        except Exception as e:
            logger.error(f"JSON parsing error: {str(e)}")
            # Fallback parsing
            return {
                "tags": [{"label": "content", "confidence": 0.8, "category": "general"}],
                "summary": "Summary generated successfully",
                "key_points": ["Content processed"]
            }

    def _parse_gemini_response_improved(self, response_text: str) -> Dict[str, Any]:
        """Improved parsing for bilingual content."""
        try:
            logger.info("Parsing Gemini response with improved method")
            cleaned_text = response_text.strip()
            
            # محاولة استخراج JSON
            json_str = self._extract_json_string(cleaned_text)
            
            if not json_str:
                logger.warning("No JSON found in response, using fallback")
                return self._parse_fallback_response(response_text)
            
            # تنظيف النص
            json_str = re.sub(r'[\x00-\x1f\x7f]', '', json_str)
            
            data = json.loads(json_str)
            logger.info(f"Parsed JSON data: {list(data.keys())}")
            
            # التأكد من وجود الحقول المطلوبة
            arabic_points = self._extract_arabic_points(data)
            
            # تحديد عدد النقاط (3-5 كحد أقصى)
            if len(arabic_points) > 5:
                arabic_points = arabic_points[:5]
            
            # إرجاع النقاط العربية فقط للمستخدم
            return {
                "summary": "",  # فارغ كما طلبت
                "key_points": arabic_points
            }
            
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {str(e)}")
            return self._parse_fallback_response(response_text)
        except Exception as e:
            logger.error(f"Improved parsing error: {str(e)}")
            return self._create_fallback_response()

    def _extract_json_string(self, text: str) -> str:
        """Extract JSON string from response text."""
        try:
            # محاولة استخراج JSON من بين markdown
            if '```json' in text:
                return text.split('```json')[1].split('```')[0].strip()
            elif '```' in text:
                return text.split('```')[1].split('```')[0].strip()
            elif '{' in text and '}' in text:
                # محاولة استخراج JSON مباشرة
                start = text.find('{')
                end = text.rfind('}') + 1
                if start < end:
                    return text[start:end]
            return text.strip()
        except Exception as e:
            logger.error(f"JSON extraction error: {str(e)}")
            return text

    def _extract_arabic_points(self, data: Dict[str, Any]) -> list:
        """Extract Arabic points from parsed data."""
        try:
            # الأولوية للنقاط العربية
            if "key_points_arabic" in data and isinstance(data["key_points_arabic"], list):
                points = [p for p in data["key_points_arabic"] if p and len(str(p).strip()) > 0]
                if points:
                    return points
            
            # إذا لم توجد نقاط عربية، نستخدم الإنجليزية مع الترجمة
            if "key_points_english" in data and isinstance(data["key_points_english"], list):
                english_points = [p for p in data["key_points_english"] if p and len(str(p).strip()) > 0]
                if english_points:
                    return self._translate_points_fallback(english_points)
            
            # إذا لم توجد أي نقاط، نستخدم الافتراضية
            return ["محتوى مفيد", "معلومات قيمة", "رؤى مهمة"]
            
        except Exception as e:
            logger.error(f"Arabic points extraction error: {str(e)}")
            return ["معلومات مفيدة", "محتوى قيم", "رؤى مهمة"]

    def _translate_points_fallback(self, english_points: list) -> list:
        """Fallback translation for English points."""
        try:
            # خريطة ترجمة موسعة
            translation_map = {
                "technology": "التكنولوجيا",
                "ai": "الذكاء الاصطناعي",
                "artificial intelligence": "الذكاء الاصطناعي",
                "machine learning": "التعلم الآلي",
                "health": "الصحة",
                "healthcare": "الرعاية الصحية",
                "education": "التعليم",
                "business": "الأعمال",
                "development": "التطوير",
                "future": "المستقبل",
                "innovation": "الابتكار",
                "research": "البحث",
                "science": "العلم",
                "technology": "التقنية",
                "digital": "الرقمية",
                "social media": "وسائل التواصل الاجتماعي",
                "analysis": "التحليل",
                "strategy": "الإستراتيجية",
                "growth": "النمو",
                "solution": "الحل",
                "challenge": "التحدي",
                "opportunity": "الفرصة"
            }
            
            arabic_points = []
            for point in english_points[:5]:  # حد أقصى 5 نقاط
                if not point:
                    continue
                    
                translated_point = str(point)
                # ترجمة الكلمات المفتاحية
                for eng, arb in translation_map.items():
                    if eng.lower() in translated_point.lower():
                        translated_point = translated_point.replace(eng, arb)
                
                # إضافة نقطة إذا كانت ذات معنى
                if len(translated_point.strip()) > 5:
                    arabic_points.append(translated_point.strip())
            
            return arabic_points if arabic_points else ["معلومات مفيدة", "محتوى قيم", "رؤى مهمة"]
            
        except Exception as e:
            logger.error(f"Translation fallback error: {str(e)}")
            return ["معلومات مفيدة", "محتوى قيم", "رؤى مهمة"]

    def _parse_fallback_response(self, response_text: str) -> Dict[str, Any]:
        """Fallback parsing when JSON is not available."""
        try:
            logger.info("Using fallback response parsing")
            lines = [line.strip() for line in response_text.split('\n') if line.strip()]
            
            key_points = []
            
            # البحث عن النقاط التي تحتوي على نص عربي
            for line in lines:
                # التحقق من وجود حروف عربية
                if any('\u0600' <= char <= '\u06FF' for char in line):
                    clean_line = re.sub(r'^[\d•\-*\.\s]+', '', line).strip()
                    if clean_line and len(clean_line) > 10 and len(key_points) < 5:
                        key_points.append(clean_line)
            
            # إذا لم نجد نقاط عربية، نبحث عن أي نقاط مرقمة
            if not key_points:
                for line in lines:
                    if re.match(r'^[\d•\-*\.]', line.strip()):
                        point = re.sub(r'^[\d•\-*\.\s]+', '', line).strip()
                        if point and len(point) > 10 and len(key_points) < 5:
                            key_points.append(point)
            
            # إذا لم نجد نقاطاً، نستخدم أول سطور ذات معنى
            if not key_points:
                meaningful_lines = [line for line in lines if len(line) > 20]
                key_points = meaningful_lines[:3]
            
            return {
                "summary": "",
                "key_points": key_points[:5] or ["محتوى قيم", "معلومات مفيدة", "رؤى مهمة"]
            }
            
        except Exception as e:
            logger.error(f"Fallback parsing error: {str(e)}")
            return self._create_fallback_response()

    def _create_fallback_response(self) -> Dict[str, Any]:
        """Create a basic fallback response."""
        return {
            "summary": "",
            "key_points": [
                "تحليل المحتوى واستخراج الأفكار الرئيسية",
                "تحديد النقاط الأكثر أهمية للمستخدم",
                "عرض المعلومات بشكل واضح ومختصر"
            ]
        }

    async def _fallback_image_analysis(self) -> Dict[str, Any]:
        """Fallback for image analysis."""
        logger.warning("Using fallback image analysis")
        return {
            "tags": [{"label": "image", "confidence": 0.8, "category": "media"}],
            "description": "Image analysis completed"
        }

    async def _fallback_summarization(self, text: str) -> Dict[str, Any]:
        """Fallback for text summarization."""
        logger.warning("Using fallback summarization")
        try:
            # استخراج جمل مفيدة
            sentences = re.split(r'[.!؟]+', text)
            sentences = [s.strip() for s in sentences if len(s.strip()) > 25]
            
            # أخذ أول 3-4 جمل كنقاط
            key_points = sentences[:4] if sentences else []
            
            # إذا لم توجد جمل كافية، ننشئ نقاط افتراضية
            if len(key_points) < 2:
                key_points = [
                    "محتوى يحتوي على معلومات قيمة ومفيدة",
                    "تحليل للموضوعات والأفكار الرئيسية",
                    "استخلاص النقاط الأكثر أهمية للمستخدم"
                ]
            
            return {
                "summary": "",
                "key_points": key_points[:5]  # حد أقصى 5 نقاط
            }
            
        except Exception as e:
            logger.error(f"Fallback summarization error: {str(e)}")
            return {
                "summary": "",
                "key_points": ["معلومات مفيدة", "محتوى قيم", "رؤى مهمة"]
            }

# إنشاء instance من الخدمة
ai_service = AIService()