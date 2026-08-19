function FashionTemplate() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FFFFFF",
        padding: "60px",
        fontFamily: "Montserrat, sans-serif",
      }}
    >

      <h1
        style={{
          fontSize:"55px",
          color:"#111111",
          letterSpacing:"2px"
        }}
      >
        Your Fashion Brand
      </h1>


      <p
        style={{
          fontSize:"20px",
          color:"#555",
          maxWidth:"550px"
        }}
      >
        Create a modern fashion store and showcase your latest collections.
      </p>


      <button
        style={{
          marginTop:"30px",
          background:"#111111",
          color:"#fff",
          border:"none",
          padding:"15px 40px",
          borderRadius:"0px",
          cursor:"pointer"
        }}
      >
        Explore Collection
      </button>



      <div
        style={{
          display:"grid",
          gridTemplateColumns:"repeat(3,1fr)",
          gap:"20px",
          marginTop:"60px"
        }}
      >

        <div
          style={{
            height:"200px",
            background:"#f3f3f3",
            display:"flex",
            alignItems:"center",
            justifyContent:"center"
          }}
        >
          New Collection
        </div>


        <div
          style={{
            height:"200px",
            background:"#f3f3f3",
            display:"flex",
            alignItems:"center",
            justifyContent:"center"
          }}
        >
          Best Sellers
        </div>


        <div
          style={{
            height:"200px",
            background:"#f3f3f3",
            display:"flex",
            alignItems:"center",
            justifyContent:"center"
          }}
        >
          Lookbook
        </div>


      </div>


    </div>
  );
}

export default FashionTemplate;