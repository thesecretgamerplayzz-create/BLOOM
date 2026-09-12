const http = require("http");
const fs = require("fs");
const path = require("path");
const Groq = require("groq-sdk");

const port = 3000;
const root = __dirname;

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const model = "openai/gpt-oss-120b";

const systemPrompt = `
You are Bloom, a warm, supportive companion for students.

Keep responses brief, usually two to four sentences.
Use calm, simple, natural language.

You are an AI companion, not a therapist, doctor, counsellor, or emergency service.

Never diagnose a mental or physical condition.
Never prescribe medication or treatment.
Never claim professional credentials.
Do not shame, guilt, manipulate, or frighten the user.

Encourage small, practical next steps when helpful.

Respect the user's privacy.
Only use memories supplied in the MEMORY section.
Do not invent memories.
Do not claim to remember something that is not supplied.

If the user asks you to remember something, acknowledge it naturally.
If memory is disabled, explain briefly that they can enable Buddy Memory in settings.

If the user mentions self-harm, suicide, abuse, immediate danger,
or says they feel unsafe, respond with care and encourage them
to contact emergency services, a local crisis service, a trusted adult,
counsellor, teacher, family member, or another trusted person immediately.

Do not provide instructions for self-harm or suicide.

The personality selected by the user should influence your tone:

calm:
Gentle, grounded and reassuring.

friendly:
Warm, conversational and encouraging.

motivator:
Positive and action-oriented without being pushy.

student:
Casual, relatable and student-friendly.
`;

function send(res, status, body, type = "application/json") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });

  res.end(
    type === "application/json"
      ? JSON.stringify(body)
      : body
  );
}

function serveFile(req, res) {
  let file =
    req.url === "/"
      ? "index.html"
      : req.url.split("?")[0].replace(/^\/+/, "");

  const safePath = path.resolve(root, file);

  if (
    safePath !== root &&
    !safePath.startsWith(root + path.sep)
  ) {
    return send(
      res,
      403,
      "Forbidden",
      "text/plain"
    );
  }

  const types = {
    ".html": "text/html",
    ".js": "application/javascript",
    ".css": "text/css",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml"
  };

  fs.readFile(safePath, (error, data) => {
    if (error) {
      return send(
        res,
        404,
        "Not found",
        "text/plain"
      );
    }

    send(
      res,
      200,
      data,
      `${types[path.extname(safePath)] ||
        "application/octet-stream"}; charset=utf-8`
    );
  });
}

function cleanText(value, max = 500) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}

function cleanMemory(memory) {
  if (!Array.isArray(memory)) {
    return [];
  }

  return memory
    .filter(item => item && typeof item === "object")
    .map(item => ({
      text: cleanText(item.text, 300),
      createdAt: item.createdAt || null
    }))
    .filter(item => item.text)
    .slice(-10);
}

function cleanHistory(history) {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(item =>
      item &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string"
    )
    .map(item => ({
      role: item.role,
      content: cleanText(item.content, 500)
    }))
    .filter(item => item.content)
    .slice(-12);
}

const server = http.createServer((req, res) => {

  /*
   * CHAT API
   */
  if (
    req.method === "POST" &&
    req.url === "/api/chat"
  ) {

    let raw = "";

    req.on("data", chunk => {

      raw += chunk;

      // Prevent unnecessarily large requests.
      if (raw.length > 30000) {
        req.destroy();
      }
    });

    req.on("end", async () => {

      try {

        const body = JSON.parse(raw);

        const message =
          cleanText(body.message, 500);

        if (!message) {
          return send(res, 400, {
            error: "A message is required."
          });
        }

        const personality =
          ["calm", "friendly", "motivator", "student"]
            .includes(body.personality)
            ? body.personality
            : "calm";

        const memory =
          body.memoryConsent
            ? cleanMemory(body.memory)
            : [];

        const history =
          cleanHistory(body.history);

        const messages = [
          {
            role: "system",
            content: systemPrompt
          }
        ];

        /*
         * MEMORY
         */
        if (memory.length) {

          messages.push({
            role: "system",
            content:
              `MEMORY — only use these as background context:\n` +
              memory
                .map(item => `- ${item.text}`)
                .join("\n")
          });
        }

        /*
         * PERSONALITY
         */
        messages.push({
          role: "system",
          content:
            `The user's selected Bloom personality is: ${personality}.`
        });

        /*
         * RECENT CHAT HISTORY
         */
        messages.push(
          ...history.map(item => ({
            role: item.role,
            content: item.content
          }))
        );

        /*
         * CURRENT MESSAGE
         */
        messages.push({
          role: "user",
          content: message
        });

        const completion =
          await groq.chat.completions.create({
            model,
            messages,
            temperature: 0.6,
            max_tokens: 250
          });

        const reply =
          completion.choices?.[0]?.message?.content ||
          "I'm here with you.";

        send(res, 200, {
          reply: cleanText(reply, 1200)
        });

      } catch (error) {

        console.error("Groq error:", error);

        send(res, 503, {
          error:
            "Could not reach the AI model. Please try again."
        });
      }
    });

    return;
  }

  /*
   * WEBSITE
   */
  if (req.method === "GET") {
    return serveFile(req, res);
  }

  send(res, 405, {
    error: "Method not allowed."
  });
});

server.listen(
  port,
  "127.0.0.1",
  () => {

    console.log(
      `Bloom is ready at http://localhost:${port}`
    );

    console.log(
      `AI model: ${model}`
    );
  }
);