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
