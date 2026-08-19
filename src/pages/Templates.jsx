import { useState } from "react";
import { useNavigate } from "react-router-dom";


const categories = [
  {
    id: "all",
    label: "All"
  },
  {
    id: "modern",
    label: "Modern"
  },
  {
    id: "dark",
    label: "Luxury Dark"
  }
];



const templates = [

  {
    id: "modern",
    title: "Modern Style",
    category: "modern",
    badge: "Modern Business",
    description:
      "A clean bright design for brands, stores and businesses.",
    features: [
      "Products",
      "Gallery",
      "Contact"
    ],
    previewBg: "#f5f5f5",
  },


  {
    id: "dark",
    title: "Luxury Dark",
    category: "dark",
    badge: "Luxury Brand",
    description:
      "A premium dark beige design for fashion and luxury brands.",
    features: [
      "Shop",
      "Collections",
      "Brand Page"
    ],
    previewBg: "#1a1a1a",
  }

];



function Templates() {
  const navigate = useNavigate();

  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState([]);
const [previewTemplate, setPreviewTemplate] = useState(null);

const filteredTemplates = templates.filter((tpl) => {
  const matchesCategory =
    selectedCategory === "all" ||
    tpl.category === selectedCategory;

  const matchesSearch =
    tpl.title.toLowerCase().includes(searchQuery.toLowerCase());

  return matchesCategory && matchesSearch;
});

function toggleFavorite(id) {
  setFavorites((current) =>
    current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]
  );
}

function handleSelectTemplate(id) {
  localStorage.setItem("selectedTemplate", id);
  navigate("/editor");
}
  return (
    <div
      className="templates-page-container"
      style={{
        background: "#f8fafc",
        minHeight: "100vh",
        padding: "40px 24px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#0f172a",
      }}
    >
      {/* Header */}
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto 40px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
        }}
      >
        <div>
          <span
            style={{
              fontSize: "12px",
              fontWeight: "700",
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "1.5px",
            }}
          >
            Website Builder Templates
          </span>

          <h1
            style={{
              fontSize: "48px",
              margin: "8px 0",
              fontWeight: "800",
              letterSpacing: "-2px",
            }}
          >
            Choose your business design
          </h1>

          <p
            style={{
              color: "#64748b",
              maxWidth: "600px",
              lineHeight: "1.6",
            }}
          >
            Start with a professional website template and customize it for
            your business.
          </p>
        </div>

        <button
          onClick={() => navigate("/dashboard")}
          style={{
            padding: "12px 22px",
            borderRadius: "12px",
            border: "1px solid #ddd",
            background: "#fff",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          ← Dashboard
        </button>
      </div>


      {/* Search + Categories */}
      <div
        style={{
          maxWidth: "1280px",
          margin: "0 auto 40px",
          background: "#fff",
          padding: "20px",
          borderRadius: "18px",
          display: "flex",
          gap: "20px",
          justifyContent: "space-between",
          flexWrap: "wrap",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                padding: "10px 16px",
                borderRadius: "10px",
                border: "none",
                cursor: "pointer",
                fontWeight: "600",
                background:
                  selectedCategory === cat.id
                    ? "#111827"
                    : "#f1f5f9",
                color:
                  selectedCategory === cat.id
                    ? "#fff"
                    : "#475569",
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            border: "1px solid #cbd5e1",
            minWidth: "260px",
          }}
        />
      </div>


      {/* Template Cards */}
      <div
        style={{
          maxWidth: "1280px",
          margin: "auto",
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(360px,1fr))",
          gap: "30px",
        }}
      >
        {filteredTemplates.map((tpl) => (
          <div
            key={tpl.id}
            style={{
              background: "#fff",
              borderRadius: "24px",
              overflow: "hidden",
              border: "1px solid #e2e8f0",
              boxShadow:
                "0 15px 35px rgba(0,0,0,0.06)",
            }}
          >

            {/* Website Preview */}
            <div
              style={{
                background: tpl.previewBg,
                padding: "20px",
                height: "280px",
              }}
            >

              <div
                style={{
                  background:"#fff",
                  borderRadius:"14px",
                  height:"100%",
                  overflow:"hidden",
                }}
              >

                {/* Browser */}
                <div
                  style={{
                    height:"25px",
                    display:"flex",
                    gap:"5px",
                    alignItems:"center",
                    paddingLeft:"12px",
                  }}
                >
                  <span>●</span>
                  <span>●</span>
                  <span>●</span>
                </div>


                <div
                  style={{
                    padding:"20px",
                  }}
                >
                  <small
                    style={{
                      color:"#64748b",
                      fontWeight:"700"
                    }}
                  >
                    {tpl.badge}
                  </small>

                  <h2
                    style={{
                      fontSize:"28px",
                      margin:"12px 0",
                    }}
                  >
                    {tpl.title}
                  </h2>

                  <button
                    style={{
                      background:"#111827",
                      color:"#fff",
                      border:"none",
                      padding:"8px 14px",
                      borderRadius:"8px",
                      fontSize:"12px"
                    }}
                  >
                    Get Started
                  </button>


                  <div
                    style={{
                      display:"grid",
                      gridTemplateColumns:"repeat(3,1fr)",
                      gap:"8px",
                      marginTop:"25px"
                    }}
                  >
                    {[1,2,3].map((x)=>(
                      <div
                        key={x}
                        style={{
                          height:"45px",
                          background:"#e5e7eb",
                          borderRadius:"8px"
                        }}
                      />
                    ))}
                  </div>

                </div>

              </div>

            </div>


            {/* Info */}
            <div
              style={{
                padding:"24px"
              }}
            >

              <div
                style={{
                  display:"flex",
                  justifyContent:"space-between",
                  alignItems:"center"
                }}
              >

                <h2
                  style={{
                    margin:0,
                    fontSize:"22px"
                  }}
                >
                  {tpl.title}
                </h2>


                <button
                  onClick={()=>toggleFavorite(tpl.id)}
                  style={{
                    border:"none",
                    background:"none",
                    fontSize:"22px",
                    cursor:"pointer"
                  }}
                >
                  {favorites.includes(tpl.id)
                    ? "♥"
                    :"♡"}
                </button>

              </div>


              <p
                style={{
                  color:"#64748b",
                  lineHeight:"1.6"
                }}
              >
                {tpl.description}
              </p>


              <div
                style={{
                  display:"flex",
                  flexWrap:"wrap",
                  gap:"8px",
                  marginBottom:"20px"
                }}
              >
                {tpl.features.map((feature)=>(
                  <span
                    key={feature}
                    style={{
                      background:"#f1f5f9",
                      padding:"6px 10px",
                      borderRadius:"8px",
                      fontSize:"12px"
                    }}
                  >
                    {feature}
                  </span>
                ))}
              </div>


              <div
                style={{
                  display:"flex",
                  gap:"12px"
                }}
              >

                <button
onClick={() => navigate(`/template-preview/${tpl.id}`)}

                  style={{
                    flex:1,
                    padding:"12px",
                    borderRadius:"10px",
                    border:"1px solid #ddd",
                    background:"#fff",
                    cursor:"pointer"
                  }}
                >
                  Preview
                </button>


                <button
                  onClick={()=>handleSelectTemplate(tpl.id)}
                  style={{
                    flex:1,
                    padding:"12px",
                    borderRadius:"10px",
                    border:"none",
                    background:"#111827",
                    color:"#fff",
                    cursor:"pointer"
                  }}
                >
                  Use Template
                </button>

              </div>

            </div>

          </div>
        ))}

      </div>


      {/* Preview Modal */}
      {previewTemplate && (
        <div
          style={{
            position:"fixed",
            inset:0,
            background:"rgba(0,0,0,.6)",
            display:"flex",
            alignItems:"center",
            justifyContent:"center",
            zIndex:1000
          }}
        >

          <div
            style={{
              background:"#fff",
              padding:"30px",
              borderRadius:"20px",
              width:"90%",
              maxWidth:"600px"
            }}
          >

            <h2>
              {previewTemplate.title}
            </h2>

            <p>
              {previewTemplate.description}
            </p>


            <button
              onClick={()=>handleSelectTemplate(previewTemplate.id)}
              style={{
                background:"#111827",
                color:"#fff",
                padding:"12px 20px",
                border:"none",
                borderRadius:"10px",
                cursor:"pointer"
              }}
            >
              Launch Template
            </button>


            <button
              onClick={()=>setPreviewTemplate(null)}
              style={{
                marginLeft:"10px",
                padding:"12px 20px",
                borderRadius:"10px",
                border:"1px solid #ddd",
                cursor:"pointer"
              }}
            >
              Close
            </button>

          </div>

        </div>
      )}

    </div>
  );
  ;
}

export default Templates;