class BackgroundService {
  constructor() {
    this.API_URL = 'http://localhost:8000/api/v1';
    this.setupMessageListener();
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'generateSummary') {
        this.generateSummary(request.posts, sendResponse);
        return true; // Important for async response
      } else if (request.action === 'analyzeDistraction') {
        this.analyzeDistraction(request.ignoredPosts, sendResponse);
        return true; // Important for async response
      }
    });
  }

  async generateSummary(posts, sendResponse) {
    try {
      const postTexts = posts.map(post => post.text).filter(text => text.length > 0);
      
      if (postTexts.length === 0) {
        sendResponse({ success: false, error: 'No content to summarize' });
        return;
      }

      const summaryResult = await this.callSummarizationAPI(postTexts, 'summarize');
      
      if (summaryResult.success) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'showSummary',
            summary: summaryResult.summary || '',
            keyPoints: summaryResult.key_points || []
          }).catch(() => {
            console.log('Tab not ready for messaging');
          });
        }
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: summaryResult.error });
      }

    } catch (error) {
      console.error('Error generating summary:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async analyzeDistraction(ignoredPosts, sendResponse) {
    try {
      const ignoredTexts = ignoredPosts.map(post => post.text).filter(text => text.length > 0);
      
      if (ignoredTexts.length === 0) {
        const fallbackAnalysis = {
          summary: "🎯 لم يتم العثور على محتوى مشتت خلال هذه الجلسة - هذا ممتاز!",
          distractionLevel: "منخفض جداً 🟢",
          totalDistractions: 0,
          timeSaved: "0 دقيقة",
          focusScore: "95%",
          topics: [],
          recommendation: "حافظ على هذا المستوى الرائع من التركيز!",
          positiveImpact: "أنت تستخدم وقتك بفعالية عالية"
        };
        
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'showDistractionAnalysis',
            analysis: fallbackAnalysis
          }).catch(() => {
            console.log('Tab not ready for messaging');
          });
        }
        sendResponse({ success: true, analysis: fallbackAnalysis });
        return;
      }

      const analysisResult = await this.callDistractionAnalysisAPI(ignoredTexts);
      
      if (analysisResult.success) {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'showDistractionAnalysis',
            analysis: analysisResult.analysis
          }).catch(() => {
            console.log('Tab not ready for messaging');
          });
        }
        sendResponse({ success: true, analysis: analysisResult.analysis });
      } else {
        // استخدام الرد الافتراضي المحسن
        const fallbackAnalysis = this.getEnhancedDistractionAnalysis(ignoredPosts);
        sendResponse({ success: true, analysis: fallbackAnalysis });
      }

    } catch (error) {
      console.error('Error analyzing distraction:', error);
      const fallbackAnalysis = this.getEnhancedDistractionAnalysis(ignoredPosts);
      sendResponse({ success: true, analysis: fallbackAnalysis });
    }
  }

  async callSummarizationAPI(texts, endpoint) {
    try {
      const requestBody = endpoint === 'summarize' ? {
        posts: texts,
        max_length: 150
      } : {
        posts: texts,
        analysis_type: "distraction_impact"
      };

      const response = await fetch(`${this.API_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
      
    } catch (error) {
      console.error('API call failed:', error);
      return this.getFallbackResponse(endpoint, texts);
    }
  }

  async callDistractionAnalysisAPI(texts) {
    try {
      const response = await fetch(`${this.API_URL}/analyze_distraction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          posts: texts,
          analysis_type: "distraction_impact"
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      return { success: true, analysis: result.analysis };
      
    } catch (error) {
      console.error('Distraction analysis API call failed:', error);
      return { success: false };
    }
  }

  getEnhancedDistractionAnalysis(ignoredPosts) {
    const distractionCount = ignoredPosts.length;
    const estimatedTimeWasted = distractionCount * 3; // تقدير 3 دقائق لكل منشور مشتت
    const focusScore = Math.max(10, 100 - (distractionCount * 5));
    
    let distractionLevel, emoji, recommendation;
    
    if (distractionCount === 0) {
      distractionLevel = "ممتاز 🟢";
      recommendation = "مستوى تركيزك رائع! استمر في التركيز على ما هو مهم.";
    } else if (distractionCount <= 5) {
      distractionLevel = "منخفض 🟡";
      recommendation = "جيد، ولكن يمكنك تحسين تركيزك أكثر بتجنب المحتوى غير المهم.";
    } else if (distractionCount <= 15) {
      distractionLevel = "متوسط 🟠";
      recommendation = "حاول تقليل الوقت الذي تقضيه في المحتوى المشتت لتحسين إنتاجيتك.";
    } else {
      distractionLevel = "مرتفع 🔴";
      recommendation = "أنت تفقد الكثير من الوقت! ركز على أهدافك وابتعد عن المشتتات.";
    }

    return {
      summary: `🔍 خلال هذه الجلسة، تم حظر ${distractionCount} منشور مشتت كان يمكن أن يضيع وقتك ويقلل تركيزك.`,
      distractionLevel: distractionLevel,
      totalDistractions: distractionCount,
      timeSaved: `${estimatedTimeWasted} دقيقة`,
      focusScore: `${focusScore}%`,
      topics: this.extractCommonTopics(ignoredPosts),
      recommendation: recommendation,
      positiveImpact: `✅ وفرت approximately ${estimatedTimeWasted} دقيقة من وقتك بالتركيز على ما يهمك حقاً`
    };
  }

  extractCommonTopics(posts) {
    const commonWords = ['مشاهير', 'أخبار', 'ترفيه', 'رياضة', 'سياسة', 'فن', 'تكنولوجيا', 'فيديو', 'صورة', 'منشور'];
    const foundTopics = new Set();
    
    posts.forEach(post => {
      commonWords.forEach(word => {
        if (post.text.includes(word)) {
          foundTopics.add(word);
        }
      });
    });
    
    return Array.from(foundTopics).slice(0, 3);
  }

  getFallbackResponse(endpoint, texts) {
    if (endpoint === 'analyze_distraction') {
      return {
        success: true,
        analysis: this.getEnhancedDistractionAnalysis(texts.map(text => ({ text })))
      };
    } else {
      return {
        success: true,
        summary: this.fallbackSummarization(texts.join('\n\n')),
        key_points: ["تم توليد الملخص محلياً"]
      };
    }
  }

  fallbackSummarization(text) {
    const sentences = text.split(/[.!؟]+/).filter(s => s.trim().length > 0);
    const importantSentences = sentences.slice(0, 3);
    return importantSentences.join('. ') + '.';
  }
}

new BackgroundService();