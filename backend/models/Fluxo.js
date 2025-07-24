const mongoose = require('mongoose');

const blocoSchema = new mongoose.Schema({
  nome: String, // Ex: "inicio", "produto"
  mensagem: String, // Mensagem que o bot envia
  opcoes: [ // Opções de resposta que levam a outro bloco
    {
      texto: String,       // Ex: "Produto"
      proximoBloco: String // Nome do próximo bloco
    }
  ]
});

const fluxoSchema = new mongoose.Schema({
  empresa: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa' },
  blocos: [blocoSchema]
});

module.exports = mongoose.model('Fluxo', fluxoSchema);