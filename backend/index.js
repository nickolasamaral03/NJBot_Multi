const express = require('express');
const fs = require('fs');
const path = require('path');
const qrcode = require('qrcode');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const { gerarRespostaGemini } = require('./gemini');
const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const Empresa = require('./models/Empresa');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Conectado ao MongoDB Atlas');
}).catch(err => {
  console.error('❌ Erro ao conectar no MongoDB:', err);
});

const bots = {};
const atendimentosManuais = {}; // { 'empresa_cliente': { ativo, ultimoContato } }
const qrCodesGerados = {}; // { nomeEmpresa: base64QRCode }

async function chamarIA(promptIA, mensagemUsuario) {
  return await gerarRespostaGemini(promptIA, mensagemUsuario);
}

async function iniciarBot(empresa) {
  const pasta = path.join(__dirname, 'bots', empresa.nome, 'auth_info_baileys');
  if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(pasta);
  const sock = makeWASocket({ auth: state });

  let resolveQRCode;
  const qrCodePromise = new Promise((resolve) => {
    resolveQRCode = resolve;
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      qrCodesGerados[empresa.nome] = await qrcode.toDataURL(qr);
      resolveQRCode(qr);
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) iniciarBot(empresa);
    }

    if (connection === 'open') {
      console.log(`🤖 Conectado com sucesso: ${empresa.nome}`);
    }
  });

// sock.ev.on('messages.upsert', async (m) => {
//   try {
//     const msg = m.messages[0];
//     if (!msg.message) return;

//     const sender = msg.key.remoteJid;
//     const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
//     const textoLower = texto.toLowerCase();
//     const idEmpresa = empresa.nome;
//     const chaveAtendimento = `${idEmpresa}_${sender}`;

//     // Palavras-chave que ativam atendimento humano
//     const comandosAtivarHumano = ['atendente', 'suporte', 'humano'];

//     // Comandos para reativar o bot
//     if (['#bot', 'bot', 'voltar ao bot'].includes(textoLower)) {
//       atendimentosManuais[chaveAtendimento] = { ativo: false, ultimoContato: null };
//       await sock.sendMessage(sender, { text: '🤖 Atendimento automático reativado.' });
//       console.log(`🤖 Bot reativado manualmente para ${chaveAtendimento}`);
//       return;
//     }

//     // Detecta se a mensagem é do atendente humano (mensagem enviada pelo próprio dispositivo)
//     const isMensagemAtendente = msg.key.fromMe === true;

//     if (isMensagemAtendente) {
//       if (!atendimentosManuais[chaveAtendimento]?.ativo) {
//         atendimentosManuais[chaveAtendimento] = { ativo: true, ultimoContato: new Date() };
//         console.log(`🧑‍💻 Atendimento humano ativado automaticamente após resposta do atendente (${chaveAtendimento})`);
//       } else {
//         atendimentosManuais[chaveAtendimento].ultimoContato = new Date();
//         console.log(`🧑‍💻 Atendente respondeu, atualizado ultimoContato para ${chaveAtendimento}`);
//       }
//       return; // nunca responde IA se for do atendente
//     }

//     // Se o usuário pedir por atendimento humano
//     if (comandosAtivarHumano.some(cmd => textoLower.includes(cmd))) {
//       atendimentosManuais[chaveAtendimento] = { ativo: true, ultimoContato: new Date() };
//       await sock.sendMessage(sender, { text: '👤 Atendimento humano ativado. Por favor, aguarde o atendente.' });
//       console.log(`👤 Atendimento humano ativado manualmente para ${chaveAtendimento}`);
//       return;
//     }

//     // Se atendimento humano está ativo, IA não responde
//     if (atendimentosManuais[chaveAtendimento]?.ativo) {
//       atendimentosManuais[chaveAtendimento].ultimoContato = new Date(); // atualiza para manter sessão ativa
//       console.log(`⏸️ Bot pausado: atendimento humano ativo para ${chaveAtendimento}`);
//       return;
//     }

//     // Atendimento automático: gera resposta IA
//     const dadosAtualizadosEmpresa = await Empresa.findOne({ nome: empresa.nome });
//     if (!dadosAtualizadosEmpresa?.botAtivo) {
//       console.log('⛔ Bot desativado para empresa:', empresa.nome);
//       return;
//     }

//     const respostaIA = await chamarIA(empresa.promptIA, texto);
//     await sock.sendMessage(sender, { text: respostaIA });
//     console.log(`🤖 Resposta enviada pelo bot para ${chaveAtendimento}`);

//   } catch (error) {
//     console.error('❌ Erro ao processar mensagem:', error);
//   }
// });

sock.ev.on('messages.upsert', async (m) => {
  try {
    const msg = m.messages[0];
    if (!msg.message) return;

    const sender = msg.key.remoteJid;
    const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const textoLower = texto.toLowerCase();
    const idEmpresa = empresa.nome;
    const chaveAtendimento = `${idEmpresa}_${sender}`;

    // Comando exato que ativa o atendimento humano
    const comandoAtivarHumano = 'atendente';

    // Comandos para reativar o bot
    if (['#bot', 'bot', 'voltar ao bot'].includes(textoLower)) {
      atendimentosManuais[chaveAtendimento] = { ativo: false, ultimoContato: null };
      await sock.sendMessage(sender, { text: '🤖 Atendimento automático reativado.' });
      console.log(`🤖 Bot reativado manualmente para ${chaveAtendimento}`);
      return;
    }

    // Detecta se a mensagem foi enviada pelo próprio dispositivo (atendente)
    const isMensagemAtendente = msg.key.fromMe === true;

    if (isMensagemAtendente) {
      // Não ativa atendimento humano automaticamente — apenas registra a atividade se já estiver ativo
      if (atendimentosManuais[chaveAtendimento]?.ativo) {
        atendimentosManuais[chaveAtendimento].ultimoContato = new Date();
        console.log(`🧑‍💻 Atendente respondeu, atualizado ultimoContato para ${chaveAtendimento}`);
      }
      return; // nunca responde IA se for do atendente
    }

    // Se o usuário pedir por "atendente", ativa atendimento humano
    if (textoLower.includes(comandoAtivarHumano)) {
      atendimentosManuais[chaveAtendimento] = { ativo: true, ultimoContato: new Date() };
      await sock.sendMessage(sender, { text: '👤 Atendimento humano ativado. Por favor, aguarde o atendente.' });
      console.log(`👤 Atendimento humano ativado manualmente para ${chaveAtendimento}`);
      return;
    }

    // Se atendimento humano está ativo, IA não responde
    if (atendimentosManuais[chaveAtendimento]?.ativo) {
      atendimentosManuais[chaveAtendimento].ultimoContato = new Date(); // atualiza para manter sessão ativa
      console.log(`⏸️ Bot pausado: atendimento humano ativo para ${chaveAtendimento}`);
      return;
    }

    // Atendimento automático: gera resposta IA
    const dadosAtualizadosEmpresa = await Empresa.findOne({ nome: empresa.nome });
    if (!dadosAtualizadosEmpresa?.botAtivo) {
      console.log('⛔ Bot desativado para empresa:', empresa.nome);
      return;
    }

    const respostaIA = await chamarIA(empresa.promptIA, texto);
    await sock.sendMessage(sender, { text: respostaIA });
    console.log(`🤖 Resposta enviada pelo bot para ${chaveAtendimento}`);

  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
  }
});



  bots[empresa.nome] = sock;

  return { sock, qrCodePromise };
}
// Função que roda a cada minuto para verificar tempo de inatividade do atendimento humano
setInterval(() => {
  const agora = new Date();
  for (const chave in atendimentosManuais) {
    const atendimento = atendimentosManuais[chave];
    if (atendimento.ativo && atendimento.ultimoContato) {
      const diffMinutos = (agora - atendimento.ultimoContato) / 1000 / 60;
      if (diffMinutos >= 10) {
        // Passaram 10 minutos sem contato, volta atendimento automático
        atendimentosManuais[chave] = { ativo: false, ultimoContato: null };
        // Se quiser enviar mensagem ao usuário avisando, pode fazer aqui (precisa ter acesso ao sock e sender)
        // Exemplo: sock.sendMessage(sender, { text: '🤖 Atendimento automático reativado após inatividade.' });
      }
    }
  }
}, 60 * 1000); // a cada 1 minuto


// Iniciar todos os bots do banco
async function iniciarTodosBots() {
  const empresas = await Empresa.find();
  empresas.forEach((empresa) => iniciarBot(empresa));
}
iniciarTodosBots();

// ROTAS

app.post('/api/empresas', async (req, res) => {
  const { nome, promptIA, telefone, ativo } = req.body;

  try {
    const empresaExistente = await Empresa.findOne({ nome });
    if (empresaExistente) return res.status(400).json({ error: 'Empresa já existe.' });

    const novaEmpresa = new Empresa({ nome, promptIA, telefone, botAtivo: ativo });
    await novaEmpresa.save();

    const pasta = path.join(__dirname, 'bots', nome);
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, 'prompt.txt'), promptIA);

    const { qrCodePromise } = await iniciarBot({ nome, promptIA });
    const qrRaw = await qrCodePromise;
    const qrCode = await qrcode.toDataURL(qrRaw);

    return res.json({ qrCode });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao cadastrar empresa.' });
  }
});

app.get('/api/empresas', async (req, res) => {
  try {
    const empresas = await Empresa.find();
    return res.json(empresas);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar empresas.' });
  }
});

app.get('/api/qr/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const empresa = await Empresa.findById(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada.' });

    const qr = qrCodesGerados[empresa.nome];
    if (qr) {
      return res.json({ qrCode: qr });
    } else {
      return res.status(204).json();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar QR code.' });
  }
});

app.put('/api/empresas/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, promptIA, telefone, botAtivo } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const empresaAntiga = await Empresa.findById(id);
    if (!empresaAntiga) return res.status(404).json({ error: 'Empresa não encontrada.' });

    const empresaAtualizada = await Empresa.findByIdAndUpdate(
      id, { nome, promptIA, telefone, botAtivo }, { new: true, runValidators: true }
    );

    if (empresaAntiga.nome !== nome) {
      const oldPath = path.join(__dirname, 'bots', empresaAntiga.nome);
      const newPath = path.join(__dirname, 'bots', nome);
      if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    }

    const pasta = path.join(__dirname, 'bots', nome);
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, 'prompt.txt'), promptIA);

    return res.json(empresaAtualizada);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao atualizar empresa.' });
  }
});

app.post('/api/reiniciar-bot/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const empresa = await Empresa.findById(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada.' });

    const authPath = path.join(__dirname, 'bots', empresa.nome, 'auth_info_baileys');
    if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });

    const { qrCodePromise } = await iniciarBot(empresa);
    const qrRaw = await qrCodePromise;
    const qrCode = await qrcode.toDataURL(qrRaw);

    return res.json({ qrCode });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao reiniciar bot.' });
  }
});

app.delete('/api/empresas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const empresa = await Empresa.findById(id);
    if (!empresa) return res.status(404).json({ message: 'Empresa não encontrada' });

    await Empresa.findByIdAndDelete(id);

    const pastaEmpresa = path.join(__dirname, 'bots', empresa.nome);
    if (fs.existsSync(pastaEmpresa)) {
      fs.rmSync(pastaEmpresa, { recursive: true, force: true });
    }

    delete qrCodesGerados[empresa.nome];

    if (bots[empresa.nome]) {
      try {
        await bots[empresa.nome].ws.close();
        delete bots[empresa.nome];
      } catch (err) {
        console.error(`Erro ao encerrar conexão do bot "${empresa.nome}":`, err);
      }
    }

    res.status(200).json({ message: 'Empresa deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar empresa:', error);
    res.status(500).json({ message: 'Erro ao deletar empresa' });
  }
});

app.put('/api/empresas/:id/toggle-bot', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const empresa = await Empresa.findById(id);
    if (!empresa) return res.status(404).json({ message: 'Empresa não encontrada' });

    empresa.botAtivo = !empresa.botAtivo;
    await empresa.save();

    // Se desativou, fecha conexão do bot e remove do objeto bots
    if (!empresa.botAtivo && bots[empresa.nome]) {
      try {
        await bots[empresa.nome].ws.close();
        delete bots[empresa.nome];
        console.log(`Bot de ${empresa.nome} foi desligado.`);
      } catch (err) {
        console.error(`Erro ao desligar bot de ${empresa.nome}:`, err);
      }
    }

    // Se ativou, inicia o bot novamente
    if (empresa.botAtivo && !bots[empresa.nome]) {
      iniciarBot(empresa).then(() => {
        console.log(`Bot de ${empresa.nome} foi iniciado.`);
      }).catch(err => {
        console.error(`Erro ao iniciar bot de ${empresa.nome}:`, err);
      });
    }

    res.status(200).json({ botAtivo: empresa.botAtivo });
  } catch (error) {
    console.error('Erro ao alternar bot:', error);
    res.status(500).json({ message: 'Erro ao alternar bot' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
});
