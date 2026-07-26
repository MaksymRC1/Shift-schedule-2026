/**
 * Telegram Bot Server Helper (Long Polling)
 * Призначений для запуску на сервері або локальному комп'ютері (node telegram_bot.js),
 * щоб відповідати на запити користувачів (наприклад, команду /stats) у Telegram.
 */

const https = require('https');

// Базові налаштування (за замовчуванням використовуються зашифровані токени з проекту)
const BOT_TOKEN = process.env.TG_BOT_TOKEN || Buffer.from("ODYzMDU3NTgyODpBQUZQMk1VbV9nakJsYl9pTXZsaF9HX2xmaXZPSlpyN1B2UQ==", 'base64').toString('utf8');
const ADMIN_CHAT_ID = process.env.TG_CHAT_ID || Buffer.from("MTQ2NTkzODczNw==", 'base64').toString('utf8');

let offset = 0;

console.log('🤖 Telegram Bot Server запущено! Очікування команд (/stats, /help)...');

function apiRequest(method, data, callback) {
  const payload = JSON.stringify(data);
  const req = https.request({
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${BOT_TOKEN}/${method}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(body);
        callback(null, json);
      } catch (e) {
        callback(e, null);
      }
    });
  });

  req.on('error', (err) => callback(err, null));
  req.write(payload);
  req.end();
}

function sendReply(chatId, text) {
  apiRequest('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  }, (err, res) => {
    if (err || !res.ok) {
      console.error('Помилка відправки повідомлення:', err || res);
    }
  });
}

function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || '').trim();
  const userName = msg.from.first_name || 'Користувач';

  console.log(`[${new Date().toLocaleTimeString('uk-UA')}] Повідомлення від ${userName} (${chatId}): ${text}`);

  if (text === '/start' || text === '/help') {
    sendReply(chatId, `
👋 <b>Вітаємо, ${userName}!</b>
Я бот підтримки додатку <b>Графік змін</b>.

📌 <b>Доступні команди:</b>
/stats — Отримати звіт та статус сервера графіків
/help — Допомога та контакти
    `.trim());
  } else if (text === '/stats') {
    // Генерація відповіді зі статистикою по запиту бота в Telegram
    sendReply(chatId, `
📊 <b>Запит статистики (Server Report):</b>

🟢 <b>Статус:</b> Сервер активний
📅 <b>Поточна дата:</b> ${new Date().toLocaleDateString('uk-UA')}
⏰ <b>Час сервера:</b> ${new Date().toLocaleTimeString('uk-UA')}
🌐 <b>Режим:</b> PWA / Web Multi-year
⚡ <b>Алгоритм:</b> 15-денний цикл (А, Б, В, Г, Д)
    `.trim());
  } else {
    sendReply(chatId, `
💡 Ваше повідомлення прийнято! Якщо ви хочете переглянути статистику, надішліть команду /stats.
    `.trim());
  }
}

function poll() {
  apiRequest('getUpdates', { offset: offset, timeout: 30 }, (err, res) => {
    if (!err && res && res.ok && Array.isArray(res.result)) {
      res.result.forEach(update => {
        offset = update.update_id + 1;
        if (update.message) {
          handleMessage(update.message);
        }
      });
    }
    setTimeout(poll, 1000);
  });
}

// Запуск циклу опитування Telegram API
poll();
