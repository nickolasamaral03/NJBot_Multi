import styled, { keyframes } from "styled-components"
import logo from "../img/NJBot_original.jpg"

const colorShift = keyframes`
  0%   { color:rgb(73, 148, 228); }  /* Azul */
  50%  { color:rgb(207, 52, 52); }  /* Vermelho */
  100% { color:rgb(16, 52, 90); }  /* Azul novamente */
`

const Header = styled.header`
  width: 90%;
  background-color: #14213d;
  color: white;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  margin-top: -10px;
  border-radius: 10px; /* Ajuste para um valor menor e mais visível */

  p{
    margin-left: 20px;
    font-size: 0.8rem;
  }
`

const LogoSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: 10px;
`

const LogoImg = styled.img`
  height: 40px;
  width: 40px;
  border-radius: 50%;
`

const Saudacao = styled.div`
  font-size: 1.2rem;
  font-weight: 500;
  animation: ${colorShift} 7s infinite ease-in-out;
  margin-right: 20px;
`

function DashboardHeader() {
  return (
    <Header>
      <LogoSection>
        <LogoImg src={logo} alt="Logo NJBot" />
        <p>WHATS FINANCIAL</p>
      </LogoSection>
      <Saudacao>Bem-vindo ao painel do NJBot</Saudacao>
    </Header>
  )
}

export default DashboardHeader
