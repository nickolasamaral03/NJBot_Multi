const Empresa = require('../models/Empresa');
const { gerarRespostaOpenRouter } = require('../gemini');

async function handleMensagem(empresaId, mensagemUsuario) {
  const empresa = await Empresa.findById(empresaId);
  if (!empresa) return { resposta: '⚠️ Empresa não encontrada.' };

  const promptCompleto = `${empresa.promptIA}\nUsuário: ${mensagemUsuario}\nIA:`;
  const respostaIA = await gerarRespostaOpenRouter(promptCompleto, mensagemUsuario);

  return {
    resposta: respostaIA
  };
}

module.exports = handleMensagem;
