const mongoose = require('mongoose');

const SetorSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [true, 'Nome do setor é obrigatório'],
    unique: true // Dentro da mesma empresa
  },
  prompt: {
    type: String,
    required: [true, 'Prompt do setor é obrigatório']
  },
  fluxo: {
    mensagemInicial: String,
    opcoes: [{
      texto: String,
      acao: {
        type: String,
        enum: ['encaminhar', 'resposta', 'finalizar']
      },
      destino: String // Setor destino ou resposta fixa
    }]
  },
  ativo: {
    type: Boolean,
    default: true
  }
}, { _id: true }); // Manter IDs individuais para referência

const EmpresaSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    unique: true
  },
  telefone: String,
  botAtivo: {
    type: Boolean,
    default: true
  },
  setores: [SetorSchema],
  // ... outros campos
}, { timestamps: true });

// Index para busca rápida
EmpresaSchema.index({ 'setores.nome': 1 });

module.exports = mongoose.model('Empresa', EmpresaSchema);

// AGORA SALVAMOS O SETOR COMO UM OBJETO DENTRO DA EMPRESA
// E CADA SETOR PODE TER SEU PRÓPRIO FLUXO DE ATENDIMENTO