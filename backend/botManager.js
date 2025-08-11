// botManager.js
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const empresaDB = require('./models/Empresa');
const handleMensagem = require('./handlers/chatbot');

const bots = {};  // cache { nomeEmpresa: sock }
const atendimentosManuais = {};  // { chaveEmpresa_remetente: { ativo, ultimoContato } }
const qrCodesGerados = {}; // { nomeEmpresa: base64QR }

async function iniciarBot(empresa) {
  const pasta = path.join(__dirname, 'bots', empresa.nome, 'auth_info_baileys');
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(pasta);
  const sock = makeWASocket({ auth: state });

  let resolveQRCode;
  const qrCodePromise = new Promise(resolve => { resolveQRCode = resolve; });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodesGerados[empresa.nome] = await qrcode.toDataURL(qr);
      resolveQRCode(qr);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;

      const empresaAtualizada = await empresaDB.findById(empresa._id);
      if (shouldReconnect && empresaAtualizada?.botAtivo) {
        console.log(`[RECONNECT] Reconectando bot de ${empresaAtualizada.nome}...`);
        iniciarBot(empresaAtualizada);
      } else {
        console.log(`[RECONNECT] Não reconectando: botAtivo=${empresaAtualizada?.botAtivo}`);
      }
    }

    if (connection === 'open') {
      console.log(`🤖 Conectado com sucesso: ${empresa.nome}`);
    }
  });

//   sock.ev.on('messages.upsert', async (m) => {
//     try {
//       const msg = m.messages?.[0];
//       const sender = msg.key.remoteJid;
//       if (!msg || !msg.message) return;

//       const texto =
//         msg.message?.conversation ||
//         msg.message?.extendedTextMessage?.text ||
//         msg.message?.imageMessage?.caption ||
//         msg.message?.videoMessage?.caption ||
//         msg.message?.documentMessage?.caption ||
//         msg.message?.buttonsResponseMessage?.selectedButtonId ||
//         msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
//         '';

//       const textoLower = texto.toLowerCase().trim();
//       const comandosPermitidosMesmoFromMe = ['#bot', '#sair', '#encerrar', 'bot'];
//       if (msg.key.fromMe && !comandosPermitidosMesmoFromMe.includes(textoLower)) return;

//       const empresaAtualizada = await empresaDB.findById(empresa._id);
//       if (!empresaAtualizada?.botAtivo) return;

//       const chaveAtendimento = `${empresaAtualizada._id}_${sender}`;
//       const saudacoes = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'];
//       const comandosEspeciais = ['#sair', '#bot', 'bot'];

//       if (comandosEspeciais.includes(textoLower)) {
//         if (textoLower === '#sair') {
//           delete atendimentosManuais[chaveAtendimento];
//           await sock.sendMessage(sender, { text: '✅ Conversa reiniciada. Digite "oi" para começar.' });
//           return;
//         }
//         if (textoLower === '#bot' || textoLower === 'bot') {
//           atendimentosManuais[chaveAtendimento] = { ativo: false };
//           // Continuando botManager.js (completando o trecho faltante)

//           await sock.sendMessage(sender, { text: '🤖 Atendimento automático ativado.' });
//           return;
//         }
//       }

//       const palavrasChaveAtendente = [
//         'atendente', 'humano', 'pessoa', 'falar com atendente', 'falar com humano',
//         'quero atendimento humano', 'quero falar com alguém', 'ajuda de um atendente',
//         'quero um atendente', 'preciso de ajuda humana'
//       ];

//       if (palavrasChaveAtendente.some(p => textoLower.includes(p))) {
//         atendimentosManuais[chaveAtendimento] = { ativo: true, ultimoContato: new Date() };
//         await sock.sendMessage(sender, { text: '📨 Solicitação enviada ao atendente humano. Aguarde um momento.' });
//         return;
//       }

//       if (atendimentosManuais[chaveAtendimento]?.ativo) {
//         atendimentosManuais[chaveAtendimento].ultimoContato = new Date();
//         console.log(`👤 Atendimento humano ativo para: ${sender}`);
//         return; // Não responde via bot automático enquanto atendimento humano estiver ativo
//       }

//       if (saudacoes.includes(textoLower)) {
//         await sock.sendMessage(sender, {
//             text: 'Olá! 👋 Como posso te ajudar? Se quiser falar com um atendente humano, digite "atendente" ou "humano".'
//         });
//         return;
//         }

//       await sock.sendPresenceUpdate('composing', sender);
//       const resposta = await handleMensagem(empresaAtualizada._id, textoLower);
//       await sock.sendMessage(sender, { text: resposta.resposta });

//     } catch (err) {
//       console.error('❌ Erro no processamento da mensagem:', err);
//     }
//   });

sock.ev.on('messages.upsert', async (m) => {
  try {
    const msg = m.messages?.[0];
    if (!msg || !msg.message) return;

    const sender = msg.key.remoteJid;
    const texto =
      msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      msg.message?.documentMessage?.caption ||
      msg.message?.buttonsResponseMessage?.selectedButtonId ||
      msg.message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      '';

    const textoLower = texto.toLowerCase().trim();
    const chaveAtendimento = `${empresa._id}_${sender}`;

    // Verifica se é uma mensagem do atendente (fromMe) E não é um comando especial
    const comandosPermitidosFromMe = ['#bot', '#sair', '#encerrar', 'bot'];
    if (msg.key.fromMe && !comandosPermitidosFromMe.includes(textoLower)) {
      // Ativa modo humano apenas se for mensagem real do atendente (não comando)
      atendimentosManuais[chaveAtendimento] = { ativo: true, ultimoContato: new Date() };
      console.log(`👤 Atendente humano respondendo para ${sender}. Bot pausado.`);
      return;
    }

    const empresaAtualizada = await empresaDB.findById(empresa._id);
    if (!empresaAtualizada?.botAtivo) return;

    // Se atendimento humano já está ativo, apenas atualiza o timestamp
    if (atendimentosManuais[chaveAtendimento]?.ativo) {
      atendimentosManuais[chaveAtendimento].ultimoContato = new Date();
      console.log(`👤 Atendimento humano ativo para: ${sender}. Bot automático pausado.`);
      return;
    }

    // Comandos especiais para controle do atendimento
    if (textoLower === '#sair') {
      delete atendimentosManuais[chaveAtendimento];
      await sock.sendMessage(sender, { text: '✅ Conversa reiniciada. Digite "oi" para começar.' });
      return;
    }
    if (textoLower === '#bot' || textoLower === 'bot') {
      atendimentosManuais[chaveAtendimento] = { ativo: false };
      await sock.sendMessage(sender, { text: '🤖 Atendimento automático ativado.' });
      return;
    }

    const palavrasChaveAtendente = [
      'atendente', 'humano', 'pessoa', 'falar com atendente', 'falar com humano',
      'quero atendimento humano', 'quero falar com alguém', 'ajuda de um atendente',
      'quero um atendente', 'preciso de ajuda humana'
    ];

    if (palavrasChaveAtendente.some(p => textoLower.includes(p))) {
      atendimentosManuais[chaveAtendimento] = { ativo: true, ultimoContato: new Date() };
      await sock.sendMessage(sender, { text: '📨 Solicitação enviada ao atendente humano. Aguarde um momento.' });
      return;
    }

    const saudacoes = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'];
    if (saudacoes.includes(textoLower)) {
      await sock.sendMessage(sender, {
        text: 'Olá! 👋 Como posso te ajudar? Se quiser falar com um atendente humano, digite "atendente" ou "humano".'
      });
      return;
    }

    await sock.sendPresenceUpdate('composing', sender);
    const resposta = await handleMensagem(empresaAtualizada._id, textoLower);
    await sock.sendMessage(sender, { text: resposta.resposta });

  } catch (err) {
    console.error('❌ Erro no processamento da mensagem:', err);
  }
});

  bots[empresa.nome] = sock;
  // Retorna a QR code já em base64 para facilitar front
  const qrCodeBase64 = await qrCodePromise.then(qr => qrcode.toDataURL(qr));
  return qrCodeBase64;
}

function getQRCode(nomeEmpresa) {
  return qrCodesGerados[nomeEmpresa] || null;
}

async function reiniciarBot(empresa) {
  const authPath = path.join(__dirname, 'bots', empresa.nome, 'auth_info_baileys');
  if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });

  // Se existir bot rodando, encerra
  if (bots[empresa.nome]) {
    try {
      if (bots[empresa.nome].end) {
        await bots[empresa.nome].end();
      } else if (bots[empresa.nome].logout) {
        await bots[empresa.nome].logout();
      }
    } catch (err) {
      console.error(`Erro ao encerrar bot ${empresa.nome} antes de reiniciar:`, err);
    }
    delete bots[empresa.nome];
  }

  return iniciarBot(empresa);
}

async function toggleBot(empresa) {
  // Desliga bot
  if (!empresa.botAtivo && bots[empresa.nome]) {
    try {
      if (bots[empresa.nome].end) {
        await bots[empresa.nome].end();
      } else if (bots[empresa.nome].logout) {
        await bots[empresa.nome].logout();
      }
      delete bots[empresa.nome];
      console.log(`[TOGGLE] Bot de ${empresa.nome} desligado.`);
    } catch (err) {
      console.error(`[TOGGLE] Erro ao desligar bot de ${empresa.nome}:`, err);
    }
  }

  // Liga bot
  if (empresa.botAtivo && !bots[empresa.nome]) {
    try {
      await iniciarBot(empresa);
      console.log(`[TOGGLE] Bot de ${empresa.nome} iniciado.`);
    } catch (err) {
      console.error(`[TOGGLE] Erro ao iniciar bot de ${empresa.nome}:`, err);
    }
  }
}

function deletarEmpresa(nomeEmpresa) {
  // Remove QRCode cache
  delete qrCodesGerados[nomeEmpresa];

  // Encerra bot se estiver rodando
  if (bots[nomeEmpresa]) {
    try {
      bots[nomeEmpresa].end ? bots[nomeEmpresa].end() : bots[nomeEmpresa].logout();
    } catch (err) {
      console.error(`Erro ao encerrar bot ${nomeEmpresa} durante exclusão:`, err);
    }
    delete bots[nomeEmpresa];
  }
}

// Limpa atendimentosManuais inativos (10 minutos sem contato)
setInterval(() => {
  const agora = new Date();

  for (const chave in atendimentosManuais) {
    const atendimento = atendimentosManuais[chave];
    if (atendimento.ativo && atendimento.ultimoContato) {
      const diffMinutos = (agora - atendimento.ultimoContato) / 1000 / 60;
      if (diffMinutos >= 10) {
        atendimento.ativo = false;
        atendimento.ultimoContato = null;

        const [empresaId, sender] = chave.split('_');
        const botSock = Object.values(bots).find(sock => sock.authState.creds?.me?.id?.includes(sender?.split('@')[0]));
        if (botSock) {
          botSock.sendMessage(sender, {
            text: '🤖 Atendimento humano encerrado por inatividade. Agora você está falando com o assistente virtual novamente.'
          }).catch(console.error);
        }
      }
    }
  }
}, 60 * 1000);

module.exports = {
  iniciarBot,
  getQRCode,
  reiniciarBot,
  toggleBot,
  deletarEmpresa
};

