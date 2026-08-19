function RealEstateTemplate() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8FAFC",
        fontFamily: "Poppins, Arial, sans-serif",
        color: "#1E293B",
      }}
    >

      {/* Navbar */}
      <nav
        style={{
          padding: "25px 60px",
          background: "#ffffff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >

        <h2>
          Your Real Estate
        </h2>


        <button
          style={{
            background:"#1E293B",
            color:"#fff",
            border:"none",
            padding:"12px 25px",
            borderRadius:"10px",
          }}
        >
          Contact Us
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
          Find your perfect property
        </h1>


        <p
          style={{
            fontSize:"20px",
            color:"#64748b",
            maxWidth:"650px",
            margin:"auto"
          }}
        >
          A professional real estate website template
          to showcase properties and attract buyers.
        </p>


        <button
          style={{
            marginTop:"35px",
            background:"#1E293B",
            color:"#fff",
            border:"none",
            padding:"15px 35px",
            borderRadius:"12px"
          }}
        >
          View Properties
        </button>

      </section>



      {/* Properties */}

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
            "Luxury Villa",
            "Modern Apartment",
            "Commercial Space"
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
                  height:"130px",
                  background:"#E2E8F0",
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
                Beautiful property ready for your clients.
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
        © 2026 Your Real Estate
      </footer>


    </div>
  );
}

export default RealEstateTemplate;