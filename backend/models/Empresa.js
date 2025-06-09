const mongoose = require('mongoose');

const EmpresaSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  promptIA: {
    type: String,
    required: true,
    default: ''
  },
  botAtivo: {
    type: Boolean,
    default: true
  },
  telefone: {
    type: String,
    required: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Empresa = mongoose.model('Empresa', EmpresaSchema);

module.exports = Empresa;