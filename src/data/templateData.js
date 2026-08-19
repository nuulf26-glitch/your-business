export const templateData = {

  light: {

    name: "Light Style",

    theme: {
      primaryColor: "#111111",
      backgroundColor: "#FFFFFF",
      font: "Poppins"
    },

    brandName: "Your Brand",

    elements: [

      {
        id: 1,
        type: "navbar",
        content: "Your Brand",
        menu: [
          "Home",
          "Products",
          "About",
          "Contact"
        ],
        x: 80,
        y: 40,
        style: {
          fontFamily: "Poppins",
          fontSize: 18,
          color: "#111111",
          fontWeight: "600"
        }
      },


      {
        id: 2,
        type: "heading",
        content: "Create Something Beautiful",
        x: 100,
        y: 160,
        style: {
          fontFamily: "Poppins",
          fontSize: 52,
          color: "#111111",
          fontWeight: "700"
        }
      },


      {
        id: 3,
        type: "text",
        content:
        "A modern website template made for your business.",
        x: 100,
        y: 250,
        style: {
          fontFamily: "Arial",
          fontSize: 20,
          color: "#555555",
          fontWeight: "400"
        }
      },


      {
        id: 4,
        type: "button",
        content: "Shop Now",
        x: 100,
        y: 330,
        style: {
          fontFamily: "Poppins",
          fontSize: 16,
          color: "#FFFFFF",
          fontWeight: "600"
        }
      },


      {
        id: 5,
        type: "image",
        content: "",
        image: null,
        x: 650,
        y: 120,
        style: {
          fontFamily: "Arial",
          fontSize: 20,
          color: "#111111",
          fontWeight: "400"
        }
      },


      {
        id: 6,
        type: "section",
        content: "Featured Products",
        x: 100,
        y: 550,
        style: {
          fontFamily: "Poppins",
          fontSize: 36,
          color: "#111111",
          fontWeight: "700"
        }
      },


      {
        id: 7,
        type: "product",
        content: "Product One",
        x: 100,
        y: 650,
        product: {
          price: "$120",
          description:
          "Product description here",
          image:null
        },
        style:{
          fontFamily:"Arial",
          fontSize:18,
          color:"#111111",
          fontWeight:"400"
        }
      },


      {
        id: 8,
        type:"product",
        content:"Product Two",
        x:400,
        y:650,
        product:{
          price:"$150",
          description:"Another product",
          image:null
        },
        style:{
          fontFamily:"Arial",
          fontSize:18,
          color:"#111111",
          fontWeight:"400"
        }
      },


      {
        id:9,
        type:"section",
        content:"About Our Brand",
        x:100,
        y:950,
        style:{
          fontFamily:"Poppins",
          fontSize:36,
          color:"#111111",
          fontWeight:"700"
        }
      },


      {
        id:10,
        type:"review",
        content:
        "Amazing quality and great experience.",
        x:100,
        y:1100,
        style:{
          fontFamily:"Arial",
          fontSize:18,
          color:"#444444",
          fontWeight:"400"
        }
      },


      {
        id:11,
        type:"footer",
        content:
        "© 2026 Your Brand",
        x:100,
        y:1400,
        style:{
          fontFamily:"Arial",
          fontSize:16,
          color:"#555555",
          fontWeight:"400"
        }
      }

    ]

  },


  dark: {

    name:"Dark Style",

    theme:{
      primaryColor:"#D6B98C",
      backgroundColor:"#111111",
      font:"Montserrat"
    },

    brandName:"Premium Brand",

    elements:[

      {
        id:1,
        type:"navbar",
        content:"Premium Brand",
        menu:[
          "Home",
          "Collection",
          "About",
          "Contact"
        ],
        x:80,
        y:40,
        style:{
          fontFamily:"Montserrat",
          fontSize:18,
          color:"#FFFFFF",
          fontWeight:"600"
        }
      },


      {
        id:2,
        type:"heading",
        content:"Premium Collection",
        x:100,
        y:160,
        style:{
          fontFamily:"Montserrat",
          fontSize:52,
          color:"#FFFFFF",
          fontWeight:"700"
        }
      },


      {
        id:3,
        type:"text",
        content:
        "Elegant design for modern brands.",
        x:100,
        y:250,
        style:{
          fontFamily:"Arial",
          fontSize:20,
          color:"#D6D3D1",
          fontWeight:"400"
        }
      },


      {
        id:4,
        type:"button",
        content:"Explore",
        x:100,
        y:330,
        style:{
          fontFamily:"Montserrat",
          fontSize:16,
          color:"#111111",
          fontWeight:"600"
        }
      },


      {
        id:5,
        type:"image",
        content:"",
        image:null,
        x:650,
        y:120,
        style:{
          fontFamily:"Arial",
          fontSize:20,
          color:"#FFFFFF",
          fontWeight:"400"
        }
      },


      {
        id:6,
        type:"section",
        content:"Products",
        x:100,
        y:550,
        style:{
          fontFamily:"Montserrat",
          fontSize:36,
          color:"#FFFFFF",
          fontWeight:"700"
        }
      },


      {
        id:7,
        type:"product",
        content:"Premium Product",
        x:100,
        y:650,
        product:{
          price:"$300",
          description:"Luxury item",
          image:null
        },
        style:{
          fontFamily:"Arial",
          fontSize:18,
          color:"#FFFFFF",
          fontWeight:"400"
        }
      },


      {
        id:8,
        type:"footer",
        content:"© 2026 Premium Brand",
        x:100,
        y:1300,
        style:{
          fontFamily:"Arial",
          fontSize:16,
          color:"#D6D3D1",
          fontWeight:"400"
        }
      }

    ]

  }

};