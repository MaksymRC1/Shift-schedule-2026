export default async function handler(req, res) {
  // Use a secret parameter to protect this endpoint
  const { secret } = req.query;
  
  if (secret !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = process.env.TG_BOT_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'Missing TG_BOT_TOKEN' });
  }

  // Construct the webhook URL dynamically based on the Vercel host
  const host = req.headers.host;
  // Use https always in production on Vercel
  const webhookUrl = `https://${host}/api/webhook`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const data = await response.json();
    
    return res.status(200).json({
      webhookUrl,
      telegramResponse: data
    });
  } catch (error) {
    console.error('Error setting webhook:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
