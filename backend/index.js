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
// const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Fluxo = require('./models/Fluxo');
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

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) iniciarBot(empresa);
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

      // Permitir comandos especiais mesmo se for fromMe
      const comandosPermitidosMesmoFromMe = ['#bot', '#sair', '#encerrar', 'bot', 'voltar com o bot'];
      if (msg.key.fromMe && !comandosPermitidosMesmoFromMe.includes(textoLower)) return;


    // Use a empresa diretamente passada na função iniciarBot
    const empresaDB = empresa;
    if (!empresaDB?.botAtivo) {
      console.log(`⚠️ Bot da empresa "${empresaDB.nome}" está desativado. Ignorando mensagem.`);
      return;
    }

    const chaveAtendimento = `${empresaDB._id}_${sender}`;
    const saudacoes = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'];
    const comandosEspeciais = ['#sair', '#bot', 'bot'];

    // === Comandos Especiais ===
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
      'atendente',
      'humano',
      'pessoa',
      'falar com atendente',
      'falar com humano',
      'quero atendimento humano',
      'quero falar com alguém',
      'ajuda de um atendente',
      'quero um atendente',
      'preciso de ajuda humana'
];

    if (palavrasChaveAtendente.some(palavra => textoLower.includes(palavra))) {
      atendimentosManuais[chaveAtendimento] = { ativo: true, ultimoContato: new Date() };
      await sock.sendMessage(sender, { text: '📨 Solicitação enviada ao atendente humano. Aguarde um momento.' });
      return;
    }

    // === Atendimento Humano Ativo ===
    if (atendimentosManuais[chaveAtendimento]?.ativo) {
      atendimentosManuais[chaveAtendimento].ultimoContato = new Date();
      console.log(`👤 Atendimento humano ativo para: ${sender}`);
      return;
    }

  if (saudacoes.includes(textoLower) && !atendimentosManuais[chaveAtendimento]) {
  const setoresAtivos = empresaDB.setores?.filter(s => s.ativo) || [];

  if (setoresAtivos.length === 0) {
    await sock.sendMessage(sender, {
      text: '⚠️ Nenhum setor configurado. Contate o suporte.'
    });
    return;
  }

  if (setoresAtivos.length === 1) {
    const setorUnico = setoresAtivos[0];
    atendimentosManuais[chaveAtendimento] = {
      setorAtual: setorUnico.nome,
      etapa: 'atendimento'
    };

    console.log(`📌 Entrando diretamente no setor único: ${setorUnico.nome}`);

    await sock.sendMessage(sender, {
      text: setorUnico.fluxo?.mensagemInicial ||
        `📍 Você está no setor ${setorUnico.nome}. Como posso ajudar?`
    });

    return;
  }

  // Se tiver mais de um setor, mostra lista
  atendimentosManuais[chaveAtendimento] = { etapa: 'escolha_setor' };

  const listaSetores = setoresAtivos
    .map((s, i) => `${i + 1} - ${s.nome}`)
    .join('\n');

  await sock.sendMessage(sender, {
    text: `Olá! 👋 Escolha um setor:\n\n${listaSetores}\n\nDigite #sair para cancelar\nDigite "atendente" para falar com humano`
  });

  return;
}

    // === Escolha de Setor ===
    if (atendimentosManuais[chaveAtendimento]?.etapa === 'escolha_setor') {
      const indexEscolhido = parseInt(textoLower) - 1;
      const setores = empresaDB.setores.filter(s => s.ativo);
      const setorValido = indexEscolhido >= 0 && indexEscolhido < setores.length;

      if (setorValido) {
        const setorEscolhido = setores[indexEscolhido];
        atendimentosManuais[chaveAtendimento] = {
          setorAtual: setorEscolhido.nome,
          etapa: 'atendimento'
        };

        // await sock.sendMessage(sender, { text: setorEscolhido.prompt || `📍 Você escolheu o setor ${setorEscolhido.nome}. Como posso ajudar?` });
        await sock.sendMessage(sender, { 
        text: setorEscolhido.fluxo?.mensagemInicial || `📍 Você está no setor ${setorEscolhido.nome}. Como posso ajudar?\n\nDigite "atendente" para falar com humano`
      });

        return;
      } else {
        await sock.sendMessage(sender, { text: '❌ Opção inválida. Por favor, escolha um número da lista.' });
        return;
      }
    }

    // === Atendimento do Setor ===
    if (atendimentosManuais[chaveAtendimento]?.etapa === 'atendimento') {
      const setorAtual = atendimentosManuais[chaveAtendimento].setorAtual;

      // Mostra "digitando..."
      await sock.sendPresenceUpdate('composing', sender);

      const resposta = await handleMensagem(
        empresaDB._id,
        setorAtual,
        textoLower
      );

      console.log(`🧠 Resposta IA (${setorAtual}):`, resposta);

      await sock.sendMessage(sender, { text: resposta.resposta });

      if (resposta.proximoSetor) {
        atendimentosManuais[chaveAtendimento].setorAtual = resposta.proximoSetor;
        await new Promise(resolve => setTimeout(resolve, 500));

        const novaResposta = await handleMensagem(
          empresaDB._id,
          resposta.proximoSetor,
          ''
        );

        await sock.sendMessage(sender, { text: novaResposta.resposta });
      }

      // if (resposta.terminado) {
      //   delete atendimentosManuais[chaveAtendimento];
      // }

      return;
    }

    // === Mensagem fora de fluxo ===
    await sock.sendMessage(sender, {
      text: '❓ Não entendi. Digite "oi" para começar ou #sair para reiniciar.'
    });

  } catch (err) {
    console.error('❌ Erro no processamento da mensagem:', err);
    try {
      await sock.sendMessage(msg?.key?.remoteJid || 'desconhecido', {
        text: '⚠️ Ocorreu um erro. Tente novamente mais tarde.'
      });
    } catch (erroEnvio) {
      console.error('Erro ao enviar mensagem de erro:', erroEnvio);
    }
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

        console.log(`⏱️ Atendimento humano encerrado por inatividade: ${chave}`);

        // Tenta extrair o socket e número do cliente
        const [empresaId, sender] = chave.split('_');
        const botSock = Object.values(bots).find(sock => sock.authState.creds?.me?.id?.includes(sender?.split('@')[0]));
        if (botSock) {
          botSock.sendMessage(sender, {
            text: '🤖 Atendimento humano foi encerrado por inatividade. Agora você está falando com o assistente virtual novamente.'
          }).catch(err => console.error('Erro ao avisar retorno ao bot:', err));
        }
      }
    }
  }
}, 60 * 1000);



// Iniciar todos os bots do banco
async function iniciarTodosBots() {
  const empresas = await Empresa.find();
  empresas.forEach((empresa) => iniciarBot(empresa));
}
iniciarTodosBots();

// ROTAS

const JWT_SECRET = process.env.JWT_SECRET || 'chavejwtsegura';

const USUARIO_FIXO = {
  email: 'admin@njbot.com',
  senha: '123456', // deixe assim por enquanto
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
  const { nome, promptIA, telefone, ativo, setores } = req.body;

  try {
    const empresaExistente = await Empresa.findOne({ nome });
    if (empresaExistente) return res.status(400).json({ error: 'Empresa já existe.' });

    const novaEmpresa = new Empresa({ 
      nome, 
      promptIA, 
      telefone, 
      botAtivo: ativo, 
      setores: setores.map(setor => ({
        ...setor,
        fluxo: {
          mensagemInicial: `Você está no setor ${setor.nome}. Como posso ajudar?`,
          opcoes: []
        }
      }))
    });

    await novaEmpresa.save();

    // Cria estrutura de pasta e arquivo
    const pasta = path.join(__dirname, 'bots', nome);
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, 'prompt.txt'), promptIA);

    // ✅ Adiciona fluxo padrão ao criar empresa
    const fluxoPadrao = new Fluxo({
      empresa: novaEmpresa._id,
      blocos: [
        {
          nome: 'inicial',
          mensagem: 'Olá! Como posso te ajudar? Escolha uma das opções abaixo:',
          opcoes: setores.map(setor => ({
            texto: setor.nome,
            proximoBloco: setor.nome.toLowerCase().replace(/\s+/g, '_') // nome do bloco destino
          }))
        },
        ...setores.map(setor => ({
          nome: setor.nome.toLowerCase().replace(/\s+/g, '_'),
          mensagem: `Você escolheu o setor *${setor.nome}*. Como posso te ajudar?`,
          opcoes: []
        }))
      ]
    });

    await fluxoPadrao.save();

    // Inicia o bot e QR Code
    const { qrCodePromise } = await iniciarBot({ nome, promptIA });
    const qrRaw = await qrCodePromise;
    const qrCode = await qrcode.toDataURL(qrRaw);

    return res.json({ qrCode });
  } catch (err) {
    console.error('❌ Erro ao cadastrar empresa:', err);
    return res.status(500).json({ error: 'Erro ao cadastrar empresa.' });
  }
});

    // ...existing code...


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
  const { nome, promptIA, telefone, botAtivo, setores } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const empresaAntiga = await Empresa.findById(id);
    if (!empresaAntiga) return res.status(404).json({ error: 'Empresa não encontrada.' });

    const empresaAtualizada = await Empresa.findByIdAndUpdate(
      id, { nome, promptIA, telefone, botAtivo, setores }, { new: true, runValidators: true }
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

app.post('/api/fluxos', async (req, res) => {
  const { empresaId, blocos } = req.body;

  try {
    const novoFluxo = new Fluxo({
      empresa: empresaId,
      blocos
    });

    await novoFluxo.save();
    res.status(201).json(novoFluxo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao salvar fluxo' });
  }
});

app.post('/api/empresas/:id/setores', async (req, res) => {
  try {
    const { nome, prompt } = req.body;
    
    const empresa = await Empresa.findById(req.params.id);
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });

    // Validação de unicidade
    if (empresa.setores.some(s => s.nome === nome)) {
      return res.status(400).json({ error: 'Setor já existe' });
    }

    const novoSetor = {
      nome,
      prompt,
      fluxo: {
        mensagemInicial: `Você está no setor ${nome}. Como posso ajudar?`,
        opcoes: []
      },
      ativo: true
    };

    empresa.setores.push(novoSetor);
    await empresa.save();

    res.status(201).json(empresa);
  } catch (err) {
    res.status(500).json({ 
      error: 'Erro ao adicionar setor',
      details: err.message 
    });
  }
});

async function atualizarFluxoGeral(empresaId) {
  const empresa = await Empresa.findById(empresaId);
  const setoresAtivos = empresa.setores.filter(s => s.ativo);

  const fluxo = await Fluxo.findOneAndUpdate(
    { empresa: empresaId },
    {
      $set: {
        blocos: [
          {
            nome: 'inicial',
            mensagem: 'Escolha um setor:',
            opcoes: setoresAtivos.map(setor => ({
              texto: setor.nome,
              proximoBloco: `setor_${setor.nome.toLowerCase().replace(/\s+/g, '_')}`
            }))
          },
          ...setoresAtivos.map(setor => ({
            nome: `setor_${setor.nome.toLowerCase().replace(/\s+/g, '_')}`,
            mensagem: setor.fluxo.mensagemInicial,
            opcoes: setor.fluxo.opcoes.map(opcao => ({
              texto: opcao.texto,
              proximoBloco: opcao.acao === 'encaminhar' 
                ? `setor_${opcao.destino.toLowerCase().replace(/\s+/g, '_')}`
                : 'final'
            }))
          }))
        ]
      }
    },
    { upsert: true, new: true }
  );

  return fluxo;
}

app.put('/api/empresas/:id/setores/:index', async (req, res) => {
  const { id, index } = req.params;
  const { nome, prompt } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const empresa = await Empresa.findById(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });

    const idx = parseInt(index);
    if (isNaN(idx) || idx < 0 || idx >= empresa.setores.length) {
      return res.status(400).json({ error: 'Índice do setor inválido' });
    }

    empresa.setores[index] = { 
       ...empresa.setores[index],
      nome, 
      prompt };

    await empresa.save();

    empresa.setores[idx] = { nome, prompt };
    const empresaAtualizada = await empresa.save();

    res.json(empresaAtualizada);
  } catch (err) {
    console.error('Erro ao editar setor:', err);
    res.status(500).json({ 
      error: 'Erro ao editar setor',
      details: err.message 
    });
  }
});

app.delete('/api/empresas/:id/setores/:index', async (req, res) => {
  const { id, index } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const empresa = await Empresa.findById(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada' });

    const idx = parseInt(index);
    if (isNaN(idx) || idx < 0 || idx >= empresa.setores.length) {
      return res.status(400).json({ error: 'Índice do setor inválido' });
    }

    empresa.setores.splice(idx, 1);
    const empresaAtualizada = await empresa.save();

    res.json(empresaAtualizada);
  } catch (err) {
    console.error('Erro ao remover setor:', err);
    res.status(500).json({ 
      error: 'Erro ao remover setor',
      details: err.message 
    });
  }
});

app.get('/', (req, res) => {
  res.send('🤖 API do NJBot está rodando!');
});

app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
});



