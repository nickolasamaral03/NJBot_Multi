import styled, { createGlobalStyle } from "styled-components"
import NovaEmpresa from "./components/EmpresaForm"
import EmpresasList from "./components/EmpresaList"
import Header from '../src/components/Header'

const GlobalStyle = createGlobalStyle`
  html, body, #root {
    margin: 0;
    padding: 0;
    min-height: 100%;
    background-color:rgba(13, 27, 42, 0.77); /* azul escuro */
    font-family: sans-serif;
  }

  body {
    background-color: #0d1b2a;
  }
`
const Container = styled.div`
   min-height: 100%;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
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

const Image = styled.img`
  width: 60px;
  height: 60px;
  border-radius: 50%;
`

function App() {

  return (
    <>
      <GlobalStyle />
      <Container>
        <Header/>
        <NovaEmpresa />
        <EmpresasList />
      </Container>
    </>
  )
}

export default App

// // Agora precisamos:

// // Fluxo atual: Se precisa conversar com humano coloque na conversa e vai para o humano, se ficar 10 minutos inativo voltará para o bot
// // Melhorar o fluxo na segunda atualização: O usuario conseguir interromper a IA e responder, usuario conseguir voltar a IA com alguma palavra chave

// // Refinar o chatbot para responder de uma melhor maneira
// // Melhorar o front-end, adicionar mais estilos e responsividad