import React, { useState, useEffect } from 'react';

const NovaEmpresa = () => {
  const [nome, setNome] = useState('');
  const [promptIA, setPromptIA] = useState('');
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [aguardandoQR, setAguardandoQR] = useState(false);
  const [telefone, setTelefone] = useState('');
  const [ativo, setAtivo] = useState(true);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setQrCode(null);
    setAguardandoQR(false);

    try {
      const response = await fetch('http://localhost:3000/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, promptIA, telefone, ativo }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErro(data.error || 'Erro ao cadastrar empresa');
      } else if (data.qrCode) {
        setQrCode(data.qrCode);
      } else {
        // Se ainda não veio o QR Code, entramos em estado de espera
        setAguardandoQR(true);
      }
    } catch (err) {
      console.error(err);
      setErro('Erro na conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Polling (busca) para pegar o QR Code, caso ele venha com atraso
  useEffect(() => {
  let intervalo;
  if (aguardandoQR && nome) {
    intervalo = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/qr/${nome}`);
        if (res.status === 200 || res.status === 201) {
          const data = await res.json();
          if (data.qrCode) {
            setQrCode(data.qrCode);
            setAguardandoQR(false);
            clearInterval(intervalo);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar QR Code:', err);
      }
    }, 5000); // tenta a cada 5 segundos
  }

  return () => clearInterval(intervalo);
}, [aguardandoQR, nome]);


  return (
    <div>
      <h2>Cadastrar Nova Empresa</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nome da Empresa"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />
        <textarea
          placeholder="Prompt IA"
          value={promptIA}
          onChange={(e) => setPromptIA(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Número do WhatsApp"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          required
        />

        <label>
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
          Bot ativo
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'Cadastrando...' : 'Cadastrar e gerar QR Code'}
        </button>
      </form>

      {erro && <p style={{ color: 'red' }}>{erro}</p>}

      {aguardandoQR && <p>Aguardando geração do QR Code...</p>}

      {qrCode && (
        <div>
          <h3>QR Code do WhatsApp</h3>
          <img src={qrCode} alt="QR Code do WhatsApp" />
        </div>
      )}
    </div>
  );
};

export default NovaEmpresa;
