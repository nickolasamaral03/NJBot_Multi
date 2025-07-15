const mongoose = require('mongoose');

const setorSchema = new mongoose.Schema({
  nome: { type: String, required: true }, // Ex: "Suporte", "Administrativo"
  descricao: { type: String },            // Opcional: descrição para exibir ao usuário
});

const empresaSchema = new mongoose.Schema({
  nome: { type: String, required: true, unique: true },
  telefone: { type: String, required: true },
  promptIA: { type: String, required: true },
  botAtivo: { type: Boolean, default: true },
  setores: [setorSchema], // Lista de setores dinâmicos
}, {
  timestamps: true
});

module.exports = mongoose.model('Empresa', empresaSchema);
