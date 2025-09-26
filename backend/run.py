#!/usr/bin/env python3
"""
Social Media Filter API Runner
"""
import uvicorn
from app.main import app

if __name__ == "__main__":
    print(" Starting Social Media Filter API with Gemini...")
    print(" API Documentation: http://localhost:8000/docs")
    print(" Press Ctrl+C to stop the server")
    
    uvicorn.run(
        "app.main:app",  # تغيير هنا: استخدام نص الاستيراد بدلاً من الكائن المباشر
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )