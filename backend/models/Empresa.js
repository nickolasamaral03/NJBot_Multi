const mongoose = require('mongoose');

const EmpresaSchema = new mongoose.Schema({
    nome : { type: String, required: true, unique: true },
    script:[{
        pergunta: { type: String, required: true },
        resposta: { type: String, required: true }
    }]
})

module.exports = mongoose.model('Empresa', EmpresaSchema);