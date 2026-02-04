chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("checkWoW", { periodInMinutes: 60 });
  setBadgeCount(0);
  checkAllNews();
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "checkNow") {
    checkAllNews()
      .then(() => {
        chrome.runtime.sendMessage({ action: "refreshUI" }).catch(() => {});
        sendResponse({ status: "ok" });
      })
      .catch(() => sendResponse({ status: "error" }));
    return true;
  }
  if (request.action === "clearBadge") {
    setBadgeCount(0);
    sendResponse({ status: "ok" });
    return false;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkWoW") {
    checkAllNews();
  }
});

async function checkAllNews() {
  const result = await chrome.storage.local.get(['customKeyword']);
  const keyword = result.customKeyword || "Welcome Back";

  const now = new Date().toLocaleTimeString();
  await chrome.storage.local.set({ lastCheck: now });

  let foundCount = 0;
  const blizzardFound = await checkSite('https://news.blizzard.com/es-es/world-of-warcraft', keyword);
  if (blizzardFound) foundCount++;
  const wowheadFound = await checkWoWHead(keyword);
  if (wowheadFound) foundCount++;

  await setBadgeCount(foundCount);
}

// Palabras clave en inglés y español para días gratis
const BLIZZARD_KEYWORDS = [
  "Welcome Back", "Bienvenido de nuevo", "Bienvenida",
  "días gratis", "dias gratis", "día gratis", "dia gratis",
  "Fin de semana gratis", "free weekend", "free days",
  "regresa a WoW", "regreso a WoW", "vuelve a WoW"
];

const WOWHEAD_ES_BASE = 'https://es.wowhead.com';

async function checkWoWHead(keyword) {
  let keywordFound = false;
  try {
    // Usar WoWHead en español para noticias solo en español
    const response = await fetch(WOWHEAD_ES_BASE + '/news?cache=' + Date.now());
    if (!response.ok) {
      await chrome.storage.local.set({ lastRandomNews: "WoWHead no disponible (HTTP " + response.status + ").", lastRandomNewsUrl: null });
      return false;
    }
    const html = await response.text();

    if (html.toLowerCase().includes(keyword.toLowerCase())) {
      keywordFound = true;
      sendAlert("¡WoWHead menciona: " + keyword + "!");
    }

    // WoWHead incluye las noticias en JSON embebido: id="data.news.newsData"
    const scriptMatch = html.match(/<script[^>]*id="data\.news\.newsData"[^>]*>([\s\S]*?)<\/script>/i);
    let posts = [];
    if (scriptMatch) {
      try {
        const data = JSON.parse(scriptMatch[1]);
        if (data.newsPosts && Array.isArray(data.newsPosts)) {
          posts = data.newsPosts
            .filter(p => p.title && p.title.length > 5 && p.title.length < 200)
            .map(p => ({ title: p.title, url: p.postUrl }));
        }
      } catch (_) {}
    }
    // Fallback: buscar títulos en el JSON con regex
    if (posts.length === 0) {
      const titleRegex = /"title":"([^"\\]*(?:\\.[^"\\]*)*)","typeId"/g;
      const urlRegex = /"postUrl":"([^"]*)"/g;
      const titles = [];
      const urls = [];
      let m;
      while ((m = titleRegex.exec(html)) !== null && titles.length < 30) {
        const t = m[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, c) => String.fromCharCode(parseInt(c, 16))).trim();
        if (t.length > 10 && t.length < 200 && !t.includes('Wowhead')) titles.push(t);
      }
      while ((m = urlRegex.exec(html)) !== null && urls.length < 30) urls.push(m[1]);
      for (let i = 0; i < Math.min(titles.length, urls.length); i++) {
        posts.push({ title: titles[i], url: urls[i] });
      }
    }
    if (posts.length > 0) {
      const random = posts[Math.floor(Math.random() * posts.length)];
      let fullUrl = random.url;
      if (fullUrl) {
        if (!fullUrl.startsWith('http')) {
          fullUrl = fullUrl.startsWith('/') ? WOWHEAD_ES_BASE + fullUrl : WOWHEAD_ES_BASE + '/' + fullUrl;
        } else if (fullUrl.includes('www.wowhead.com')) {
          fullUrl = fullUrl.replace('www.wowhead.com', 'es.wowhead.com');
        }
      }
      await chrome.storage.local.set({
        lastRandomNews: random.title,
        lastRandomNewsUrl: fullUrl || null
      });
    } else {
      await chrome.storage.local.set({ lastRandomNews: "Sin noticias recientes de WoWHead.", lastRandomNewsUrl: null });
    }
    return keywordFound;
  } catch (e) {
    console.error("Error WoWHead:", e);
    await chrome.storage.local.set({ lastRandomNews: "Error al conectar con WoWHead.", lastRandomNewsUrl: null });
    return false;
  }
}

async function checkSite(url, keyword) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    const lower = text.toLowerCase();
    const found = BLIZZARD_KEYWORDS.some(k => lower.includes(k.toLowerCase()))
      || lower.includes(keyword.toLowerCase());
    if (found) {
      sendAlert("¡Posibles días gratis en Blizzard!");
      return true;
    }
    return false;
  } catch (e) {
    console.error("Error Blizzard:", e);
    return false;
  }
}

function sendAlert(msg) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icon.png',
    title: 'WoW Sentry',
    message: msg,
    priority: 2
  });
}

function setBadgeCount(count) {
  chrome.storage.local.set({ badgeCount: count });
  if (count > 0) {
    const text = count > 99 ? '99+' : String(count);
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: '#00aa00' });
    chrome.action.setTitle({ title: count === 1 ? '1 palabra clave encontrada · WoW Sentry' : count + ' coincidencias encontradas · WoW Sentry' });
  } else {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: 'WoW Sentry – Alertas y noticias de WoW' });
  }
}

// Al instalar, dejar badge vacío; restaurar al iniciar si había conteo guardado
chrome.runtime.onStartup.addListener(async () => {
  const r = await chrome.storage.local.get(['badgeCount']);
  if (r.badgeCount != null) await setBadgeCount(r.badgeCount);
});
