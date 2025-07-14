// const mongoose = require('mongoose');

// const EmpresaSchema = new mongoose.Schema({
//   nome: {
//     type: String,
//     required: true,
//     unique: true,
//     trim: true
//   },
//   promptIA: {
//     type: String,
//     required: true,
//     default: ''
//   },
//   botAtivo: {
//     type: Boolean,
//     default: true
//   },
//   telefone: {
//     type: String,
//     required: false
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// const Empresa = mongoose.model('Empresa', EmpresaSchema);

// module.exports = Empresa;

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
