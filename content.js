class ContentFilter {
  constructor() {
    this.settings = {
      interests: []
    };
    this.observer = null;
    this.savedPosts = new Set();
    this.ignoredPosts = new Set();
    this.isInitialized = false;
    this.initialize();
  }
  
  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.loadSettings();
      this.setupMutationObserver();
      this.scanExistingContent();
      this.setupMessageListener();
      this.injectStyles();
      this.isInitialized = true;
      console.log('North Star: Content script loaded successfully');
    } catch (error) {
      console.error('North Star: Initialization error:', error);
    }
  }

  injectStyles() {
    try {
      const style = document.createElement('style');
      style.id = 'north-star-styles';
      style.textContent = `
        .north-star-blurred {
          filter: blur(6px) brightness(0.7);
          transition: all 0.3s ease;
        }
        .north-star-visible {
          border: 2px solid #4cafef;
          border-radius: 8px;
          padding: 2px;
          transition: all 0.3s ease;
        }
        .north-star-modal-overlay {
          position: fixed;
          top: 0; left: 0;
          width: 100%; height: 100%;
          background: rgba(0,0,0,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
        }
        .north-star-modal {
          background: #fff;
          max-width: 600px;
          width: 90%;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 5px 20px rgba(0,0,0,0.3);
          position: relative;
          animation: fadeIn 0.3s ease;
        }
        .north-star-close {
          position: absolute;
          top: 10px; right: 15px;
          font-size: 20px;
          cursor: pointer;
          border: none;
          background: none;
        }
        .north-star-toggle-btn {
          display: block;
          margin-bottom: 8px;
          padding: 6px 12px;
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          z-index: 1000;
          position: relative;
        }
        .north-star-toggle-btn:hover {
          background: #2980b9;
          transform: translateY(-1px);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;
      if (!document.getElementById('north-star-styles')) {
        document.head.appendChild(style);
      }
    } catch (error) {
      console.error('North Star: Inject styles error:', error);
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['interests']);
      this.settings.interests = result.interests || [];
      console.log('North Star: Settings loaded', this.settings);
    } catch (error) {
      console.error('North Star: Error loading settings:', error);
    }
  }

  setupMutationObserver() {
    try {
      this.observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              this.processNode(node);
            }
          });
        });
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    } catch (error) {
      console.error('North Star: MutationObserver setup error:', error);
    }
  }

  resetAllData() {
    try {
      // Remove all North Star styles and classes
      document.querySelectorAll('.north-star-visible, .north-star-blurred').forEach(el => {
        el.classList.remove('north-star-visible', 'north-star-blurred');
        el.processedByNorthStar = false;
      });
      
      // Remove all toggle buttons
      document.querySelectorAll('.north-star-toggle-btn').forEach(btn => {
        btn.remove();
      });
      
      // Clear all stored data
      this.savedPosts.clear();
      this.ignoredPosts.clear();
      
      console.log('North Star: All data reset successfully');
    } catch (error) {
      console.error('North Star: Reset all data error:', error);
    }
  }

  setupMessageListener() {
    if (!chrome.runtime?.onMessage) {
      console.warn('North Star: Chrome runtime not available');
      return;
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      try {
        if (request.action === 'settingsUpdated') {
          this.handleSettingsUpdate(request);
        } else if (request.action === 'showSummary') {
          this.showSummaryModal(request.summary, request.keyPoints);
        } else if (request.action === 'showDistractionAnalysis') {
          this.showDistractionAnalysis(request.analysis);
        } else if (request.action === 'disconnectExtension') {
          this.disconnectExtension();
        } else if (request.action === 'rescanContent') {
          this.rescanContent();
          sendResponse({ success: true });
        } else if (request.action === 'resetAllData') {
          this.resetAllData();
          sendResponse({ success: true });
        }
        sendResponse({ success: true });
      } catch (error) {
        console.error('North Star: Message handler error:', error);
        sendResponse({ success: false, error: error.message });
      }
      return true;
    });
  }

  disconnectExtension() {
    try {
      // Remove all North Star styles and classes
      document.querySelectorAll('.north-star-visible, .north-star-blurred').forEach(el => {
        el.classList.remove('north-star-visible', 'north-star-blurred');
        el.processedByNorthStar = false;
      });
      
      // Remove all toggle buttons
      document.querySelectorAll('.north-star-toggle-btn').forEach(btn => {
        btn.remove();
      });
      
      console.log('North Star: Extension disconnected, filtering disabled');
    } catch (error) {
      console.error('North Star: Disconnect extension error:', error);
    }
  }

  handleSettingsUpdate(request) {
    try {
      this.settings.interests = request.interests || [];
      this.rescanContent();
      console.log('North Star: Settings updated', this.settings);
    } catch (error) {
      console.error('North Star: Settings update error:', error);
    }
  }

  scanExistingContent() {
    console.log('North Star: Scanning existing content');
    this.processNode(document.body);

    setTimeout(() => {
      try {
        this.processNode(document.body);
      } catch (error) {
        console.error('North Star: Rescan error:', error);
      }
    }, 1000);

    setTimeout(() => {
      try {
        this.processNode(document.body);
      } catch (error) {
        console.error('North Star: Rescan error:', error);
      }
    }, 3000);
  }

  rescanContent() {
    try {
      // إزالة جميع التنسيقات السابقة
      document.querySelectorAll('.north-star-visible, .north-star-blurred').forEach(el => {
        el.classList.remove('north-star-visible', 'north-star-blurred');
        el.processedByNorthStar = false;
      });

      // إزالة أزرار التبديل
      document.querySelectorAll('.north-star-toggle-btn').forEach(btn => {
        btn.remove();
      });

      // مسح البيانات المؤقتة
      this.savedPosts.clear();
      this.ignoredPosts.clear();

      // إعادة فحص المحتوى
      this.scanExistingContent();
      
      console.log('North Star: Page rescanned successfully');
    } catch (error) {
      console.error('North Star: Rescan content error:', error);
    }
  }

  processNode(node) {
    if (!node.querySelectorAll) return;

    const postSelectors = [
      'article',
      'div[data-testid="tweet"]',
      'div[role="article"]',
      '.feed-shared-update-v2',
      'div.Post',
      'div._1oQyIsiPHYt6nx7VOmd1sz',
    ];

    postSelectors.forEach(selector => {
      try {
        const posts = node.querySelectorAll(selector);
        posts.forEach(post => {
          if (!post.processedByNorthStar) {
            this.processPost(post);
            post.processedByNorthStar = true;
          }
        });
      } catch (error) {
        console.error('North Star: Error processing selector', selector, error);
      }
    });

    try {
      if (node.matches && postSelectors.some(selector => node.matches(selector))) {
        if (!node.processedByNorthStar) {
          this.processPost(node);
          node.processedByNorthStar = true;
        }
      }
    } catch (error) {
      console.error('North Star: Error processing node:', error);
    }
  }

  processPost(postElement) {
    try {
      const textContent = this.extractTextContent(postElement);
      if (!textContent || textContent.trim().length < 10) return;

      const lowerText = textContent.toLowerCase();
      const postPreview = textContent.substring(0, 100).replace(/\n/g, ' ');

      const hasInterest = this.settings.interests.length > 0 &&
        this.settings.interests.some(topic =>
          topic && lowerText.includes(topic.toLowerCase())
        );

      if (hasInterest) {
        this.highlightPost(postElement, textContent);
        console.log('North Star: ✅ Highlighted post:', postPreview);
      } else {
        this.blurPost(postElement, textContent);
        console.log('North Star: ❌ Blurred post:', postPreview);
      }
    } catch (error) {
      console.error('North Star: Process post error:', error);
    }
  }

  extractTextContent(element) {
    try {
      const clone = element.cloneNode(true);
      const elementsToRemove = clone.querySelectorAll(
        'script, style, noscript, iframe, img, video, audio, button, .btn, [role="button"]'
      );
      elementsToRemove.forEach(el => el.remove());

      return clone.textContent || clone.innerText || '';
    } catch (error) {
      return element.textContent || element.innerText || '';
    }
  }

  highlightPost(postElement, textContent) {
    try {
      postElement.classList.add('north-star-visible');
      postElement.classList.remove('north-star-blurred');
      
      // إزالة زر التبديل إذا كان موجوداً
      const existingBtn = postElement.previousElementSibling;
      if (existingBtn && existingBtn.classList.contains('north-star-toggle-btn')) {
        existingBtn.remove();
      }
      
      this.savePost(postElement, textContent);
    } catch (error) {
      console.error('North Star: Highlight post error:', error);
    }
  }

  blurPost(postElement, textContent) {
    try {
      postElement.classList.add('north-star-blurred');
      postElement.classList.remove('north-star-visible');
      
      // إضافة زر إظهار/إخفاء المحتوى
      this.addToggleButton(postElement);
      
      this.saveIgnoredPost(postElement, textContent);
      this.incrementCounter('blockedPostsCount');
    } catch (error) {
      console.error('North Star: Blur post error:', error);
    }
  }

  addToggleButton(postElement) {
    try {
      // التحقق من عدم وجود الزر مسبقاً
      const existingBtn = postElement.previousElementSibling;
      if (existingBtn && existingBtn.classList.contains('north-star-toggle-btn')) {
        return;
      }

      // إنشاء زر التبديل
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'north-star-toggle-btn';
      toggleBtn.innerHTML = '👁 إظهار المحتوى';
      toggleBtn.title = 'انقر لإظهار المحتوى المؤقت';
      
      // إضافة أحداث النقر
      toggleBtn.addEventListener('click', () => {
        this.togglePostVisibility(postElement, toggleBtn);
      });
      
      // إدراج الزر قبل المنشور
      postElement.parentNode.insertBefore(toggleBtn, postElement);
      
    } catch (error) {
      console.error('North Star: Add toggle button error:', error);
    }
  }

  togglePostVisibility(postElement, toggleBtn) {
    try {
      const isCurrentlyBlurred = postElement.classList.contains('north-star-blurred');
      
      if (isCurrentlyBlurred) {
        // إزالة الطمس وإظهار المحتوى
        postElement.classList.remove('north-star-blurred');
        postElement.style.filter = 'none';
        toggleBtn.innerHTML = '🙈 إخفاء المحتوى';
        toggleBtn.title = 'انقر لإخفاء المحتوى';
      } else {
        // إعادة الطمس وإخفاء المحتوى
        postElement.classList.add('north-star-blurred');
        postElement.style.filter = 'blur(6px) brightness(0.7)';
        toggleBtn.innerHTML = '👁 إظهار المحتوى';
        toggleBtn.title = 'انقر لإظهار المحتوى المؤقت';
      }
    } catch (error) {
      console.error('North Star: Toggle post visibility error:', error);
    }
  }

  async savePost(postElement, textContent) {
    try {
      const postId = this.generatePostId(textContent);

      if (!this.savedPosts.has(postId)) {
        this.savedPosts.add(postId);

        const result = await chrome.storage.local.get(['savedPosts']);
        const savedPosts = result.savedPosts || [];

        if (!savedPosts.some(post => post.id === postId)) {
          savedPosts.push({
            id: postId,
            text: textContent.trim(),
            url: window.location.href,
            timestamp: new Date().toISOString(),
            platform: this.detectPlatform()
          });

          await chrome.storage.local.set({ savedPosts });
          this.incrementCounter('savedPostsCount');
        }
      }
    } catch (error) {
      console.error('North Star: Save post error:', error);
    }
  }

  async saveIgnoredPost(postElement, textContent) {
    try {
      const postId = this.generatePostId(textContent);

      if (!this.ignoredPosts.has(postId)) {
        this.ignoredPosts.add(postId);

        const result = await chrome.storage.local.get(['ignoredPosts']);
        const ignoredPosts = result.ignoredPosts || [];

        if (!ignoredPosts.some(post => post.id === postId)) {
          ignoredPosts.push({
            id: postId,
            text: textContent.trim(),
            url: window.location.href,
            timestamp: new Date().toISOString(),
            platform: this.detectPlatform()
          });

          await chrome.storage.local.set({ ignoredPosts });
        }
      }
    } catch (error) {
      console.error('North Star: Save ignored post error:', error);
    }
  }

  detectPlatform() {
    try {
      const hostname = window.location.hostname;
      if (hostname.includes('linkedin')) return 'linkedin';
      if (hostname.includes('twitter') || hostname.includes('x.com')) return 'twitter';
      if (hostname.includes('facebook')) return 'facebook';
      if (hostname.includes('instagram')) return 'instagram';
      if (hostname.includes('reddit')) return 'reddit';
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  generatePostId(text) {
    try {
      let hash = 0;
      for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    } catch (error) {
      return Math.random().toString(36).substring(2);
    }
  }

  async incrementCounter(counterName) {
    try {
      const result = await chrome.storage.local.get([counterName]);
      const currentCount = result[counterName] || 0;
      const newCount = currentCount + 1;

      await chrome.storage.local.set({ [counterName]: newCount });

      if (chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'updateCounters',
          counterName: counterName,
          value: newCount
        }).catch(() => {
          console.log('North Star: Popup not open, counter updated locally');
        });
      }
    } catch (error) {
      console.error('North Star: Increment counter error:', error);
    }
  }

  showSummaryModal(summary, keyPoints = []) {
    try {
      this.createModal('summary', summary, keyPoints);
    } catch (error) {
      console.error('North Star: Show summary modal error:', error);
    }
  }

  showDistractionAnalysis(analysis) {
    try {
      this.createDistractionModal(analysis);
    } catch (error) {
      console.error('North Star: Show distraction analysis error:', error);
    }
  }

  createDistractionModal(analysis) {
    try {
      const modalId = 'north-star-distraction-analysis';
      const existingModal = document.getElementById(modalId);
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'north-star-modal-overlay';
      modal.innerHTML = `
        <div class="north-star-modal" style="max-width: 500px;">
          <button class="north-star-close">&times;</button>
          <h3 style="color: #e74c3c; margin-bottom: 15px;">📊 تحليل المحتوى المشتت</h3>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px; color: #333;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>عدد المشتتات:</span>
              <strong>${analysis.totalDistractions || analysis.totalDistractions} منشور</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>مستوى التشتت:</span>
              <strong style="color: ${
                analysis.distractionLevel.includes('🟢') ? '#27ae60' : 
                analysis.distractionLevel.includes('🟡') ? '#f39c12' : 
                analysis.distractionLevel.includes('🟠') ? '#e67e22' : '#e74c3c'
              }">${analysis.distractionLevel}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>الوقت الذي وفرته:</span>
              <strong style="color: #27ae60;">${analysis.timeSaved}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span>مستوى التركيز:</span>
              <strong>${analysis.focusScore}</strong>
            </div>
          </div>

          <p style="margin-bottom: 15px; line-height: 1.5; color: #333;">${analysis.summary}</p>
          
          ${analysis.topics && analysis.topics.length > 0 ? `
            <div style="margin-bottom: 15px;">
              <strong style="color: #333;">أبرز المواضيع المشتتة:</strong>
              <div style="display: flex; gap: 5px; margin-top: 5px; flex-wrap: wrap;">
                ${analysis.topics.map(topic => 
                  `<span style="background: #e74c3c; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${topic}</span>`
                ).join('')}
              </div>
            </div>
          ` : ''}
          
          <div style="background: #e8f5e8; padding: 10px; border-radius: 6px; margin-bottom: 15px;">
            <strong style="color: #27ae60;">✅ الأثر الإيجابي:</strong>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #333;">${analysis.positiveImpact}</p>
          </div>
          
          <div style="background: #fff3cd; padding: 10px; border-radius: 6px;">
            <strong style="color: #f39c12;">💡 نصيحة للتركيز:</strong>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #333;">${analysis.recommendation}</p>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      this.setupModalEvents(modal);

    } catch (error) {
      console.error('North Star: Create distraction modal error:', error);
    }
  }

  createModal(type, content, keyPoints = []) {
    try {
      const modalId = `north-star-${type}`;
      const existingModal = document.getElementById(modalId);
      if (existingModal) existingModal.remove();

      const modal = document.createElement('div');
      modal.id = modalId;
      modal.className = 'north-star-modal-overlay';
      
      if (type === 'distraction') {
        // استخدام الدالة الجديدة لتحليل التشتت
        this.createDistractionModal(content);
        return;
      }
      
      modal.innerHTML = `
        <div class="north-star-modal">
          <button class="north-star-close">&times;</button>
          <div class="north-star-content">
            <h2>${type === 'summary' ? '📝 ملخص المحتوى المهم' : 'تحليل المحتوى'}</h2>
            <p>${content}</p>
            ${keyPoints.length ? `
              <div class="north-star-key-points">
                <h3>النقاط الرئيسية:</h3>
                <ul>${keyPoints.map(p => `<li>${p}</li>`).join('')}</ul>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      document.body.appendChild(modal);
      this.setupModalEvents(modal);

    } catch (error) {
      console.error('North Star: Create modal error:', error);
    }
  }

  setupModalEvents(modal) {
    const closeButton = modal.querySelector('.north-star-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => modal.remove());
    }

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    const closeHandler = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', closeHandler);
      }
    };
    document.addEventListener('keydown', closeHandler);
  }
}

// تهيئة البرنامج النصي
function initializeContentScript() {
  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        try {
          console.log('North Star: DOM loaded, initializing...');
          new ContentFilter();
        } catch (error) {
          console.error('North Star: DOM loaded initialization error:', error);
        }
      });
    } else {
      console.log('North Star: DOM already loaded, initializing...');
      new ContentFilter();
    }
  } catch (error) {
    console.error('North Star: Initialization error:', error);
    // Fallback initialization
    setTimeout(() => {
      try {
        new ContentFilter();
      } catch (fallbackError) {
        console.error('North Star: Fallback initialization error:', fallbackError);
      }
    }, 1000);
  }
}

// بدء التشغيل
initializeContentScript();