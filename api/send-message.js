export default async function handler(req, res) {
  // Allow only POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { chatId, text } = req.body;
    
    if (!chatId || !text) {
      return res.status(400).json({ error: 'Missing chatId or text' });
    }

    const token = process.env.TG_BOT_TOKEN;
    if (!token) {
      console.error('TG_BOT_TOKEN is missing in Environment Variables.');
      return res.status(500).json({ error: 'Bot token not configured on server' });
    }

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json();

    if (data.ok) {
      return res.status(200).json({ ok: true });
    } else {
      console.error('Telegram API Error:', data);
      return res.status(500).json({ error: 'Failed to send message to Telegram', details: data });
    }
  } catch (error) {
    console.error('Error in send-message webhook:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
