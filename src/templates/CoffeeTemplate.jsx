function CoffeeTemplate() {
  return (
    <div
      style={{
        minHeight:"100vh",
        background:"#FAF6F1",
        fontFamily:"Poppins, Arial, sans-serif",
        color:"#3E2723"
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
          Your Coffee Shop
        </h2>


        <button
          style={{
            background:"#A67C52",
            color:"#fff",
            border:"none",
            padding:"12px 25px",
            borderRadius:"10px"
          }}
        >
          Order Now
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
          Fresh coffee, warm moments
        </h1>


        <p
          style={{
            fontSize:"20px",
            color:"#795548",
            maxWidth:"650px",
            margin:"auto"
          }}
        >
          A beautiful coffee shop website template
          for cafes and beverage brands.
        </p>


        <button
          style={{
            marginTop:"35px",
            background:"#A67C52",
            color:"#fff",
            border:"none",
            padding:"15px 35px",
            borderRadius:"12px"
          }}
        >
          View Menu
        </button>


      </section>



      {/* Menu */}

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
            "Specialty Coffee",
            "Fresh Desserts",
            "Cafe Experience"
          ].map((item)=>(

            <div
              key={item}
              style={{
                background:"#ffffff",
                padding:"30px",
                borderRadius:"20px",
                textAlign:"center",
                boxShadow:"0 10px 25px rgba(0,0,0,.05)"
              }}
            >

              <div
                style={{
                  height:"130px",
                  background:"#E7D3C0",
                  borderRadius:"15px",
                  marginBottom:"20px"
                }}
              />


              <h3>
                {item}
              </h3>


              <p
                style={{
                  color:"#795548"
                }}
              >
                Create a memorable coffee experience.
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
          color:"#795548"
        }}
      >
        © 2026 Your Coffee Shop
      </footer>


    </div>
  );
}

export default CoffeeTemplate;