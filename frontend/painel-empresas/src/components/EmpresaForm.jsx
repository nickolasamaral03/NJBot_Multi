
// COM SETORES - CHAT

import React, { useState, useEffect } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  max-width: 480px;
  margin: 2rem auto;
  padding: 1.5rem 2rem;
  background-color: rgba(231, 201, 201, 0.73);
  border-radius: 8px;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
`;

const Title = styled.h2`
  text-align: center;
  margin-bottom: 1.5rem;
  color: #14213d;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const Input = styled.input`
  padding: 0.6rem 1rem;
  font-size: 1rem;
  border: 1.8px solid #ccc;
  border-radius: 6px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #2a9df4;
    background-color: #e8f0fe;
  }
`;

const TextArea = styled.textarea`
  padding: 0.6rem 1rem;
  font-size: 1rem;
  border: 1.8px solid #ccc;
  border-radius: 6px;
  resize: vertical;
  min-height: 80px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #2a9df4;
    background-color: #e8f0fe;
  }
`;

const Label = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: #14213d;
  user-select: none;
`;

const Button = styled.button`
  padding: 0.75rem 1.2rem;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  background-color: #14213d;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover:not(:disabled) {
    background-color: #0f1b34;
  }

  &:disabled {
    background-color: #7a7a7a;
    cursor: not-allowed;
  }
`;

const MessageError = styled.p`
  color: #d90429;
  font-weight: 600;
  margin-top: 1rem;
  text-align: center;
`;

const MessageInfo = styled.p`
  color: #14213d;
  font-weight: 500;
  margin-top: 1rem;
  text-align: center;
`;

const QRCodeContainer = styled.div`
  margin-top: 1.5rem;
  text-align: center;

  img {
    max-width: 200px;
    border-radius: 12px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
  }

  h3 {
    margin-bottom: 1rem;
    color: #14213d;
  }
`;

const NovaEmpresa = () => {
  const [nome, setNome] = useState('');
  const [promptIA, setPromptIA] = useState('');
  const [telefone, setTelefone] = useState('');
  const [ativo, setAtivo] = useState(true);
  const [qtdSetores, setQtdSetores] = useState(1);
  const [setores, setSetores] = useState([{ nome: '', prompt: '' }]);
  const [qrCode, setQrCode] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [aguardandoQR, setAguardandoQR] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErro('');
    setQrCode(null);
    setAguardandoQR(false);

    const promptFinal = qtdSetores > 1
      ? `Olá! Com qual setor deseja falar?\n\n${setores.map(s => `* ${s.nome}`).join('\n')}\n\nEscolha uma opção e siga as instruções.`
      : promptIA;

    const payload = {
      nome,
      promptIA: promptFinal,
      telefone,
      ativo,
    };

    if (qtdSetores > 1) {
      const setoresInvalidos = setores.some(s => !s.nome.trim() || !s.prompt.trim());
      if (setoresInvalidos) {
        setErro('Todos os setores devem ter nome e prompt preenchidos.');
        setLoading(false);
        return;
      }
      payload.setores = setores;
    }

    try {
      const response = await fetch('http://localhost:3000/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        setErro(data.error || 'Erro ao cadastrar empresa');
      } else if (data.qrCode) {
        setQrCode(data.qrCode);
      } else {
        setAguardandoQR(true);
      }
    } catch (err) {
      console.error(err);
      setErro('Erro na conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  };

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
      }, 5000);
    }
    return () => clearInterval(intervalo);
  }, [aguardandoQR, nome]);

  return (
    <Container>
      <Title>Cadastrar Nova Empresa:</Title>
      <Form onSubmit={handleSubmit}>
        <Input
          type="text"
          placeholder="Nome da Empresa"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          required
        />

        <Input
          type="text"
          placeholder="Número do WhatsApp"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          required
        />

        <Input
          type="number"
          min="1"
          placeholder="Quantos setores sua empresa possui?"
          value={qtdSetores}
          onChange={(e) => {
            const val = Math.max(1, parseInt(e.target.value));
            setQtdSetores(val);
            const novosSetores = [];
            for (let i = 0; i < val; i++) {
              novosSetores[i] = setores[i] || { nome: '', prompt: '' };
            }
            setSetores(novosSetores);
          }}
          required
        />

        {qtdSetores > 1
          ? setores.map((setor, index) => (
              <div key={index}>
                <Input
                  type="text"
                  placeholder={`Nome do setor ${index + 1}`}
                  value={setor.nome}
                  onChange={(e) => {
                    const novos = [...setores];
                    novos[index].nome = e.target.value;
                    setSetores(novos);
                  }}
                  required
                />
                <TextArea
                  placeholder={`Prompt IA para setor ${index + 1}`}
                  value={setor.prompt}
                  onChange={(e) => {
                    const novos = [...setores];
                    novos[index].prompt = e.target.value;
                    setSetores(novos);
                  }}
                  required
                />
              </div>
            ))
          : (
            <TextArea
              placeholder="Prompt IA"
              value={promptIA}
              onChange={(e) => setPromptIA(e.target.value)}
              required
            />
          )}

        <Label>
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
          />
          Bot ativo
        </Label>

        <Button type="submit" disabled={loading}>
          {loading ? 'Cadastrando...' : 'Cadastrar e gerar QR Code'}
        </Button>
      </Form>

      {erro && <MessageError>{erro}</MessageError>}

      {aguardandoQR && <MessageInfo>Aguardando geração do QR Code...</MessageInfo>}

      {qrCode && (
        <QRCodeContainer>
          <h3>QR Code do WhatsApp</h3>
          <img src={qrCode} alt="QR Code do WhatsApp" />
        </QRCodeContainer>
      )}
    </Container>
  );
};

export default NovaEmpresa;

// Se desejar salvar os prompts separados por setor no backend para montar fluxos personalizados automaticamente, posso adaptar o backend também?

