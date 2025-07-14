import styled from 'styled-components';
import Header from '../components/Header';
import EmpresasList from '../components/EmpresaList';
import EmpresaForm from '../components/EmpresaForm';

function DashBoard() {
    
    const Container = styled.div`
       min-height: 100%;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    `

  return (
    <>
      <Container>
        <Header/>
        <EmpresaForm />
        <EmpresasList />
      </Container>
    </>
  )
}

export default DashBoard