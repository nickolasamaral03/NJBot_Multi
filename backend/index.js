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
const empresaDB = require('./models/Empresa');
const jwt = require('jsonwebtoken');
const handleMensagem = require('./handlers/chatbot');

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

    // if (connection === 'close') {
    //   const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
    //   if (shouldReconnect) iniciarBot(empresa);
    // }

    if (connection === 'close') {
    const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;

    const empresaDB = await Empresa.findById(empresa._id); // PEGA O STATUS ATUAL DO BANCO
    if (shouldReconnect && empresaDB?.botAtivo) {
      console.log(`[RECONNECT] Reconectando bot de ${empresaDB.nome}...`);
      iniciarBot(empresaDB);
    } else {
      console.log(`[RECONNECT] Não reconectando: botAtivo=${empresaDB?.botAtivo}`);
    }
  }

    if (connection === 'open') {
      console.log(`🤖 Conectado com sucesso: ${empresa.nome}`);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      const msg = m.messages?.[0];
      const sender = msg.key.remoteJid;

      if (!msg || !msg.message) return;

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
      const comandosPermitidosMesmoFromMe = ['#bot', '#sair', '#encerrar', 'bot'];
      if (msg.key.fromMe && !comandosPermitidosMesmoFromMe.includes(textoLower)) return;

      // 🔄 Buscar empresa atualizada do banco
      // const empresaDB = await Empresa.findOne({ numeroWhatsapp: sender });
      // if (!empresaDB?.botAtivo) {
      //   console.log(`⚠️ Bot da empresa "${empresaDB?.nome || empresa.nome}" está desativado. Ignorando mensagem.`);
      //   return;
      // }
// Busque novamente do banco para garantir valor atualizado
      const empresaAtualizada = await Empresa.findById(empresa._id);

      if (!empresaAtualizada?.botAtivo) {
        console.log(`⚠️ Bot da empresa "${empresaAtualizada?.nome || empresa.nome}" está desativado. Ignorando mensagem.`);
        return;
      }

      const chaveAtendimento = `${empresaAtualizada._id}_${sender}`;
      const saudacoes = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'];
      const comandosEspeciais = ['#sair', '#bot', 'bot'];

      if (comandosEspeciais.includes(textoLower)) {
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

      if (atendimentosManuais[chaveAtendimento]?.ativo) {
        atendimentosManuais[chaveAtendimento].ultimoContato = new Date();
        console.log(`👤 Atendimento humano ativo para: ${sender}`);
        return;
      }

      if (saudacoes.includes(textoLower)) {
        await sock.sendMessage(sender, {
          text: 'Olá! 👋 Como posso te ajudar?'
        });
        return;
      }

      await sock.sendPresenceUpdate('composing', sender);
      const resposta = await handleMensagem(empresaDB._id, textoLower);
      await sock.sendMessage(sender, { text: resposta.resposta });

    } catch (err) {
      console.error('❌ Erro no processamento da mensagem:', err);
    }
  });

  bots[empresa.nome] = sock;
  return { sock, qrCodePromise };
}

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


// Iniciar todos os bots
async function iniciarTodosBots() {
  const empresas = await Empresa.find();
  empresas.forEach((empresa) => iniciarBot(empresa));
}
iniciarTodosBots();

// ROTAS

const JWT_SECRET = process.env.JWT_SECRET || 'chavejwtsegura';
const USUARIO_FIXO = {
  email: 'admin@njbot.com',
  senha: '123456',
  nome: 'Administrador'
};

app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body;

  if (email !== USUARIO_FIXO.email || senha !== USUARIO_FIXO.senha) {
    return res.status(401).json({ erro: 'Email ou senha inválidos' });
  }

  const token = jwt.sign({ email: USUARIO_FIXO.email, nome: USUARIO_FIXO.nome }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, nome: USUARIO_FIXO.nome, email: USUARIO_FIXO.email });
});

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

    const { qrCodePromise } = await iniciarBot(novaEmpresa);
    const qrRaw = await qrCodePromise;
    const qrCode = await qrcode.toDataURL(qrRaw);

    return res.json({ qrCode });
  } catch (err) {
    console.error('❌ Erro ao cadastrar empresa:', err);
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

    const empresa = await empresaDB.findById(id);
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

  console.log('🛠️ Tentando editar empresa:', id);
  console.log('Dados recebidos:', { nome, promptIA, telefone, botAtivo });

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const empresaAntiga = await Empresa.findById(id);
    if (!empresaAntiga) return res.status(404).json({ error: 'Empresa não encontrada.' });

    const empresaAtualizada = await Empresa.findByIdAndUpdate(
      id,
      { nome, promptIA, telefone, botAtivo },
      { new: true, runValidators: true }
    );

    console.log('✅ Empresa atualizada:', empresaAtualizada);

    // Renomeia a pasta se o nome mudou
    if (empresaAntiga.nome !== nome) {
      const oldPath = path.join(__dirname, 'bots', empresaAntiga.nome);
      const newPath = path.join(__dirname, 'bots', nome);
      if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    }

    // Cria/atualiza a pasta com o novo prompt
    const pasta = path.join(__dirname, 'bots', nome);
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, 'prompt.txt'), promptIA);

    return res.json(empresaAtualizada);
  } catch (error) {
    console.error('❌ Erro ao atualizar empresa:', error);
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

// VERIFICANDO O PORQUE DO TOGGLE NÃO FICAR ATIVO NOVAMENTE
app.put('/api/empresas/:id/toggle-bot', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`[TOGGLE] Requisição recebida para ID: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log(`[TOGGLE] ID inválido: ${id}`);
      return res.status(400).json({ error: 'ID inválido' });
    }

    const empresa = await Empresa.findById(id);
    if (!empresa) {
      console.log(`[TOGGLE] Empresa não encontrada: ${id}`);
      return res.status(404).json({ message: 'Empresa não encontrada' });
    }

    // Invertendo o estado do bot
    empresa.botAtivo = !empresa.botAtivo;
    console.log(`[TOGGLE] Novo status de botAtivo: ${empresa.botAtivo}`);

    await empresa.save();
    console.log(`[TOGGLE] Empresa ${empresa.nome} atualizada no banco.`);

    // Se for desativar o bot
    if (!empresa.botAtivo && bots[empresa.nome]) {
      console.log(`[TOGGLE] Desligando bot de ${empresa.nome}...`);
      try {
        if (bots[empresa.nome].end) {
          await bots[empresa.nome].end();
          console.log(`[TOGGLE] Bot encerrado via .end()`);
        } else if (bots[empresa.nome].logout) {
          await bots[empresa.nome].logout();
          console.log(`[TOGGLE] Bot encerrado via .logout()`);
        } else {
          console.warn(`[TOGGLE] Nenhum método de encerramento disponível para ${empresa.nome}`);
        }

        delete bots[empresa.nome];
        console.log(`[TOGGLE] Bot removido do cache.`);
      } catch (err) {
        console.error(`[TOGGLE] Erro ao desligar bot de ${empresa.nome}:`, err);
      }
    }

    // Se for ativar e o bot não estiver em cache
    if (empresa.botAtivo && !bots[empresa.nome]) {
      console.log(`[TOGGLE] Iniciando bot de ${empresa.nome}...`);
      try {
        await iniciarBot(empresa);
        console.log(`[TOGGLE] Bot de ${empresa.nome} foi iniciado com sucesso.`);
      } catch (err) {
        console.error(`[TOGGLE] Erro ao iniciar bot de ${empresa.nome}:`, err);
      }
    }

    res.status(200).json({ botAtivo: empresa.botAtivo });
  } catch (error) {
    console.error('[TOGGLE] Erro geral ao alternar bot:', error);
    res.status(500).json({ message: 'Erro ao alternar bot' });
  }
});


app.get('/', (req, res) => {
  res.send('🤖 API do NJBot está rodando!');
});

app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
});


