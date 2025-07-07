const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genIA = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gerarRespostaGemini(promptIA, perguntaUsuario) {
  const model = genIA.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const userPrompt = `${promptIA}\nUsuário: ${perguntaUsuario}`;

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
    });

    const response = result.response.text();
    return response;
  } catch (err) {
    console.error("Erro na IA Gemini:", err);
    return "⚠️ Desculpe, houve um erro ao gerar a resposta da IA.";
  }
}

module.exports = { gerarRespostaGemini };
