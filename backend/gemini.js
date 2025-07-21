// const { GoogleGenerativeAI } = require('@google/generative-ai');
// require('dotenv').config();

// const genIA = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// async function gerarRespostaGemini(promptIA, perguntaUsuario) {
//   const model = genIA.getGenerativeModel({ model: 'gemini-1.5-flash' });

//   const userPrompt = `${promptIA}\nUsuário: ${perguntaUsuario}`;
//   console.log('Prompt enviado para IA:', userPrompt);

//   try {
//     const result = await model.generateContent({
//       contents: [
//         {
//           role: "user",
//           parts: [{ text: userPrompt }],
//         },
//       ],
//     });

//     const response = result.response.text();
//     console.log("Resposta da IA:", response)
//     return response;
//   } catch (err) {
//     console.error("Erro na IA Gemini:", err);
//     return "⚠️ Desculpe, houve um erro ao gerar a resposta da IA.";
//   }
// }

// module.exports = { gerarRespostaGemini };


const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genIA = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function gerarRespostaGemini(promptIA, perguntaUsuario) {
  const model = genIA.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const userPrompt = `${promptIA}\nUsuário: ${perguntaUsuario}`;
  console.log('Prompt enviado para IA:', userPrompt);

  try {
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
    });

    const response = await result.response;
    const text = await response.text();
    return text;
  } catch (err) {
    console.error("Erro na IA Gemini:", err);
    return "⚠️ Desculpe, houve um erro ao gerar a resposta da IA.";
  }
}

module.exports = { gerarRespostaGemini };
