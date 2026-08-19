import { useState } from "react";


const templates = [

  {
    id: "modern",
    title: "Modern Style",
    category: "Modern Business",
    description:
      "A clean bright design for brands, stores and businesses.",
    image:
      "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d"
  },


  {
    id: "dark",
    title: "Luxury Dark",
    category: "Luxury Brand",
    description:
      "A premium dark design for fashion and luxury brands.",
    image:
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8"
  }

];



function Templates() {

  const [selectedTemplate, setSelectedTemplate] = useState(
    templates[0]
  );


  return (

    <section className="templates-section">

      <div className="templates-container">


        <div className="templates-heading">


          <div>

            <p className="section-eyebrow">
              PROFESSIONAL TEMPLATES
            </p>


            <h2>
              Start with a design
              <span>
                {" "}that already looks exceptional.
              </span>
            </h2>

          </div>



          <p>
            Choose a professionally designed template,
            upload your own images, change colors,
            and make it completely yours.
          </p>


        </div>





        <div className="templates-showcase">



          <div className="templates-preview">


            <img
              src={selectedTemplate.image}
              alt={selectedTemplate.title}
            />



            <div className="templates-preview-overlay" />



            <div className="templates-preview-content">


              <p>
                {selectedTemplate.category}
              </p>


              <h3>
                {selectedTemplate.title}
              </h3>


              <span>
                {selectedTemplate.description}
              </span>



              <button type="button">
                Preview Template
                <strong>
                  ↗
                </strong>
              </button>



            </div>


          </div>







          <div className="templates-list">


            {templates.map((template,index)=>{


              const isSelected =
                selectedTemplate.id === template.id;



              return (

                <button

                  type="button"

                  key={template.id}


                  className={
                    isSelected
                    ? "template-list-item active"
                    : "template-list-item"
                  }


                  onClick={() =>
                    setSelectedTemplate(template)
                  }

                >



                  <span className="template-list-number">

                    {String(index + 1).padStart(2,"0")}

                  </span>




                  <div>


                    <strong>
                      {template.title}
                    </strong>


                    <span>
                      {template.category}
                    </span>


                  </div>




                  <span className="template-list-arrow">

                    →

                  </span>



                </button>

              );

            })}


          </div>



        </div>







        <div className="templates-grid">


          {templates.map((template)=>(


            <article

              className="template-card"

              key={template.id}

            >


              <div className="template-card-image">


                <img

                  src={template.image}

                  alt={template.title}

                />



                <button

                  type="button"

                  onClick={() =>
                    setSelectedTemplate(template)
                  }

                >

                  View Template

                </button>



              </div>






              <div className="template-card-copy">


                <div>


                  <p>
                    {template.category}
                  </p>



                  <h3>
                    {template.title}
                  </h3>



                </div>



                <span>
                  ↗
                </span>


              </div>



            </article>


          ))}


        </div>








        <div className="templates-bottom">


          <p>
            Every template is mobile-ready and can be customized without coding.
          </p>



          <button type="button">

            Explore All Templates

            <span>
              →
            </span>


          </button>


        </div>



      </div>


    </section>

  );

}


export default Templates;