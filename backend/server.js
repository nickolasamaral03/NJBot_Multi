// server.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const Empresa = require('./models/Empresa');
const botManager = require('./botManager');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('✅ Conectado ao MongoDB Atlas'))
  .catch(err => console.error('❌ Erro ao conectar no MongoDB:', err));

const JWT_SECRET = process.env.JWT_SECRET || 'chavejwtsegura';
const USUARIO_FIXO = {
  email: 'admin@njbot.com',
  senha: '123456',
  nome: 'Administrador'
};

// --- Rotas ---

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

    // Inicia o bot via botManager e retorna QR
    const qrCode = await botManager.iniciarBot(novaEmpresa);

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
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });

    const empresa = await Empresa.findById(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada.' });

    const qr = botManager.getQRCode(empresa.nome);
    if (qr) return res.json({ qrCode: qr });
    else return res.status(204).json();

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar QR code.' });
  }
});

app.put('/api/empresas/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, promptIA, telefone, botAtivo } = req.body;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });

    const empresaAntiga = await Empresa.findById(id);
    if (!empresaAntiga) return res.status(404).json({ error: 'Empresa não encontrada.' });

    const empresaAtualizada = await Empresa.findByIdAndUpdate(
      id,
      { nome, promptIA, telefone, botAtivo },
      { new: true, runValidators: true }
    );

    // Renomear pasta se nome mudou
    if (empresaAntiga.nome !== nome) {
      const oldPath = path.join(__dirname, 'bots', empresaAntiga.nome);
      const newPath = path.join(__dirname, 'bots', nome);
      if (fs.existsSync(oldPath)) fs.renameSync(oldPath, newPath);
    }

    // Atualizar prompt
    const pasta = path.join(__dirname, 'bots', nome);
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, 'prompt.txt'), promptIA);

    res.json(empresaAtualizada);
  } catch (error) {
    console.error('❌ Erro ao atualizar empresa:', error);
    res.status(500).json({ error: 'Erro ao atualizar empresa.' });
  }
});

app.post('/api/reiniciar-bot/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });

    const empresa = await Empresa.findById(id);
    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada.' });

    // Apaga auth info e reinicia bot via botManager
    await botManager.reiniciarBot(empresa);

    const qrCode = botManager.getQRCode(empresa.nome);
    res.json({ qrCode });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao reiniciar bot.' });
  }
});

app.delete('/api/empresas/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });

    const empresa = await Empresa.findById(id);
    if (!empresa) return res.status(404).json({ message: 'Empresa não encontrada' });

    await Empresa.findByIdAndDelete(id);

    // Apaga pasta da empresa e qrCode armazenado
    const pastaEmpresa = path.join(__dirname, 'bots', empresa.nome);
    if (fs.existsSync(pastaEmpresa)) fs.rmSync(pastaEmpresa, { recursive: true, force: true });

    botManager.deletarEmpresa(empresa.nome);

    res.status(200).json({ message: 'Empresa deletada com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar empresa:', error);
    res.status(500).json({ message: 'Erro ao deletar empresa' });
  }
});

app.put('/api/empresas/:id/toggle-bot', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: 'ID inválido' });

    const empresa = await Empresa.findById(id);
    if (!empresa) return res.status(404).json({ message: 'Empresa não encontrada' });

    empresa.botAtivo = !empresa.botAtivo;
    await empresa.save();

    // Ligar/desligar bot via botManager
    await botManager.toggleBot(empresa);

    res.status(200).json({ botAtivo: empresa.botAtivo });

  } catch (error) {
    console.error('Erro ao alternar bot:', error);
    res.status(500).json({ message: 'Erro ao alternar bot' });
  }
});

app.get('/', (req, res) => {
  res.send('🤖 API do NJBot está rodando!');
});

// Iniciar todos bots ao subir servidor
(async () => {
  const empresas = await Empresa.find();
  empresas.forEach(empresa => botManager.iniciarBot(empresa));
})();

app.listen(PORT, () => {
  console.log(`🚀 Backend rodando em http://localhost:${PORT}`);
});
