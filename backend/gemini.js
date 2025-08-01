const { OpenAI } = require('openai');
require('dotenv').config();

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY
});

async function gerarRespostaOpenRouter(promptIA, perguntaUsuario) {
  const userPrompt = `${promptIA}\nUsuário: ${perguntaUsuario}`;

  try {
    const completion = await client.chat.completions.create({
      model: 'qwen/qwen3-coder:free',
      messages: [
        {
          role: 'user',
          content: userPrompt
        }
      ],
      extra_headers: {
        'HTTP-Referer': 'https://njbot.com.br', // Altere se quiser
        'X-Title': 'NJBot'
      },
      extra_body: {}
    });

    return completion.choices[0].message.content;
  } catch (err) {
    console.error("Erro na IA OpenRouter:", err.response?.data || err.message);
    return "⚠️ Erro ao gerar resposta com a IA OpenRouter.";
  }
}

module.exports = { gerarRespostaOpenRouter };
