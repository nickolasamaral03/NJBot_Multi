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
    const saudacoes = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite'];
    try {
      const msg = m.messages[0];
      if (!msg.message) return;

      const sender = msg.key.remoteJid;
      const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      const textoLower = texto.toLowerCase().trim();
      const idEmpresa = empresa.nome;
      const chaveAtendimento = `${idEmpresa}_${sender}`;
      const comandoAtivarHumano = 'atendente';

      if (!atendimentosManuais[chaveAtendimento]) {
        atendimentosManuais[chaveAtendimento] = {};
      }

      const empresaDB = await Empresa.findOne({ nome: idEmpresa });
      const setores = empresaDB?.setores || [];

      if (saudacoes.includes(textoLower) && !atendimentosManuais[chaveAtendimento]?.etapa) {
        if (setores.length === 0) {
          await sock.sendMessage(sender, { text: 'Nenhum setor foi configurado para esta empresa. Por favor, entre em contato com o suporte.' });
          return;
        }
        let mensagemSetores = 'Olá! Para te ajudar melhor, escolha um setor:\n\n';
        setores.forEach((setor, index) => {
          mensagemSetores += `${index + 1}️⃣ ${setor.nome}\n`;
        });
        atendimentosManuais[chaveAtendimento].etapa = 'setor';
        delete atendimentosManuais[chaveAtendimento].tentativaInvalidaSetor;
        await sock.sendMessage(sender, { text: mensagemSetores });
        return;
      } else if (atendimentosManuais[chaveAtendimento]?.etapa === 'setor') {
        const indexEscolhido = parseInt(textoLower);
        if (!isNaN(indexEscolhido) && indexEscolhido >= 1 && indexEscolhido <= setores.length) {
          const setorEscolhido = setores[indexEscolhido - 1];
          atendimentosManuais[chaveAtendimento].etapa = 'atendimento';
          delete atendimentosManuais[chaveAtendimento].tentativaInvalidaSetor;
          await sock.sendMessage(sender, { text: `Você escolheu o setor *${setorEscolhido.nome}*. Como posso te ajudar?` });
          return;
        } else {
          // Só mostra mensagem de opção inválida se já houve uma tentativa inválida
          if (atendimentosManuais[chaveAtendimento].tentativaInvalidaSetor) {
            let mensagemSetores = '⚠️ Opção inválida. Por favor, selecione um dos setores disponíveis:\n\n';
            setores.forEach((setor, index) => {
              mensagemSetores += `${index + 1}️⃣ ${setor.nome}\n`;
            });
            await sock.sendMessage(sender, { text: mensagemSetores });
          }
          // Marca que já houve uma tentativa inválida
          atendimentosManuais[chaveAtendimento].tentativaInvalidaSetor = true;
          return;
        }
      }

      // Evita tratar "oi", "olá", etc como inválido
      if (saudacoes.includes(textoLower)) {
        return;
      }


      if (['#bot', 'bot', 'voltar ao bot'].includes(textoLower)) {
        atendimentosManuais[chaveAtendimento] = { ativo: false, ultimoContato: null };
        await sock.sendMessage(sender, { text: '🤖 Atendimento automático reativado.' });
        return;
      }
      const isMensagemAtendente = msg.key.fromMe === true;
      if (isMensagemAtendente) {
        if (atendimentosManuais[chaveAtendimento]?.ativo) {
          atendimentosManuais[chaveAtendimento].ultimoContato = new Date();
        }
        return;
      }
      if (textoLower.includes(comandoAtivarHumano)) {
        atendimentosManuais[chaveAtendimento] = { ativo: true, ultimoContato: new Date() };
        await sock.sendMessage(sender, { text: '👤 Atendimento humano ativado. Por favor, aguarde o atendente.' });
        return;
      }
      if (atendimentosManuais[chaveAtendimento]?.ativo) {
        atendimentosManuais[chaveAtendimento].ultimoContato = new Date();
        return;
      }
      const dadosAtualizadosEmpresa = await Empresa.findOne({ nome: empresa.nome });
      if (!dadosAtualizadosEmpresa?.botAtivo) return;
      await sock.sendPresenceUpdate('composing', sender);
      await new Promise(resolve => setTimeout(resolve, 3000));
      const respostaIA = await chamarIA(empresa.promptIA, texto);
      await sock.sendMessage(sender, { text: respostaIA });
      const fluxo = await Fluxo.findOne({ empresa: dadosAtualizadosEmpresa._id });
      if (fluxo) {
        if (!atendimentosManuais[chaveAtendimento]?.blocoAtual) {
          const blocoInicial = fluxo.blocos.find(b => b.nome === 'inicial');
          if (blocoInicial) {
            await sock.sendMessage(sender, { text: blocoInicial.mensagem });
            atendimentosManuais[chaveAtendimento] = {
              ...atendimentosManuais[chaveAtendimento],
              blocoAtual: 'Inicio'
            };
            return;
          }
        } else {
          const blocoAtual = fluxo.blocos.find(b => b.nome === atendimentosManuais[chaveAtendimento].blocoAtual);
          if (blocoAtual) {
            const opcao = blocoAtual.opcoes.find(o => textoLower.includes(o.texto.toLowerCase()));
            if (opcao) {
              const proximoBloco = fluxo.blocos.find(b => b.nome === opcao.proximoBloco);
              if (proximoBloco) {
                await sock.sendMessage(sender, { text: proximoBloco.mensagem });
                atendimentosManuais[chaveAtendimento].blocoAtual = proximoBloco.nome;
                return;
              }
            } else {
              await sock.sendMessage(sender, { text: '🤖 Opção inválida. Por favor, escolha uma das opções disponíveis.' });
              return;
            }
          }
        }
      }
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

    const novaEmpresa = new Empresa({ nome, promptIA, telefone, botAtivo: ativo, setores });
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

const Fluxo = require('./models/fluxo');

app.post('/api/empresas/:id/fluxo', async (req, res) => {
  const { id } = req.params;
  const { blocos } = req.body;

  try{
    let fluxo = await Fluxo.findOne({ empresa: id})

    if(fluxo){
      fluxo.blocos = blocos;
    } else{
      fluxo = new Fluxo({ empresa: id, blocos });
    }

    await fluxo.save();
    res.json({ message: 'Fluxo atualizado com sucesso', fluxo });
  } catch (err) {
    console.error('Erro ao atualizar fluxo:', err);
    res.status(500).json({ error: 'Erro ao atualizar fluxo' });
  }

})

app.get('/', (req, res) => {
  res.send('🤖 API do NJBot está rodando!');
});

app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
});



