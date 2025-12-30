export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  res.status(200).json({
    success: true,
    message: 'Chat API endpoint is accessible',
    method: req.method,
    hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY
  });
}
