const mongoose = require('mongoose');

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
  promptIA: {
    type: String,
    required: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Empresa', EmpresaSchema);
