function BeautyTemplate() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FFF7FA",
        fontFamily: "Playfair Display, Arial, sans-serif",
        color: "#3d2430",
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
          Your Beauty Brand
        </h2>


        <button
          style={{
            background:"#E9A8C6",
            color:"#fff",
            border:"none",
            padding:"12px 25px",
            borderRadius:"10px"
          }}
        >
          Shop Now
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
          Beauty made for you
        </h1>


        <p
          style={{
            fontSize:"20px",
            color:"#8a6473",
            maxWidth:"650px",
            margin:"auto"
          }}
        >
          Elegant beauty website template for skincare,
          cosmetics and personal care brands.
        </p>


        <button
          style={{
            marginTop:"35px",
            background:"#E9A8C6",
            color:"#fff",
            border:"none",
            padding:"15px 35px",
            borderRadius:"12px"
          }}
        >
          Explore Products
        </button>


      </section>



      {/* Products */}

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
            "Skincare",
            "Makeup",
            "Luxury Care"
          ].map((item)=>(

            <div
              key={item}
              style={{
                background:"#fff",
                padding:"30px",
                borderRadius:"20px",
                textAlign:"center",
                boxShadow:"0 10px 25px rgba(0,0,0,.05)"
              }}
            >

              <div
                style={{
                  height:"120px",
                  background:"#FCE7F3",
                  borderRadius:"15px",
                  marginBottom:"20px"
                }}
              />


              <h3>
                {item}
              </h3>


              <p
                style={{
                  color:"#8a6473"
                }}
              >
                Premium products for your customers.
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
          color:"#8a6473"
        }}
      >
        © 2026 Your Beauty Brand
      </footer>


    </div>
  );
}

export default BeautyTemplate;