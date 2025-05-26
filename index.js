const { default: makeWASocket, DisconnectReason } = require('@whiskeysockets/baileys');
const { useMultiFileAuthState } = require('@whiskeysockets/baileys/lib/Utils/index.js');
const qrcode = require('qrcode-terminal');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');

// useMultiFileAuthState espera um diretório, não um arquivo
const authPath = './auth_info_baileys'; // Mudado para um nome de diretório

// Cria o estado de autenticação e a função para salvar as credenciais
// Agora usando useMultiFileAuthState
async function initializeAuth() {
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    return { state, saveCreds };
}

// Função principal que inicializa o bot
async function startBot() {
    const { state, saveCreds } = await initializeAuth();

    // Cria a conexão com o WhatsApp usando o estado de autenticação
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Exibe o QR Code no terminal para autenticar
    });

    // Salva automaticamente as credenciais ao se conectar
    sock.ev.on('creds.update', saveCreds); // Agora é saveCreds

    // Evento disparado sempre que uma nova mensagem é recebida
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        // Ignora mensagens vazias ou enviadas pelo próprio bot
        if (!msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid; // Número de quem enviou
        // Conteúdo da mensagem recebida, tratando diferentes tipos de mensagens
        const messageContent = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        console.log(`Mensagem recebida de ${sender}: ${messageContent}`);

        // Gera resposta automática com base na mensagem
        const response = getAutoResponse(messageContent.toLowerCase());

        if (response) {
            await sock.sendMessage(sender, { text: response });
        } else {
            // Resposta padrão se a mensagem não for reconhecida
            await sock.sendMessage(sender, { text: '🤖 Desculpe, não entendi. Envie "promoção", "horário" ou "atendente".' });
        }
    });

    // Evento de conexão e reconexão
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

          if (qr) {
            // Exibe o QR Code no terminal
            qrcode.generate(qr, { small: true });
            }

        if (connection === 'close') {
            // Verifica se a desconexão não foi por logout (intencional)
            const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('🔌 Conexão encerrada. Reconectar?', shouldReconnect);
            if (shouldReconnect) {
                startBot(); // Tenta reconectar
            }
        } else if (connection === 'open') {
            console.log('✅ Conexão aberta com sucesso!');
        }
    });
}

function getAutoResponse(msg) {
    if (msg.includes('horário')) return '📍 Nosso horário de atendimento é das 9h às 18h, de segunda a sexta.';
    if (msg.includes('promoção')) return '🎉 Temos 10% de desconto em todos os serviços esta semana!';
    if (msg.includes('atendente')) return '👨‍💼 Encaminhando você para um atendente humano. Aguarde um momento.';
    return null; 
}

startBot();

// AIzaSyD6XaR03qdOOtWzsjZK4ARW0c7AJTWBbQc

