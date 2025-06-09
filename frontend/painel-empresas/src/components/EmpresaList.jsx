import React, { useEffect, useState } from 'react';
import api from '../services/api';

const EmpresasList = () => {
  const [empresas, setEmpresas] = useState([]);
  const [qrCodes, setQrCodes] = useState({});
  const [loadingEmpresa, setLoadingEmpresa] = useState(null);
  const [empresaEditando, setEmpresaEditando] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    promptIA: '',
    telefone: '',
    botAtivo: true,
  });

  useEffect(() => {
    const fetchEmpresas = async () => {
      try {
        const res = await api.get('/empresas');
        setEmpresas(res.data);
      } catch (err) {
        console.error('Erro ao buscar empresas:', err);
      }
    };

    fetchEmpresas();
  }, []);

  const gerarNovoQrCode = async (idEmpresa, nomeEmpresa) => {
    try {
      setLoadingEmpresa(idEmpresa);
      const res = await api.post(`/reiniciar-bot/${idEmpresa}`);
      setQrCodes((prev) => ({
        ...prev,
        [nomeEmpresa]: res.data.qrCode,
      }));
    } catch (err) {
      console.error('Erro ao gerar novo QR Code:', err);
      alert('Erro ao gerar QR Code.');
    } finally {
      setLoadingEmpresa(null);
    }
  };

  const apagarEmpresa = async (idEmpresa) => {
    const empresa = empresas.find(e => e._id === idEmpresa);
    if (!empresa) return;

    if (!window.confirm(`Tem certeza que deseja excluir a empresa "${empresa.nome}"?`)) return;

    try {
      await api.delete(`/empresas/${idEmpresa}`);
      setEmpresas((prev) => prev.filter((empresa) => empresa._id !== idEmpresa));

      setQrCodes((prev) => {
      const newQrCodes = {...prev};
      delete newQrCodes[empresa.nome];
      return newQrCodes;
    });
    
    } catch (err) {
      console.error('Erro ao excluir empresa:', err);
      alert('Erro ao excluir empresa.');
    }
  };

  const alternarStatusBot = async (idEmpresa) => {
    try {
      const res = await api.put(`/empresas/${idEmpresa}/toggle-bot`);
      setEmpresas((prev) =>
        prev.map((e) =>
          e._id === idEmpresa ? { ...e, botAtivo: res.data.botAtivo } : e
        )
      );
    } catch (err) {
      console.error('Erro ao alternar status do bot:', err);
      alert('Erro ao alternar status do bot.');
    }
  };

  const iniciarEdicao = (empresa) => {
    setEmpresaEditando(empresa._id);
    setFormData({
      nome: empresa.nome || '',
      promptIA: empresa.promptIA || '',
      telefone: empresa.telefone || '',
      botAtivo: empresa.botAtivo ?? true
    });
  };

  const cancelarEdicao = () => {
    setEmpresaEditando(null);
    setFormData({ nome: '', promptIA: '', telefone: '', botAtivo: true });
  };

  const salvarEdicao = async (idEmpresa) => {
    try {
      const res = await api.put(`/empresas/${idEmpresa}`, formData);
      setEmpresas((prev) =>
        prev.map((e) => (e._id === idEmpresa ? res.data : e))
      );
      cancelarEdicao();
    } catch (err) {
      console.error('Erro ao editar empresa:', err);
      alert('Erro ao editar empresa.');
    }
  };

  return (
    <div>
      <h2>Empresas</h2>
      <ul>
        {empresas.map((empresa) => (
          <li key={empresa._id} style={{ marginBottom: '2rem', border: '1px solid #ccc', padding: '1rem' }}>
            {empresaEditando === empresa._id ? (
              <div>
                <input
                  type="text"
                  placeholder="Nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
                <br />
                <input
                  type="text"
                  placeholder="Prompt IA"
                  value={formData.promptIA}
                  onChange={(e) => setFormData({ ...formData, promptIA: e.target.value })}
                />
                <br />
                <input
                  type="text"
                  placeholder="Telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                />
                <br />
                <label>
                  <input
                    type="checkbox"
                    checked={formData.botAtivo}
                    onChange={(e) => setFormData({ ...formData, botAtivo: e.target.checked })}
                  />
                  Bot ativo
                </label>
                <br />
                <button onClick={() => salvarEdicao(empresa._id)}>Salvar</button>
                <button onClick={cancelarEdicao} style={{ marginLeft: '1rem' }}>Cancelar</button>
              </div>
            ) : (
              <div>
                <strong>{empresa.nome}</strong>
                <p>Prompt IA: {empresa.promptIA}</p>
                <p>Telefone: {empresa.telefone}</p>
                <label>
                  <input
                    type="checkbox"
                    checked={empresa.botAtivo}
                    onChange={() => alternarStatusBot(empresa._id)}
                  />
                  Bot ativo
                </label>
                <br />

                <button
                  onClick={() => gerarNovoQrCode(empresa._id, empresa.nome)}
                  disabled={loadingEmpresa === empresa._id}
                >
                  {loadingEmpresa === empresa._id ? 'Gerando QR Code...' : 'Gerar novo QR Code'}
                </button>

                {qrCodes[empresa.nome] && (
                  <div style={{ marginTop: '10px' }}>
                    <p><strong>QR Code:</strong></p>
                    <img
                      src={qrCodes[empresa.nome]}
                      alt={`QR Code - ${empresa.nome}`}
                      style={{ width: 200, height: 200 }}
                    />
                  </div>
                )}

                <div style={{ marginTop: '1rem' }}>
                  <button onClick={() => iniciarEdicao(empresa)}>Editar</button>
                  <button
                    onClick={() => apagarEmpresa(empresa._id)}
                    style={{ marginLeft: '1rem', color: 'red' }}
                  >
                    Excluir empresa
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default EmpresasList;
