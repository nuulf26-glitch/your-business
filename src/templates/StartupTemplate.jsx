function StartupTemplate() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        fontFamily: "Inter, Arial, sans-serif",
        color: "#0f172a",
      }}
    >

      {/* Navbar */}
      <nav
        style={{
          padding: "25px 60px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "#fff",
        }}
      >

        <h2>
          Your Startup
        </h2>


        <button
          style={{
            background:"#2563EB",
            color:"#fff",
            border:"none",
            padding:"12px 25px",
            borderRadius:"10px",
            cursor:"pointer"
          }}
        >
          Get Started
        </button>

      </nav>


      {/* Hero */}
      <section
        style={{
          padding:"80px 60px",
          textAlign:"center"
        }}
      >

        <h1
          style={{
            fontSize:"55px",
            marginBottom:"20px"
          }}
        >
          Build the future with your idea
        </h1>


        <p
          style={{
            fontSize:"20px",
            color:"#64748b",
            maxWidth:"650px",
            margin:"auto"
          }}
        >
          A modern startup website template designed
          for technology companies and digital products.
        </p>


        <button
          style={{
            marginTop:"35px",
            background:"#2563EB",
            color:"#fff",
            border:"none",
            padding:"15px 35px",
            borderRadius:"12px",
            fontSize:"16px"
          }}
        >
          Start Now
        </button>


      </section>



      {/* Features */}

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
            "Powerful Tools",
            "Smart Analytics",
            "Easy Management"
          ].map((item)=>(

            <div
              key={item}
              style={{
                background:"#fff",
                padding:"30px",
                borderRadius:"20px",
                textAlign:"center",
                boxShadow:"0 10px 30px rgba(0,0,0,.05)"
              }}
            >

              <h3>
                {item}
              </h3>


              <p
                style={{
                  color:"#64748b"
                }}
              >
                Everything your business needs to grow.
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
        © 2026 Your Startup
      </footer>


    </div>
  );
}

export default StartupTemplate;