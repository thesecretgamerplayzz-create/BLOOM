// Local Bloom server: serves the app and keeps communication with Ollama on this computer.
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = 3000;
const root = __dirname;
const model = 'qwen3:1.7b';
const systemPrompt = `You are Bloom, a warm, supportive companion for students.
Keep responses brief (two to four sentences), calm, and easy to understand.
Never diagnose, prescribe treatment, claim to be a therapist, or give medical advice.
Do not shame the user. Encourage small, practical next steps when helpful.
If the user mentions self-harm, suicide, abuse, immediate danger, or feeling unsafe, say you are glad they told you and urge them to contact emergency services, a local helpline, a trusted adult, counsellor, teacher, or family member immediately.`;

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

function serveFile(req, res) {
  const file = req.url === '/' ? 'index.html' : req.url.split('?')[0].replace(/^\//, '');
  const safePath = path.resolve(root, file);
  if (!safePath.startsWith(root)) return send(res, 403, 'Forbidden', 'text/plain');
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
  fs.readFile(safePath, (error, data) => {
    if (error) return send(res, 404, 'Not found', 'text/plain');
    send(res, 200, data, `${types[path.extname(safePath)] || 'application/octet-stream'}; charset=utf-8`);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/chat') {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', async () => {
      try {
        const { message } = JSON.parse(raw);
        if (!message || typeof message !== 'string') return send(res, 400, { error: 'A message is required.' });
        const ollama = await fetch('http://127.0.0.1:11434/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model, stream: false, think: false,
            messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message.slice(0, 500) }]
          })
        });
        const data = await ollama.json();
        if (!ollama.ok) throw new Error(data.error || 'Ollama request failed');
        send(res, 200, { reply: data.message?.content || 'I’m here with you.' });
      } catch (error) {
        send(res, 503, { error: 'Could not reach the local model. Is Ollama running?' });
      }
    });
    return;
  }
  if (req.method === 'GET') return serveFile(req, res);
  send(res, 405, { error: 'Method not allowed.' });
});

server.listen(port, '127.0.0.1', () => console.log(`Bloom is ready at http://localhost:${port}`));
