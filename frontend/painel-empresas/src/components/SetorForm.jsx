// components/SetorForm.jsx
import React, { useState } from 'react';
import styled from 'styled-components';

const SetorContainer = styled.div`
  background: #f5f7fa;
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1rem;
`;

const SetorForm = ({ setor, onSave, onRemove }) => {
  const [dados, setDados] = useState(setor);
  const [editandoFluxo, setEditandoFluxo] = useState(false);

  const handleAddOpcao = () => {
    setDados({
      ...dados,
      fluxo: {
        ...dados.fluxo,
        opcoes: [...(dados.fluxo?.opcoes || []), { texto: '', acao: 'resposta', destino: '' }]
      }
    });
  };

  return (
    <SetorContainer>
      <h4>Setor: {dados.nome}</h4>
      
      <div>
        <label>Prompt do Setor:</label>
        <textarea
          value={dados.prompt}
          onChange={(e) => setDados({...dados, prompt: e.target.value})}
          rows={4}
        />
      </div>

      <button onClick={() => setEditandoFluxo(!editandoFluxo)}>
        {editandoFluxo ? 'Ocultar Fluxo' : 'Editar Fluxo'}
      </button>

      {editandoFluxo && (
        <div>
          <h5>Fluxo de Atendimento</h5>
          <label>Mensagem Inicial:</label>
          <input
            value={dados.fluxo?.mensagemInicial || ''}
            onChange={(e) => setDados({
              ...dados,
              fluxo: { ...dados.fluxo, mensagemInicial: e.target.value }
            })}
          />

          <h6>Opções:</h6>
          {dados.fluxo?.opcoes?.map((opcao, i) => (
            <div key={i}>
              <input
                placeholder="Texto da opção"
                value={opcao.texto}
                onChange={(e) => {
                  const novasOpcoes = [...dados.fluxo.opcoes];
                  novasOpcoes[i].texto = e.target.value;
                  setDados({
                    ...dados,
                    fluxo: { ...dados.fluxo, opcoes: novasOpcoes }
                  });
                }}
              />
              <select
                value={opcao.acao}
                onChange={(e) => {
                  const novasOpcoes = [...dados.fluxo.opcoes];
                  novasOpcoes[i].acao = e.target.value;
                  setDados({
                    ...dados,
                    fluxo: { ...dados.fluxo, opcoes: novasOpcoes }
                  });
                }}
              >
                <option value="resposta">Resposta Fixa</option>
                <option value="encaminhar">Encaminhar para Setor</option>
                <option value="finalizar">Finalizar Atendimento</option>
              </select>
              <input
                placeholder={opcao.acao === 'encaminhar' ? 'Nome do setor destino' : 'Resposta'}
                value={opcao.destino}
                onChange={(e) => {
                  const novasOpcoes = [...dados.fluxo.opcoes];
                  novasOpcoes[i].destino = e.target.value;
                  setDados({
                    ...dados,
                    fluxo: { ...dados.fluxo, opcoes: novasOpcoes }
                  });
                }}
              />
            </div>
          ))}
          <button onClick={handleAddOpcao}>+ Adicionar Opção</button>
        </div>
      )}

      <div>
        <button onClick={() => onSave(dados)}>Salvar</button>
        <button onClick={onRemove}>Remover Setor</button>
      </div>
    </SetorContainer>
  );
};

export default SetorForm;

// Tratando os setores