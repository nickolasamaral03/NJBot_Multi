import styled from "styled-components"
import NovaEmpresa from "./components/EmpresaForm"
import EmpresasList from "./components/EmpresaList"

const Titulo = styled.h1`
  font-size: 2rem;
  color: royalblue;
  font-weight: bold;
`

const Container = styled.div`
  padding: 20px;
`

const BotaoAtualizar = styled.button`
  margin-bottom: 1rem;
  padding: 0.5rem 1rem;
  background-color: royalblue;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-weight: bold;
  
  &:hover {
    background-color: darkblue;
  }
`

function App() {
  const atualizarPagina = () => {
    window.location.reload()
  }

  return (
    <Container>
      <Titulo>Bem-vindo ao Painel de Empresas</Titulo>
      <BotaoAtualizar onClick={atualizarPagina}>Atualizar Página</BotaoAtualizar>
      <NovaEmpresa />
      <EmpresasList />
    </Container>
  )
}

export default App

// O que já temos:
// - Cadastro de empresa com geração de QR Code
// - Reinício do bot para gerar novo QR Code

// Agora precisamos:
// Melhorar o fluxo entre humano e bot para responder
// Desativar não está funcionando
// Refinar o chatbot para responder de uma melhor maneira
// Melhorar o front-end, adicionar mais estilos e responsividade
