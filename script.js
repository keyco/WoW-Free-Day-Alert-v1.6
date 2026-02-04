// Crear una alarma para revisar cada 60 minutos
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("checkWoW", { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkWoW") {
    checkBlizzardNews();
  }
});

async function checkBlizzardNews() {
  try {
    const response = await fetch('https://news.blizzard.com/es-es/world-of-warcraft');
    const text = await response.text();
    
    // Palabras clave que Blizzard usa para días gratis
    const keywords = ["Welcome Back", "Fin de semana gratis", "días de juego gratis", "regresa a WoW"];
    
    const found = keywords.some(word => text.toLowerCase().includes(word.toLowerCase()));

    if (found) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon.png', // Necesitarás una imagen icon.png en la carpeta
        title: '¡ALERTA DE WOW!',
        message: 'Se han detectado posibles días gratis en la web de Blizzard.',
        priority: 2
      });
    }
  } catch (error) {
    console.log("Error al revisar noticias:", error);
  }
}