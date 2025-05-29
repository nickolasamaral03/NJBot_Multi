// backend/index.js
const express = require('express');
const fs = require('fs'); //manipular pastas e arquivos
const path = require('path');
const qrcode = require('qrcode');
const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys/lib/Utils');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();
const Empresa = require('./models/Empresa'); // Importa o modelo Empresa

const app = express();
const PORT = 3000
app.use(express.json());

const bots = {}

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
    }).then(() => {
        console.log("✅ Conectado ao MongoDB Atlas");
    }).catch((err) => {
        console.error("❌ Erro ao conectar no MongoDB:", err);
    });

async function iniciarBot(empresa){
    const pastaEmpresa = path.join(__dirname, 'bots', empresa.nome) // caminho para a pasta da empresa
    const authPath = path.join(pastaEmpresa, 'auth_info_baileys'); // caminho para a pasta de autenticação
    if(!fs.existsSync(authPath)) fs.mkdirSync(authPath, { recursive: true }); // cria a pasta de autenticação se não existir

    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const sock = makeWASocket({
        auth: state,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        let resposta = '🤖 Desculpe, não entendi.';

        for (const item of empresa.script) {
            if (messageContent.toLowerCase().includes(item.pergunta.toLowerCase())) {
                resposta = item.resposta;
                break;
            }
        }

        await sock.sendMessage(sender, { text: resposta });
    }); // Evento disparado sempre que uma nova mensagem é recebida

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) iniciarBot(empresa);
        }
    });
    bots[empresa.nome] = sock;
    return sock;
} // se for desconectado, reconecta

app.post('/api/empresas', async (req, res) => {
    const { nome, script } = req.body;

    try{
        const empresaExistente = await Empresa.findOne({ nome });
        if(empresaExistente) return res.status(400).json({ error: 'Empresa já existe.' });

        const novaEmpresa = new Empresa({ nome, script });
        await novaEmpresa.save();
        const pasta = path.join(__dirname, 'bots', nome);
        if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
        fs.writeFileSync(path.join(pasta, 'script.json'), JSON.stringify(script, null, 2));
        const sock = await iniciarBot({ nome, script });
        sock.ev.on('connection.update', async (update) => {
            if (update.qr) {
                const qrCode = await qrcode.toDataURL(update.qr);
                return res.json({ qrCode });
            }
        })
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao cadastrar empresa.' });
    }
}) // Cria uma nova empresa e inicia o bot com o qrcode

app.get('/api/empresas', async (req, res) => {
    try{
        const empresas = await Empresa.find();
        return res.json(empresas);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao listar empresas.' });
    }
}) // Lista todas as empresas cadastradas

app.put('/api/empresas/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, script } = req.body;

   try{
    const empresa = await Empresa.findByIdAndUpdate(id, 
        { nome, script }, 
        { new: true, runValidators: true }
    );

    if (!empresa) return res.status(404).json({ error: 'Empresa não encontrada.' });

    const pasta = path.join(__dirname, 'bots', empresa.nome);
    if (!fs.existsSync(pasta)) fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, 'script.json'), JSON.stringify(script, null, 2));

    res.json(empresa);
   } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Erro ao atualizar empresa.' });
    }       
})   

app.listen(PORT, () => console.log(`Backend rodando na porta ${PORT}`));

