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

// Conectar ao MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Conectado ao MongoDB Atlas');
}).catch(err => {
  console.error('❌ Erro ao conectar no MongoDB:', err);
});

const bots = {};
const atendimentosManuais = {}; // { empresaNome: { ativo: true, ultimoContato: Date } }
const qrCodesGerados = {}; // { nomeEmpresa: base64QRCode }

async function chamarIA(promptIA, mensagemUsuario) {
  return await gerarRespostaGemini(promptIA, mensagemUsuario);
}

// Função principal para iniciar bot
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
      resolveQRCode(qr); // Libera a Promise
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) iniciarBot(empresa);
    }

    if (connection === 'open') {
      console.log(`🤖 Conectado com sucesso: ${empresa.nome}`);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
    const idEmpresa = empresa.nome;

    // Atendimento humano ativado
    if (atendimentosManuais[idEmpresa]?.ativo) {
      atendimentosManuais[idEmpresa].ultimoContato = new Date();
      return;
    }

    // Encerrar atendimento humano
    if (texto.toLowerCase().includes("encerrar atendimento")) {
      atendimentosManuais[idEmpresa] = { ativo: false, ultimoContato: null };
      await sock.sendMessage(sender, { text: '🤖 Atendimento encerrado. O bot está ativo novamente.' });
      return;
    }

    // Ativar atendimento humano
    if (texto.toLowerCase().includes("#humano")) {
      atendimentosManuais[idEmpresa] = {
        ativo: true,
        ultimoContato: new Date()
      };
      await sock.sendMessage(sender, { text: '👤 Um atendente humano vai falar com você em breve.' });
      return;
    }

    const respostaIA = await chamarIA(empresa.promptIA, texto);
    await sock.sendMessage(sender, { text: respostaIA });
  });

  bots[empresa.nome] = sock;

  return { sock, qrCodePromise };
}

// Verificação periódica de inatividade no atendimento humano
setInterval(() => {
  const agora = new Date();
  for (const [empresa, info] of Object.entries(atendimentosManuais)) {
    if (info.ativo && agora - info.ultimoContato > 10 * 60 * 1000) {
      console.log(`⏳ Atendimento humano inativo. Retornando para bot: ${empresa}`);
      atendimentosManuais[empresa].ativo = false;
    }
  }
}, 60 * 1000);

module.exports = { iniciarBot, bots, atendimentosManuais };

// Inicia todos os bots existentes no banco
async function iniciarTodosBots() {
  const empresas = await Empresa.find();
  empresas.forEach((empresa) => iniciarBot(empresa));
}
iniciarTodosBots();

// --- Rotas ---

// Cadastrar nova empresa e iniciar bot
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

// Listar empresas
app.get('/api/empresas', async (req, res) => {
  try {
    const empresas = await Empresa.find();
    return res.json(empresas);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao listar empresas.' });
  }
});

// Obter último QR gerado (ajustando para receber id e buscar empresa)
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
      return res.status(204).json(); // No Content
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar QR code.' });
  }
});

// Atualizar empresa
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
      id,
      { nome, promptIA, telefone, botAtivo },
      { new: true, runValidators: true }
    );

    // Renomear pasta se o nome mudou
    if (empresaAntiga.nome !== nome) {
      const oldPath = path.join(__dirname, 'bots', empresaAntiga.nome);
      const newPath = path.join(__dirname, 'bots', nome);
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, newPath);
      }
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


// Reiniciar bot e gerar novo QR Code (ajustando para buscar por id)
app.post('/api/reiniciar-bot/:id', async (req, res) => {
  const { id } = req.params;
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const empresa = await Empresa.findById(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada.' });

    // Remove autenticação antiga
    const authPath = path.join(__dirname, 'bots', empresa.nome, 'auth_info_baileys');
    if (fs.existsSync(authPath)) fs.rmSync(authPath, { recursive: true, force: true });

    // Reinicia bot e espera novo QR
    const { qrCodePromise } = await iniciarBot(empresa);
    const qrRaw = await qrCodePromise;
    const qrCode = await qrcode.toDataURL(qrRaw);

    return res.json({ qrCode });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao reiniciar bot.' });
  }
});


// Deletar empresa e remover pasta correspondente
app.delete('/api/empresas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    // Encontra a empresa antes de deletar para obter o nome
    const empresa = await Empresa.findById(id);
    if (!empresa) {
      return res.status(404).json({ message: 'Empresa não encontrada' });
    }

    // Deleta a empresa do banco de dados
    await Empresa.findByIdAndDelete(id);

    // Remove a pasta da empresa
    const pastaEmpresa = path.join(__dirname, 'bots', empresa.nome);
    console.log(`Tentando remover pasta da empresa: ${pastaEmpresa}`);
    
    if (fs.existsSync(pastaEmpresa)) {
      try {
        // Remove a pasta recursivamente
        fs.rmSync(pastaEmpresa, { recursive: true, force: true });
        console.log(`Pasta da empresa "${empresa.nome}" removida com sucesso.`);
      } catch (err) {
        console.error(`Erro ao remover pasta da empresa "${empresa.nome}":`, err);
        // Não falha a operação principal se a exclusão da pasta falhar
      }
    } else {
      console.log(`Pasta da empresa "${empresa.nome}" não encontrada.`);
    }

    if (fs.existsSync(pastaEmpresa)) {
      console.error(`Falha crítica: A pasta ${pastaEmpresa} ainda existe após tentativa de exclusão`);
    } else {
      console.log(`Pasta ${pastaEmpresa} removida com sucesso`);
    }

    // Remove qualquer QR code armazenado em memória
    delete qrCodesGerados[empresa.nome];

    // Remove o bot da lista de bots ativos, se existir
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


// Alternar bot ativo (ajustando para usar id)
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

    res.status(200).json({ botAtivo: empresa.botAtivo });
  } catch (error) {
    console.error('Erro ao alternar bot:', error);
    res.status(500).json({ message: 'Erro ao alternar bot' });
  }
});

// Start do servidor
app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
});
