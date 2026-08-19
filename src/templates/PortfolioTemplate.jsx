function PortfolioTemplate() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:"#F8FAFC",
        fontFamily:"Poppins, Arial, sans-serif",
        color:"#111827"
      }}
    >

      {/* Navbar */}
      <nav
        style={{
          padding:"25px 60px",
          background:"#ffffff",
          display:"flex",
          justifyContent:"space-between",
          alignItems:"center"
        }}
      >

        <h2>
          Your Portfolio
        </h2>


        <button
          style={{
            background:"#6366F1",
            color:"#fff",
            border:"none",
            padding:"12px 25px",
            borderRadius:"10px"
          }}
        >
          Contact
        </button>

      </nav>



      {/* Hero */}

      <section
        style={{
          padding:"90px 60px",
          textAlign:"center"
        }}
      >

        <h1
          style={{
            fontSize:"55px",
            marginBottom:"20px"
          }}
        >
          Creative work that tells a story
        </h1>


        <p
          style={{
            fontSize:"20px",
            color:"#64748b",
            maxWidth:"650px",
            margin:"auto"
          }}
        >
          A professional portfolio template for designers,
          creators and creative professionals.
        </p>


        <button
          style={{
            marginTop:"35px",
            background:"#6366F1",
            color:"#fff",
            border:"none",
            padding:"15px 35px",
            borderRadius:"12px"
          }}
        >
          View Projects
        </button>

      </section>



      {/* Projects */}

      <section
        style={{
          display:"grid",
          gridTemplateColumns:"repeat(3,1fr)",
          gap:"25px",
          padding:"40px 60px"
        }}
      >

        {
          [
            "Project One",
            "Project Two",
            "Project Three"
          ].map((item)=>(

            <div
              key={item}
              style={{
                background:"#fff",
                padding:"30px",
                borderRadius:"20px",
                boxShadow:"0 10px 25px rgba(0,0,0,.05)"
              }}
            >

              <div
                style={{
                  height:"140px",
                  background:"#E0E7FF",
                  borderRadius:"15px",
                  marginBottom:"20px"
                }}
              />


              <h3>
                {item}
              </h3>


              <p
                style={{
                  color:"#64748b"
                }}
              >
                Showcase your best creative work here.
              </p>


            </div>

          ))
        }

      </section>



      {/* Footer */}

      <footer
        style={{
          padding:"30px",
          textAlign:"center",
          color:"#64748b"
        }}
      >
        © 2026 Your Portfolio
      </footer>


    </div>
  );
}

export default PortfolioTemplate;