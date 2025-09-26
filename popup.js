class PopupManager {
  constructor() {
    this.isConnected = true;
    this.initializeElements();
    this.loadSettings();
    this.attachEventListeners();
    this.setupMessageListener();
    this.setupTabs();
  }

  initializeElements() {
    // Main Tab Elements
    this.keywordInput = document.getElementById('keyword-input');
    this.addKeywordButton = document.getElementById('add-keyword');
    this.keywordTagsContainer = document.getElementById('keyword-tags');
    this.saveButton = document.getElementById('save');
    this.refreshButton = document.getElementById('refresh');
    this.disconnectButton = document.getElementById('disconnect');
    
    // Analytics Tab Elements
    this.savedCountSpan = document.getElementById('savedCount');
    this.blockedCountSpan = document.getElementById('blockedCount');
    this.analyzeDesiredButton = document.getElementById('analyze-desired');
    this.analyzeUndesiredButton = document.getElementById('analyze-undesired');
    this.analyzeDistractionOnlyButton = document.getElementById('analyzeDistractionOnly'); // الزر الجديد
    this.endSessionButton = document.getElementById('endSession');
    this.analyticsResults = document.getElementById('analytics-results');
    
    // Common Elements
    this.statusDiv = document.getElementById('status');
    this.mainTab = document.getElementById('main-tab');
    this.analyticsTab = document.getElementById('analytics-tab');
  }

  setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', () => {
        // Remove active class from all buttons and content
        tabButtons.forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        
        // Add active class to clicked button and corresponding content
        button.classList.add('active');
        const tabId = button.getAttribute('data-tab') + '-tab';
        document.getElementById(tabId).classList.add('active');
        
        // Refresh analytics data when switching to analytics tab
        if (button.getAttribute('data-tab') === 'analytics') {
          this.updateStats();
        }
      });
    });
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateCounters') {
        this.updateCounterDisplay(request.counterName, request.value);
      }
      sendResponse({ success: true });
    });
  }

  async loadSettings() {
    try {
      // Load connection status
      const connectionResult = await chrome.storage.local.get(['isConnected']);
      this.isConnected = connectionResult.isConnected !== false; // Default to true if not set
      
      // Load keywords
      const result = await chrome.storage.local.get(['interests', 'savedPostsCount', 'blockedPostsCount']);
      const interests = result.interests || [];
      
      // Display keywords as tags
      this.renderKeywordTags(interests);
      
      // Update stats
      this.savedCountSpan.textContent = result.savedPostsCount || 0;
      this.blockedCountSpan.textContent = result.blockedPostsCount || 0;
      
      // Update UI based on connection status
      this.updateConnectionStatus();
      
    } catch (error) {
      this.showStatus('خطأ في تحميل الإعدادات', 'error');
    }
  }

  attachEventListeners() {
    // Keyword input events
    this.keywordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addKeyword();
      }
    });
    
    this.addKeywordButton.addEventListener('click', () => {
      this.addKeyword();
    });
    
    // Button events
    this.saveButton.addEventListener('click', () => this.saveSettings());
    this.refreshButton.addEventListener('click', () => this.refreshKeywordsAndPage());
    this.disconnectButton.addEventListener('click', () => this.toggleConnection());
    
    this.analyzeDesiredButton.addEventListener('click', () => this.analyzeContent('desired'));
    this.analyzeUndesiredButton.addEventListener('click', () => this.analyzeContent('undesired'));
    this.analyzeDistractionOnlyButton.addEventListener('click', () => this.analyzeDistractionOnly()); // المستمع الجديد
    this.endSessionButton.addEventListener('click', () => this.endSession());
  }

  addKeyword() {
    const keyword = this.keywordInput.value.trim().toLowerCase();
    
    if (keyword && keyword.length > 0 && keyword.length <= 50) {
      // Get existing keywords
      const existingKeywords = this.getCurrentKeywords();
      
      // Add new keyword if not already present
      if (!existingKeywords.includes(keyword)) {
        existingKeywords.push(keyword);
        this.renderKeywordTags(existingKeywords);
        this.keywordInput.value = '';
        this.showStatus('تمت إضافة الكلمة المفتاحية', 'success');
      } else {
        this.showStatus('الكلمة المفتاحية موجودة مسبقاً', 'error');
      }
    }
  }

  removeKeyword(keywordToRemove) {
    const currentKeywords = this.getCurrentKeywords();
    const updatedKeywords = currentKeywords.filter(keyword => keyword !== keywordToRemove);
    this.renderKeywordTags(updatedKeywords);
    this.showStatus('تم حذف الكلمة المفتاحية', 'success');
  }

  getCurrentKeywords() {
    const tagElements = this.keywordTagsContainer.querySelectorAll('.keyword-tag');
    return Array.from(tagElements).map(tag => tag.getAttribute('data-keyword'));
  }

  renderKeywordTags(keywords) {
    this.keywordTagsContainer.innerHTML = '';
    
    keywords.forEach(keyword => {
      const tagElement = document.createElement('div');
      tagElement.className = 'keyword-tag';
      tagElement.setAttribute('data-keyword', keyword);
      tagElement.innerHTML = `
        ${keyword}
        <span class="remove" title="إزالة">×</span>
      `;
      
      tagElement.querySelector('.remove').addEventListener('click', () => {
        this.removeKeyword(keyword);
      });
      
      this.keywordTagsContainer.appendChild(tagElement);
    });
  }

  async saveSettings() {
    if (!this.isConnected) {
      this.showStatus('الإضافة غير موصولة. يرجى التوصيل أولاً.', 'error');
      return;
    }
    
    try {
      const interests = this.getCurrentKeywords();

      if (interests.length === 0) {
        this.showStatus('الرجاء إدخال مواضيع اهتمام', 'error');
        return;
      }

      await chrome.storage.local.set({
        interests,
        lastUpdated: new Date().toISOString()
      });

      // Notify content script of updates
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'settingsUpdated',
          interests: interests
        }).catch(() => {
          console.log('North Star: Tab not ready for messaging');
        });
      }

      this.showStatus('تم حفظ الإعدادات بنجاح!', 'success');
      await this.updateStats();
    } catch (error) {
      this.showStatus('خطأ في حفظ الإعدادات', 'error');
    }
  }

async refreshKeywordsAndPage() {
  try {
    if (!this.isConnected) {
      this.showStatus('الإضافة غير موصولة. يرجى التوصيل أولاً.', 'error');
      return;
    }

    // Step 1: Reset all counters and data to zero
    await chrome.storage.local.set({
      savedPosts: [],
      ignoredPosts: [],
      savedPostsCount: 0,
      blockedPostsCount: 0
    });

    // Step 2: Update the stats display immediately
    this.savedCountSpan.textContent = '0';
    this.blockedCountSpan.textContent = '0';

    // Step 3: Refresh keywords from storage
    const result = await chrome.storage.local.get(['interests']);
    const interests = result.interests || [];
    this.renderKeywordTags(interests);
    
    // Step 4: Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab) {
      // Step 5: Send reset message to content script
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'resetAllData'
        });
      } catch (error) {
        console.log('North Star: Content script not ready for reset message');
      }

      // Step 6: Reload the page to start completely fresh
      await chrome.tabs.reload(tab.id);
      this.showStatus('تم إعادة التعيين الكامل وتحديث الصفحة', 'success');
    } else {
      this.showStatus('لا يوجد تبويب نشط لتحديثه', 'error');
    }
    
  } catch (error) {
    console.error('Error refreshing keywords and page:', error);
    this.showStatus('خطأ في التحديث', 'error');
  }
}

async resetAllData() {
  try {
    // Reset all counters and stored data
    await chrome.storage.local.set({
      savedPosts: [],
      ignoredPosts: [],
      savedPostsCount: 0,
      blockedPostsCount: 0,
      lastUpdated: new Date().toISOString()
    });
    
    // Update the stats display immediately
    await this.updateStats();
    
    console.log('North Star: All data reset successfully');
  } catch (error) {
    console.error('Error resetting all data:', error);
    throw error;
  }
}

  async toggleConnection() {
    this.isConnected = !this.isConnected;
    
    await chrome.storage.local.set({
      isConnected: this.isConnected
    });
    
    this.updateConnectionStatus();
    
    if (this.isConnected) {
      this.showStatus('تم توصيل الإضافة', 'success');
      // Refresh content when reconnecting
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'settingsUpdated',
          interests: this.getCurrentKeywords()
        }).catch(() => {
          console.log('North Star: Tab not ready for messaging');
        });
      }
    } else {
      this.showStatus('تم فصل الإضافة', 'info');
      // Disable content filtering when disconnected
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'disconnectExtension'
        }).catch(() => {
          console.log('North Star: Tab not ready for messaging');
        });
      }
    }
  }

  updateConnectionStatus() {
    if (this.isConnected) {
      this.disconnectButton.textContent = 'فصل الإضافة';
      this.disconnectButton.classList.remove('secondary');
      this.disconnectButton.classList.add('danger');
    } else {
      this.disconnectButton.textContent = 'توصيل الإضافة';
      this.disconnectButton.classList.remove('danger');
      this.disconnectButton.classList.add('secondary');
    }
  }

  // دالة جديدة خاصة لتحليل المحتوى المشتت فقط
  async analyzeDistractionOnly() {
    if (!this.isConnected) {
      this.showStatus('الإضافة غير موصولة. يرجى التوصيل أولاً.', 'error');
      return;
    }
    
    try {
      this.showStatus('جاري تحليل المحتوى المشتت...', 'info');
      
      const result = await chrome.storage.local.get(['ignoredPosts', 'blockedPostsCount']);
      const ignoredPosts = result.ignoredPosts || [];
      const count = result.blockedPostsCount || 0;
      
      if (ignoredPosts.length === 0) {
        this.analyticsResults.innerHTML = `
          <h4>تحليل المحتوى المشتت</h4>
          <p>لا توجد منشورات مشتتة حتى الآن.</p>
          <p><strong>مستوى التشتت:</strong> منخفض ✓</p>
          <p><strong>التوصية:</strong> حافظ على تركيزك الحالي!</p>
        `;
        this.showStatus('لا توجد منشورات مشتتة', 'info');
        return;
      }
      
      // استخدام API لتحليل المحتوى المشتت
      chrome.runtime.sendMessage({
        action: 'analyzeDistraction',
        ignoredPosts: ignoredPosts
      }, (response) => {
        if (response && response.success) {
          const analysis = response.analysis;
          this.analyticsResults.innerHTML = `
            <h4>تحليل المحتوى المشتت</h4>
            <p><strong>عدد المنشورات المشتتة:</strong> ${count}</p>
            <p><strong>مستوى التشتت:</strong> ${analysis.distractionLevel}</p>
            <p><strong>المواضيع المشتتة:</strong> ${analysis.topics.join(', ')}</p>
            <p><strong>التحليل:</strong> ${analysis.summary}</p>
            <p><strong>التوصية:</strong> ${analysis.recommendation}</p>
          `;
          this.showStatus('تم تحليل المحتوى المشتت بنجاح', 'success');
        } else {
          // استخدام التحليل المحلي إذا فشل API
          const localAnalysis = this.generateDistractionAnalysis(ignoredPosts, count);
          this.analyticsResults.innerHTML = `
            <h4>تحليل المحتوى المشتت</h4>
            <p><strong>عدد المنشورات المشتتة:</strong> ${count}</p>
            <p><strong>مستوى التشتت:</strong> ${localAnalysis.distractionLevel}</p>
            <p><strong>المواضيع المشتتة:</strong> ${localAnalysis.topics.join(', ')}</p>
            <p><strong>التحليل:</strong> ${localAnalysis.summary}</p>
            <p><strong>التوصية:</strong> ${localAnalysis.recommendation}</p>
          `;
          this.showStatus('تم تحليل المحتوى المشتت (محلياً)', 'success');
        }
      });
      
    } catch (error) {
      console.error('Error analyzing distraction:', error);
      this.showStatus('خطأ في تحليل المحتوى المشتت', 'error');
    }
  }

  // دالة مساعدة لتحليل التشتت محلياً
  generateDistractionAnalysis(ignoredPosts, count) {
    const topics = this.extractCommonTopics(ignoredPosts);
    
    let distractionLevel, summary, recommendation;
    
    if (count > 15) {
      distractionLevel = "عالٍ جداً";
      summary = `هناك ${count} منشور مشتت خلال الجلسة. هذا يشير إلى وجود الكثير من المحتوى غير المرغوب.`;
      recommendation = "يوصى بتقليل وقت التصفح بشكل كبير والتركيز على الأولويات.";
    } else if (count > 10) {
      distractionLevel = "عالٍ";
      summary = `تم حظر ${count} منشور مشتت. مستوى التشتت يحتاج إلى انتباه.`;
      recommendation = "حاول تحديد أوقات محددة للتصفح وتجنب التصفح العشوائي.";
    } else if (count > 5) {
      distractionLevel = "متوسط";
      summary = `هناك ${count} منشورات مشتتة. المستوى مقبول ولكن يمكن تحسينه.`;
      recommendation = "ركز على المحتوى المهم وحاول تجنب المواضيع غير المرتبطة باهتماماتك.";
    } else {
      distractionLevel = "منخفض";
      summary = `فقط ${count} منشورات مشتتة. هذا مستوى جيد من التركيز.`;
      recommendation = "حافظ على هذا المستوى من التركيز واستمر في تصفية المحتوى غير المرغوب.";
    }
    
    return {
      distractionLevel,
      topics: topics.length > 0 ? topics : ["مواضيع متنوعة"],
      summary,
      recommendation
    };
  }

  async analyzeContent(type) {
    if (!this.isConnected) {
      this.showStatus('الإضافة غير موصولة. يرجى التوصيل أولاً.', 'error');
      return;
    }
    
    try {
      this.showStatus(`جاري تحليل المحتوى ${type === 'desired' ? 'المطلوب' : 'غير المرغوب'}...`, 'info');
      
      const result = await chrome.storage.local.get([
        'savedPosts', 
        'ignoredPosts',
        'savedPostsCount',
        'blockedPostsCount'
      ]);
      
      let posts, count, title;
      
      if (type === 'desired') {
        posts = result.savedPosts || [];
        count = result.savedPostsCount || 0;
        title = 'تحليل المحتوى المطلوب';
      } else {
        posts = result.ignoredPosts || [];
        count = result.blockedPostsCount || 0;
        title = 'تحليل المحتوى غير المرغوب';
      }
      
      if (posts.length === 0) {
        this.analyticsResults.innerHTML = `
          <h4>${title}</h4>
          <p>لا توجد منشورات ${type === 'desired' ? 'مهمة' : 'مطموسة'} حتى الآن.</p>
        `;
        return;
      }
      
      // Simple analysis - in a real implementation, this would call an API
      const topics = this.extractCommonTopics(posts);
      const analysis = this.generateAnalysis(posts, type, count, topics);
      
      this.analyticsResults.innerHTML = `
        <h4>${title}</h4>
        <p><strong>عدد المنشورات:</strong> ${count}</p>
        <p><strong>المواضيع الشائعة:</strong> ${topics.join(', ')}</p>
        <p><strong>التحليل:</strong> ${analysis}</p>
      `;
      
      this.showStatus('تم تحليل المحتوى', 'success');
      
    } catch (error) {
      console.error('Error analyzing content:', error);
      this.showStatus('خطأ في تحليل المحتوى', 'error');
    }
  }

  extractCommonTopics(posts) {
    // Simple keyword extraction - in a real implementation, this would use NLP
    const commonWords = [
      'technology', 'programming', 'ai', 'science', 'news', 'update', 
      'new', 'learn', 'development', 'code', 'software', 'computer',
      'sports', 'entertainment', 'music', 'movie', 'game', 'funny',
      'shopping', 'sale', 'discount', 'food', 'travel', 'vacation'
    ];
    
    const text = posts.map(post => post.text).join(' ').toLowerCase();
    const foundTopics = commonWords.filter(word => text.includes(word));
    
    return foundTopics.length > 0 ? foundTopics.slice(0, 5) : ['مواضيع متنوعة'];
  }

  generateAnalysis(posts, type, count, topics) {
    if (type === 'desired') {
      if (count > 10) {
        return 'أنت تركز بشكل جيد على المحتوى الذي يهمك. استمر في التركيز على هذه المواضيع.';
      } else if (count > 5) {
        return 'لديك اهتمام معتدل بالمحتوى المهم. حاول زيادة التركيز على مواضيع اهتمامك.';
      } else {
        return 'اهتمامك بالمحتوى المهم منخفض. حاول ضبط كلماتك المفتاحية لتحسين التصفية.';
      }
    } else {
      if (count > 10) {
        return 'هناك الكثير من المحتوى المشتت. حاول تقليل وقت التصفح للتركيز أكثر.';
      } else if (count > 5) {
        return 'مستوى التشتت معتدل. حاول التركيز على المحتوى المهم وتجنب التصفح العشوائي.';
      } else {
        return 'مستوى التشتت منخفض. حافظ على تركيزك الحالي!';
      }
    }
  }

  async endSession() {
    if (!this.isConnected) {
      this.showStatus('الإضافة غير موصولة. يرجى التوصيل أولاً.', 'error');
      return;
    }
    
    try {
      this.showStatus('جاري توليد التقارير بالذكاء الاصطناعي...', 'info');
      
      const result = await chrome.storage.local.get(['savedPosts', 'ignoredPosts']);
      const savedPosts = result.savedPosts || [];
      const ignoredPosts = result.ignoredPosts || [];

      if (savedPosts.length === 0 && ignoredPosts.length === 0) {
        this.showStatus('لا توجد نشاطات خلال الجلسة', 'error');
        return;
      }

      let reportsGenerated = 0;
      const totalReports = (savedPosts.length > 0 ? 1 : 0) + (ignoredPosts.length > 0 ? 1 : 0);

      // Generate summary for important content
      if (savedPosts.length > 0) {
        chrome.runtime.sendMessage({
          action: 'generateSummary',
          posts: savedPosts
        }, (response) => {
          reportsGenerated++;
          if (!response || !response.success) {
            console.error('Error generating summary:', response?.error);
          }
          this.checkAllReportsGenerated(reportsGenerated, totalReports);
        });
      } else {
        reportsGenerated++;
      }

      // Analyze distracting content
      if (ignoredPosts.length > 0) {
        chrome.runtime.sendMessage({
          action: 'analyzeDistraction',
          ignoredPosts: ignoredPosts
        }, (response) => {
          reportsGenerated++;
          if (response && response.success) {
            console.log('Distraction analysis completed');
          } else {
            console.error('Error analyzing distraction:', response?.error);
          }
          this.checkAllReportsGenerated(reportsGenerated, totalReports);
        });
      } else {
        reportsGenerated++;
      }

      // If there's no important or distracting content
      if (totalReports === 0) {
        this.showStatus('لا توجد منشورات لتلخيصها', 'error');
        return;
      }

    } catch (error) {
      console.error('Error ending session:', error);
      this.showStatus('خطأ في إنهاء الجلسة', 'error');
    }
  }

  checkAllReportsGenerated(reportsGenerated, totalReports) {
    if (reportsGenerated >= totalReports) {
      this.showStatus('تم توليد جميع التقارير! افحص الصفحة.', 'success');
      this.resetCounters();
    }
  }

 async resetCounters() {
  try {
    await chrome.storage.local.set({
      savedPosts: [],
      ignoredPosts: [],
      savedPostsCount: 0,
      blockedPostsCount: 0
    });
    await this.updateStats();
  } catch (error) {
    console.error('Error resetting counters:', error);
  }
}

  showStatus(message, type) {
    this.statusDiv.textContent = message;
    this.statusDiv.className = `status ${type}`;
    
    // Hide message after 4 seconds only for success messages
    if (type === 'success' || type === 'info') {
      setTimeout(() => {
        if (this.statusDiv.textContent === message) {
          this.statusDiv.textContent = '';
          this.statusDiv.className = 'status';
        }
      }, 4000);
    }
  }

  async updateStats() {
    try {
      const result = await chrome.storage.local.get(['savedPostsCount', 'blockedPostsCount']);
      this.savedCountSpan.textContent = result.savedPostsCount || 0;
      this.blockedCountSpan.textContent = result.blockedPostsCount || 0;
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  updateCounterDisplay(counterName, value) {
    if (counterName === 'savedPostsCount') {
      this.savedCountSpan.textContent = value;
    } else if (counterName === 'blockedPostsCount') {
      this.blockedCountSpan.textContent = value;
    }
  }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});