function FitnessTemplate() {
  return (
    <div
      style={{
        minHeight:"100vh",
        background:"#F6FFF9",
        fontFamily:"Montserrat, Arial, sans-serif",
        color:"#14532D"
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
          Your Fitness
        </h2>


        <button
          style={{
            background:"#22C55E",
            color:"#fff",
            border:"none",
            padding:"12px 25px",
            borderRadius:"10px"
          }}
        >
          Join Now
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
          Transform your body and lifestyle
        </h1>


        <p
          style={{
            fontSize:"20px",
            color:"#64748b",
            maxWidth:"650px",
            margin:"auto"
          }}
        >
          A modern fitness website template for gyms,
          trainers and wellness businesses.
        </p>


        <button
          style={{
            marginTop:"35px",
            background:"#22C55E",
            color:"#fff",
            border:"none",
            padding:"15px 35px",
            borderRadius:"12px"
          }}
        >
          Start Training
        </button>

      </section>



      {/* Programs */}

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
            "Workout Programs",
            "Personal Training",
            "Nutrition Plans"
          ].map((item)=>(

            <div
              key={item}
              style={{
                background:"#ffffff",
                padding:"30px",
                borderRadius:"20px",
                boxShadow:"0 10px 25px rgba(0,0,0,.05)"
              }}
            >

              <div
                style={{
                  height:"130px",
                  background:"#DCFCE7",
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
                Build a healthier lifestyle with our programs.
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
        © 2026 Your Fitness
      </footer>


    </div>
  );
}

export default FitnessTemplate;