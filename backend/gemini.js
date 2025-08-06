// const { OpenAI } = require('openai');
// require('dotenv').config();

// const client = new OpenAI({
//   baseURL: 'https://openrouter.ai/api/v1',
//   apiKey: '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'
// });

// async function gerarRespostaOpenRouter(promptIA, perguntaUsuario) {
//   const userPrompt = `${promptIA}\nUsuário: ${perguntaUsuario}`;

//   try {
//     const completion = await client.chat.completions.create({
//       model: 'qwen/qwen3-coder:free',
//       messages: [
//         {
//           role: 'user',
//           content: userPrompt
//         }
//       ],
//       extra_headers: {
//         'HTTP-Referer': 'https://njbot.com.br', // Altere se quiser
//         'X-Title': 'NJBot'
//       },
//       extra_body: {}
//     });

//     return completion.choices[0].message.content;
//   } catch (err) {
//     console.error("Erro na IA OpenRouter:", err.response?.data || err.message);
//     return "⚠️ Erro ao gerar resposta com a IA OpenRouter.";
//   }
// }

// module.exports = { gerarRespostaOpenRouter };


// gemini.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gerarRespostaGemini(promptIA, perguntaUsuario) {
  const promptCompleto = `${promptIA}\nUsuário: ${perguntaUsuario}`;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(promptCompleto);
    const response = await result.response;
    const text = response.text();

    return text;
  } catch (err) {
    console.error("❌ Erro na IA Gemini:", err);
    return "⚠️ Erro ao gerar resposta com a IA Gemini.";
  }
}

module.exports = { gerarRespostaGemini };
