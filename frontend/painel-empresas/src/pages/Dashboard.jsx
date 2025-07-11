function DashBoard() {
    
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

export default DashBoard