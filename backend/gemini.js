// // const { GoogleGenerativeAI } = require('@google/generative-ai');
// // require('dotenv').config();

// // const genIA = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// // async function gerarRespostaGemini(promptIA, perguntaUsuario) {
// //   const model = genIA.getGenerativeModel({ model: 'gemini-1.5-flash' });

// //   const prompt = `${promptIA}\nUsuário: ${perguntaUsuario}`;

// //   try {
// //     const result = await model.generateContent({
// //       prompt: prompt,
// //       // você pode adicionar mais configurações aqui se quiser (ex: temperature, maxOutputTokens)
// //     });

// //     // result.candidates é um array, normalmente o primeiro é o melhor resultado
// //     const responseText = result.candidates[0].output;

// //     return responseText;
// //   } catch (err) {
// //     console.error("Erro na IA Gemini:", err);
// //     return "⚠️ Desculpe, houve um erro ao gerar a resposta da IA.";
// //   }
// // }

// // module.exports = { gerarRespostaGemini };


// const { GoogleGenerativeAI } = require('@google/generative-ai');
// require('dotenv').config();

// const genIA = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// async function gerarRespostaGemini(promptIA, perguntaUsuario) {
//   const model = genIA.getGenerativeModel({ model: 'gemini-1.5-flash' });

//   const prompt = `${promptIA}\nUsuário: ${perguntaUsuario}`;

//   try {
//     const result = await model.generateContent([
//       { role: 'user', parts: [{ text: prompt }] }
//     ]);

//     const response = await result.response;
//     const text = await response.text(); // usa o método certo para extrair o texto

//     return text;
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
