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

// Agora precisamos:

// Fluxo atual: Se precisa conversar com humano coloque na conversa e vai para o humano, se ficar 10 minutos inativo voltará para o bot
// Melhorar o fluxo na segunda atualização: O usuario conseguir interromper a IA e responder, usuario conseguir voltar a IA com alguma palavra chave

// Refinar o chatbot para responder de uma melhor maneira
// Melhorar o front-end, adicionar mais estilos e responsividade
