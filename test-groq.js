const Groq = require("groq-sdk");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

async function main() {
    try {
        console.log("Connecting to GPT-OSS 120B...");

        const response = await groq.chat.completions.create({
            model: "openai/gpt-oss-120b",
            messages: [
                {
                    role: "user",
                    content: "Hello! Introduce yourself in one short sentence."
                }
            ]
        });

        console.log("\nAI RESPONSE:");
        console.log(response.choices[0].message.content);

    } catch (error) {
        console.error("\nERROR:");
        console.error(error.message);
    }
}

main();