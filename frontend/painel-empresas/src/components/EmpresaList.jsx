import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import api from '../services/api';

const Container = styled.div`
  max-width: 700px;
  margin: 2rem auto;
  padding: 1rem 2rem;
  background-color: #f9fbfd;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
`;

const Title = styled.h2`
  text-align: center;
  margin-bottom: 2rem;
  color: #14213d;
`;

const List = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const Item = styled.li`
  background-color: white;
  border: 1.5px solid #ccc;
  border-radius: 10px;
  padding: 1rem 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 6px rgba(0,0,0,0.07);
`;

const Strong = styled.strong`
  font-size: 1.2rem;
  color: #14213d;
`;

const Paragraph = styled.p`
  margin: 0.3rem 0;
  color: #333;
  font-size: 0.95rem;
`;

const Label = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.7rem;
  font-weight: 500;
  user-select: none;

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
  }
`;

const Input = styled.input`
  width: 100%;
  padding: 0.45rem 0.75rem;
  margin: 0.35rem 0;
  font-size: 1rem;
  border: 1.5px solid #ccc;
  border-radius: 6px;
  transition: border-color 0.3s ease;

  &:focus {
    outline: none;
    border-color: #2a9df4;
    background-color: #e8f0fe;
  }
`;

const Button = styled.button`
  padding: 0.55rem 1.1rem;
  margin-top: 0.8rem;
  font-weight: 600;
  font-size: 0.95rem;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: background-color 0.3s ease;

  &:hover:not(:disabled) {
    filter: brightness(0.9);
  }

  &:disabled {
    background-color: #a3a3a3;
    cursor: not-allowed;
  }
`;

const ButtonPrimary = styled(Button)`
  background-color: #14213d;
  color: white;
`;

const ButtonSecondary = styled(Button)`
  background-color: #e0e0e0;
  color: #333;
  margin-left: 1rem;
`;

const ButtonDanger = styled(Button)`
  background-color: #d90429;
  color: white;
  margin-left: 1rem;
`;

const QRCodeWrapper = styled.div`
  margin-top: 1rem;
  text-align: center;

  p {
    font-weight: 600;
    color: #14213d;
  }

  img {
    width: 180px;
    height: 180px;
    border-radius: 10px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  }
`;

const ButtonGroup = styled.div`
  margin-top: 1rem;
  display: flex;
  align-items: center;
`;

const TextArea = styled.textarea`
  width: 100%;
  padding: 0.6rem 0.75rem;
  margin: 0.35rem 0;
  font-size: 1rem;
  border: 1.5px solid #ccc;
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

const SetorContainer = styled.div`
  background-color: #f0f4f9;
  padding: 1rem;
  border-radius: 8px;
  margin-top: 0.75rem;
  position: relative;
`;

const EmpresasList = () => {
  const [empresas, setEmpresas] = useState([]);
  const [qrCodes, setQrCodes] = useState({});
  const [loadingEmpresa, setLoadingEmpresa] = useState(null);
  const [empresaEditando, setEmpresaEditando] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    nome: '',
    promptIA: '',
    telefone: '',
    botAtivo: true,
    setores: []
  });
  const [erro, setErro] = useState('');

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

  const iniciarEdicao = (empresa) => {
    setErro('');
    setEmpresaEditando(empresa._id);
    setFormData({
      nome: empresa.nome || '',
      promptIA: empresa.promptIA || '',
      telefone: empresa.telefone || '',
      botAtivo: empresa.botAtivo ?? true,
      setores: empresa.setores ? [...empresa.setores] : []
    });
  };

  const adicionarSetor = () => {
    setFormData((prev) => ({
      ...prev,
      setores: [...prev.setores, { nome: '', prompt: '' }]
    }));
  };

  const removerSetor = (index) => {
    setFormData((prev) => ({
      ...prev,
      setores: prev.setores.filter((_, i) => i !== index)
    }));
  };

  const salvarEdicao = async (idEmpresa) => {
    setErro('');
    // Validação
    if (!formData.nome.trim()) {
      setErro('Nome da empresa é obrigatório.');
      return;
    }
    if (!formData.telefone.trim()) {
      setErro('Telefone da empresa é obrigatório.');
      return;
    }

    // Se tiver setores, validar todos
    if (formData.setores.length > 0) {
      const invalidos = formData.setores.some(
        (s) => !s.nome.trim() || !s.prompt.trim()
      );
      if (invalidos) {
        setErro('Todos os setores devem ter nome e prompt preenchidos.');
        return;
      }
    } else {
      // Se não tiver setores, validar promptIA
      if (!formData.promptIA.trim()) {
        setErro('Prompt IA é obrigatório se não houver setores.');
        return;
      }
    }

    // Montar payload: se tiver setores, promptIA geral pode ser vazio ou setado
    const payload = {
      nome: formData.nome.trim(),
      telefone: formData.telefone.trim(),
      botAtivo: formData.botAtivo,
      setores: formData.setores.length > 0 ? formData.setores : [],
      promptIA: formData.setores.length === 0 ? formData.promptIA.trim() : '',
    };

    try {
      const res = await api.put(`/empresas/${idEmpresa}`, payload);
      setEmpresas((prev) =>
        prev.map((e) => (e._id === idEmpresa ? res.data : e))
      );
      setEmpresaEditando(null);
    } catch (err) {
      console.error('Erro ao editar empresa:', err);
      setErro('Erro ao salvar empresa. Tente novamente.');
    }
  };

  const cancelarEdicao = () => {
    setEmpresaEditando(null);
    setFormData({ nome: '', promptIA: '', telefone: '', botAtivo: true, setores: [] });
    setErro('');
  };

  const empresasFiltradas = empresas.filter((empresa) =>
    empresa.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    empresa.telefone.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

    if (!window.confirm(`Deseja excluir a empresa "${empresa.nome}"?`)) return;

    try {
      await api.delete(`/empresas/${idEmpresa}`);
      setEmpresas((prev) => prev.filter((empresa) => empresa._id !== idEmpresa));
      setQrCodes((prev) => {
        const novos = { ...prev };
        delete novos[empresa.nome];
        return novos;
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

  return (
    <Container>
      <Title>Empresas</Title>
      <Input
        type="text"
        placeholder="Buscar por nome ou telefone..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ marginBottom: '1.5rem' }}
      />

      {erro && (
        <Paragraph style={{ color: 'red', fontWeight: '600', textAlign: 'center' }}>
          {erro}
        </Paragraph>
      )}

      <List>
        {empresasFiltradas.map((empresa) => (
          <Item key={empresa._id}>
            {empresaEditando === empresa._id ? (
              <div>
                <Input
                  type="text"
                  placeholder="Nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                />
                <Input
                  type="text"
                  placeholder="Telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                />

                {formData.setores.length > 0 ? (
                  <>
                    {formData.setores.map((setor, index) => (
                      <SetorContainer key={index}>
                        <Input
                          type="text"
                          placeholder={`Nome do setor ${index + 1}`}
                          value={setor.nome}
                          onChange={(e) => {
                            const novos = [...formData.setores];
                            novos[index].nome = e.target.value;
                            setFormData({ ...formData, setores: novos });
                          }}
                        />

                        <TextArea
                          placeholder={`Prompt do setor ${index + 1}`}
                          value={setor.prompt}
                          onChange={(e) => {
                            const novos = [...formData.setores];
                            novos[index].prompt = e.target.value;
                            setFormData({ ...formData, setores: novos });
                          }}
                        />

                        <ButtonDanger onClick={() => removerSetor(index)}>
                          Remover setor
                        </ButtonDanger>
                      </SetorContainer>
                    ))}

                    <ButtonSecondary onClick={adicionarSetor} style={{ marginTop: '1rem' }}>
                      Adicionar setor
                    </ButtonSecondary>
                  </>
                ) : (
                  <>
                    <TextArea
                      placeholder="Prompt geral da IA"
                      value={formData.promptIA}
                      onChange={(e) => setFormData({ ...formData, promptIA: e.target.value })}
                    />
                    <ButtonSecondary onClick={adicionarSetor} style={{ marginTop: '1rem' }}>
                      Deseja usar setores? Adicione um setor
                    </ButtonSecondary>
                  </>
                )}

                <Label>
                  <input
                    type="checkbox"
                    checked={formData.botAtivo}
                    onChange={(e) => setFormData({ ...formData, botAtivo: e.target.checked })}
                  />
                  Bot ativo
                </Label>

                <ButtonGroup>
                  <ButtonPrimary onClick={() => salvarEdicao(empresa._id)}>Salvar</ButtonPrimary>
                  <ButtonSecondary onClick={cancelarEdicao}>Cancelar</ButtonSecondary>
                </ButtonGroup>
              </div>
            ) : (
              <div>
                <Strong>{empresa.nome}</Strong>
                <Paragraph>Telefone: {empresa.telefone}</Paragraph>
                {empresa.setores && empresa.setores.length > 0 ? (
                  <>
                    <Paragraph><strong>Setores:</strong></Paragraph>
                    {empresa.setores.map((setor, i) => (
                      <Paragraph key={i}>• {setor.nome}</Paragraph>
                    ))}
                  </>
                ) : (
                  <Paragraph>Prompt IA: {empresa.promptIA}</Paragraph>
                )}

                <Label>
                  <input
                    type="checkbox"
                    checked={empresa.botAtivo}
                    onChange={() => alternarStatusBot(empresa._id)}
                  />
                  Bot ativo
                </Label>

                <ButtonPrimary
                  onClick={() => gerarNovoQrCode(empresa._id, empresa.nome)}
                  disabled={loadingEmpresa === empresa._id}
                >
                  {loadingEmpresa === empresa._id ? 'Gerando QR Code...' : 'Gerar novo QR Code'}
                </ButtonPrimary>

                {qrCodes[empresa.nome] && (
                  <QRCodeWrapper>
                    <p>QR Code:</p>
                    <img src={qrCodes[empresa.nome]} alt={`QR Code - ${empresa.nome}`} />
                  </QRCodeWrapper>
                )}

                <ButtonGroup>
                  <ButtonPrimary onClick={() => iniciarEdicao(empresa)}>Editar</ButtonPrimary>
                  <ButtonDanger onClick={() => apagarEmpresa(empresa._id)}>Excluir empresa</ButtonDanger>
                </ButtonGroup>
              </div>
            )}
          </Item>
        ))}
      </List>
    </Container>
  );
};

export default EmpresasList;