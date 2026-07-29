const https = require('https');

const BOT_TOKEN = process.env.TG_BOT_TOKEN || "";

function apiRequest(method, data) {
  return new Promise((resolve, reject) => {
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
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function sendReply(chatId, text) {
  try {
    const res = await apiRequest('sendMessage', {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });
    if (!res.ok) {
      console.error('Telegram API error:', res);
    }
  } catch (err) {
    console.error('Network error:', err);
  }
}

export default async function handler(req, res) {
  // Only allow POST requests for webhook
  if (req.method !== 'POST') {
    return res.status(200).send('Telegram Bot Webhook Endpoint');
  }

  try {
    const update = req.body;
    
    if (update && update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const text = (msg.text || '').trim();
      const userName = msg.from.first_name || 'Користувач';

      console.log(`[Webhook] Message from ${userName} (${chatId}): ${text}`);

      if (text === '/start' || text === '/help') {
        await sendReply(chatId, `
👋 <b>Вітаємо, ${userName}!</b>
Я бот підтримки додатку <b>Графік змін</b>.

📌 <b>Доступні команди:</b>
/stats — Отримати звіт та статус сервера графіків
/help — Допомога та контакти
        `.trim());
      } else if (text === '/stats') {
        await sendReply(chatId, `
📊 <b>Запит статистики (Server Report):</b>

🟢 <b>Статус:</b> Сервер активний
📅 <b>Поточна дата:</b> ${new Date().toLocaleDateString('uk-UA')}
⏰ <b>Час сервера:</b> ${new Date().toLocaleTimeString('uk-UA')}
🌐 <b>Режим:</b> PWA / Web Multi-year
⚡ <b>Алгоритм:</b> 15-денний цикл (А, Б, В, Г, Д)
        `.trim());
      } else {
        await sendReply(chatId, `
💡 Ваше повідомлення прийнято! Якщо ви хочете переглянути статистику, надішліть команду /stats.
        `.trim());
      }
    }

    // Always return 200 OK to Telegram so it knows we received the message
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Error in webhook handler:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
