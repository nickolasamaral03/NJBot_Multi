// handlers/chatbot.js
async function handleMensagem(empresaId, setorNome, mensagemUsuario) {
  const empresa = await Empresa.findById(empresaId);
  
  if (!empresa?.botAtivo) {
    throw new Error('Empresa não encontrada ou bot desativado');
  }

  const setor = empresa.setores.find(s => 
    s.nome.toLowerCase() === setorNome.toLowerCase() && s.ativo
  );

  if (!setor) {
    return {
      resposta: `Setor ${setorNome} não encontrado. Setores disponíveis:\n` +
        empresa.setores.filter(s => s.ativo).map(s => `• ${s.nome}`).join('\n'),
      terminado: true
    };
  }

  // 1. Verifica fluxo específico do setor
  if (setor.fluxo?.opcoes?.length > 0) {
    const opcao = setor.fluxo.opcoes.find(o => 
      mensagemUsuario.toLowerCase().includes(o.texto.toLowerCase())
    );

    if (opcao) {
      switch (opcao.acao) {
        case 'encaminhar':
          return {
            resposta: `Encaminhando para ${opcao.destino}...`,
            proximoSetor: opcao.destino
          };
        case 'resposta':
          return { resposta: opcao.destino, terminado: true };
        case 'finalizar':
          return { resposta: opcao.destino, terminado: true };
      }
    }

    return {
      resposta: setor.fluxo.mensagemInicial,
      opcoes: setor.fluxo.opcoes.map(o => o.texto)
    };
  } // respostas programadas

  // 2. Fallback para IA generativa
  return {
    resposta: await gerarRespostaIA(setor.prompt, mensagemUsuario),
    terminado: true
  };
}

// VAI LIDAR COM A PARTE DE SETORES E SE NÃO TIVER RESPOSTA VAI CHAMAR A IA