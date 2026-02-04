const MAX_HISTORY = 20;
const DEFAULT_KEYWORD = "Welcome Back";
const TRANSLATE_API = 'https://api.mymemory.translated.net/get';

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('keywordInput');
  const saveBtn = document.getElementById('saveBtn');
  const clearKeywordBtn = document.getElementById('clearKeywordBtn');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const historyList = document.getElementById('historyList');
  const newsText = document.getElementById('randomNews');
  const currentDisplay = document.getElementById('currentKeywordDisplay');
  const lastCheckText = document.getElementById('lastCheckTime');
  let originalNewsText = null;
  let showingTranslated = false;

  async function translateToSpanish(text) {
    if (!text) return null;
    const maxLen = 1500;
    if (text.length > maxLen) text = text.slice(0, maxLen);
    try {
      const url = TRANSLATE_API + '?q=' + encodeURIComponent(text) + '&langpair=en|es';
      const res = await fetch(url);
      const data = await res.json();
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        return data.responseData.translatedText;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  function renderUI(result) {
    if (result.customKeyword) {
      input.value = result.customKeyword;
      currentDisplay.innerText = `"${result.customKeyword}"`;
    } else {
      input.value = '';
      currentDisplay.innerText = `"${DEFAULT_KEYWORD}" (Defecto)`;
    }
    if (result.lastRandomNews) {
      newsText.innerText = result.lastRandomNews;
      originalNewsText = result.lastRandomNews;
      showingTranslated = false;
    }
    if (result.lastCheck) lastCheckText.innerText = `Última revisión: ${result.lastCheck}`;
    const linkEl = document.getElementById('newsSourceLink');
    if (linkEl) {
      if (result.lastRandomNewsUrl) {
        linkEl.href = result.lastRandomNewsUrl;
        linkEl.style.display = 'inline-block';
      } else {
        linkEl.style.display = 'none';
      }
    }
    const translateBtn = document.getElementById('translateNewsBtn');
    if (translateBtn) {
      const isErrorOrEmpty = !result.lastRandomNews || result.lastRandomNews.startsWith('Error') || result.lastRandomNews.startsWith('Sin noticias') || result.lastRandomNews.startsWith('WoWHead no');
      translateBtn.style.display = isErrorOrEmpty ? 'none' : 'inline-block';
      translateBtn.textContent = 'Traducir al español';
    }
  }

  function renderHistory(list) {
    historyList.innerHTML = '';
    (list || []).forEach((item, i) => {
      const li = document.createElement('li');
      const span = document.createElement('span');
      span.textContent = item;
      span.title = 'Usar esta búsqueda';
      span.addEventListener('click', () => {
        input.value = item;
        saveKeyword(item);
      });
      li.appendChild(span);
      historyList.appendChild(li);
    });
  }

  function saveKeyword(word) {
    const kw = (word || input.value.trim()) || DEFAULT_KEYWORD;
    chrome.storage.local.get(['searchHistory'], (res) => {
      let history = res.searchHistory || [];
      history = history.filter(h => h !== kw);
      history.unshift(kw);
      history = history.slice(0, MAX_HISTORY);
      chrome.storage.local.set({
        customKeyword: kw,
        searchHistory: history
      }, () => {
        currentDisplay.innerText = `"${kw}"`;
        renderHistory(history);
        chrome.runtime.sendMessage({ action: "checkNow" }).catch(() => {});
        const orig = currentDisplay.style.color;
        currentDisplay.style.color = "#fff";
        setTimeout(() => { currentDisplay.style.color = "#00ff00"; }, 500);
      });
    });
  }

  // Cargar datos
  chrome.storage.local.get(['customKeyword', 'lastRandomNews', 'lastRandomNewsUrl', 'lastCheck', 'searchHistory', 'badgeCount'], (result) => {
    renderUI(result);
    renderHistory(result.searchHistory);
    const badgeBox = document.getElementById('badgeAlertBox');
    const badgeText = document.getElementById('badgeAlertText');
    if (result.badgeCount > 0 && badgeBox && badgeText) {
      badgeBox.style.display = 'block';
      badgeText.textContent = result.badgeCount === 1 ? '1 palabra clave encontrada (posibles días gratis)' : result.badgeCount + ' coincidencias encontradas';
    } else if (badgeBox) badgeBox.style.display = 'none';
  });

  document.getElementById('clearBadgeBtn')?.addEventListener('click', () => {
    chrome.storage.local.set({ badgeCount: 0 });
    chrome.runtime.sendMessage({ action: 'clearBadge' }).catch(() => {});
    document.getElementById('badgeAlertBox').style.display = 'none';
  });

  document.getElementById('translateNewsBtn')?.addEventListener('click', async () => {
    const btn = document.getElementById('translateNewsBtn');
    const textEl = document.getElementById('randomNews');
    if (showingTranslated && originalNewsText) {
      textEl.innerText = originalNewsText;
      btn.textContent = 'Traducir al español';
      showingTranslated = false;
      return;
    }
    const text = (originalNewsText || textEl.innerText || '').trim();
    if (!text) return;
    btn.disabled = true;
    btn.textContent = 'Traduciendo...';
    const translated = await translateToSpanish(text);
    btn.disabled = false;
    if (translated) {
      textEl.innerText = translated;
      btn.textContent = 'Ver original';
      showingTranslated = true;
    } else {
      btn.textContent = 'Traducir al español';
    }
  });

  saveBtn.addEventListener('click', () => saveKeyword());

  clearKeywordBtn.addEventListener('click', () => {
    chrome.storage.local.set({ customKeyword: null }, () => {
      currentDisplay.innerText = `"${DEFAULT_KEYWORD}" (Defecto)`;
      input.value = '';
      chrome.runtime.sendMessage({ action: "checkNow" }).catch(() => {});
    });
  });

  clearHistoryBtn.addEventListener('click', () => {
    chrome.storage.local.set({ searchHistory: [] }, () => {
      renderHistory([]);
    });
  });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "refreshUI") {
    chrome.storage.local.get(['customKeyword', 'lastRandomNews', 'lastRandomNewsUrl', 'lastCheck', 'searchHistory', 'badgeCount'], (result) => {
      const news = document.getElementById('randomNews');
      const lastCheck = document.getElementById('lastCheckTime');
      const currentDisplay = document.getElementById('currentKeywordDisplay');
      const input = document.getElementById('keywordInput');
      const linkEl = document.getElementById('newsSourceLink');
      const badgeBox = document.getElementById('badgeAlertBox');
      const badgeText = document.getElementById('badgeAlertText');
      if (news) {
        news.innerText = result.lastRandomNews || news.innerText;
        const translateBtn = document.getElementById('translateNewsBtn');
        if (translateBtn) {
          translateBtn.textContent = 'Traducir al español';
          translateBtn.style.display = (result.lastRandomNews && !result.lastRandomNews.startsWith('Error') && !result.lastRandomNews.startsWith('Sin noticias') && !result.lastRandomNews.startsWith('WoWHead no')) ? 'inline-block' : 'none';
        }
      }
      if (lastCheck) lastCheck.innerText = result.lastCheck ? `Última revisión: ${result.lastCheck}` : lastCheck.innerText;
      if (linkEl) {
        if (result.lastRandomNewsUrl) {
          linkEl.href = result.lastRandomNewsUrl;
          linkEl.style.display = 'inline-block';
        } else {
          linkEl.style.display = 'none';
        }
      }
      if (result.badgeCount > 0 && badgeBox && badgeText) {
        badgeBox.style.display = 'block';
        badgeText.textContent = result.badgeCount === 1 ? '1 palabra clave encontrada (posibles días gratis)' : result.badgeCount + ' coincidencias encontradas';
      } else if (badgeBox) badgeBox.style.display = 'none';
      if (result.customKeyword && currentDisplay) currentDisplay.innerText = `"${result.customKeyword}"`;
      if (result.searchHistory && result.searchHistory.length) {
        const list = document.getElementById('historyList');
        if (list) {
          list.innerHTML = '';
          result.searchHistory.forEach((item) => {
            const li = document.createElement('li');
            const span = document.createElement('span');
            span.textContent = item;
            span.addEventListener('click', () => {
              input.value = item;
              chrome.storage.local.set({ customKeyword: item }, () => {
                currentDisplay.innerText = `"${item}"`;
                chrome.runtime.sendMessage({ action: "checkNow" }).catch(() => {});
              });
            });
            li.appendChild(span);
            list.appendChild(li);
          });
        }
      }
    });
  }
});
