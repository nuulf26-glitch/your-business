function ModernTemplate({
  primaryColor,
  backgroundColor
}) {


  return (

    <div
  className="modern-template"
  style={{
    backgroundColor: backgroundColor
  }}
>


      {/* NAVBAR */}

      <nav className="modern-navbar">

        <h2>
          Your Brand
        </h2>


        <div className="modern-menu">

          <span>Home</span>
          <span>Shop</span>
          <span>About</span>
          <span>Contact</span>

        </div>


      </nav>




      {/* HERO SECTION */}

      <section className="modern-hero">


        <div className="modern-hero-text">


          <h1>
            Build Your Dream Brand
          </h1>


          <p>
            A beautiful modern website designed for your business.
          </p>


          <button
  style={{
    backgroundColor: primaryColor
  }}
>
  Explore Now
</button>



        </div>




        <div className="modern-hero-image">

          Add Image

        </div>



      </section>





      {/* FEATURED TITLE */}

      <section className="modern-section-title">

        <h2>
          Featured Collection
        </h2>


        <p>
          Discover our latest products.
        </p>


      </section>

      {/* PRODUCTS SECTION */}

      <section className="modern-products">


        <div className="product-card">


          <div className="product-image">
            Product Image
          </div>


          <h3>
            Product Name
          </h3>


          <p>
            Beautiful product description.
          </p>


          <strong>
            $120
          </strong>


          <button
  style={{
    backgroundColor: primaryColor,
    color: "#ffffff",
    border: "none",
    padding: "12px 24px",
    borderRadius: "8px",
    cursor: "pointer"
  }}
>
  Add To Cart
</button>


        </div>





        <div className="product-card">


          <div className="product-image">
            Product Image
          </div>


          <h3>
            Product Name
          </h3>


          <p>
            Beautiful product description.
          </p>


          <strong>
            $150
          </strong>


          <button
  style={{
    backgroundColor: primaryColor,
    color: "#ffffff",
    border: "none",
    padding: "12px 24px",
    borderRadius: "8px",
    cursor: "pointer"
  }}
>
  Add To Cart
</button>



        </div>





        <div className="product-card">


          <div className="product-image">
            Product Image
          </div>


          <h3>
            Product Name
          </h3>


          <p>
            Beautiful product description.
          </p>


          <strong>
            $90
          </strong>


          <button
  style={{
    backgroundColor: primaryColor,
    color: "#ffffff",
    border: "none",
    padding: "12px 24px",
    borderRadius: "8px",
    cursor: "pointer"
  }}
>
  Add To Cart
</button>


        </div>



      </section>





      {/* CATEGORIES SECTION */}

      <section className="modern-categories">


        <h2>
          Categories
        </h2>


        <div className="category-list">


          <div>
            Category 1
          </div>


          <div>
            Category 2
          </div>


          <div>
            Category 3
          </div>


        </div>


      </section>
            {/* ABOUT SECTION */}

      <section className="modern-about">


        <div className="about-image">

          Brand Image

        </div>



        <div className="about-text">


          <h2>
            About Our Brand
          </h2>


          <p>
            We create high quality products with a modern and simple vision.
          </p>


          <button
  style={{
    backgroundColor: primaryColor,
    color: "#ffffff",
    border: "none",
    padding: "12px 24px",
    borderRadius: "8px",
    cursor: "pointer"
  }}
>
Learn More
</button>

        </div>


      </section>






      {/* BANNER SECTION */}


      <section className="modern-banner">


        <h2>
          New Collection Available
        </h2>


        <p>
          Discover our newest products today.
        </p>


        <button
  style={{
    backgroundColor: primaryColor,
    color: "#ffffff",
    border: "none",
    padding: "12px 24px",
    borderRadius: "8px",
    cursor: "pointer"
  }}
>
  Shop Collection
</button>


      </section>






      {/* GALLERY SECTION */}


      <section className="modern-gallery">


        <h2>
          Gallery
        </h2>


        <div className="gallery-grid">


          <div>
            Image 1
          </div>


          <div>
            Image 2
          </div>


          <div>
            Image 3
          </div>


          <div>
            Image 4
          </div>


        </div>


      </section>
            {/* REVIEWS SECTION */}

      <section className="modern-reviews">


        <h2>
          Customer Reviews
        </h2>



        <div className="review-cards">


          <div className="review-card">

            <p>
              Amazing quality and beautiful design.
            </p>

            <strong>
              Customer Name
            </strong>

          </div>




          <div className="review-card">

            <p>
              The experience was simple and professional.
            </p>

            <strong>
              Customer Name
            </strong>

          </div>




          <div className="review-card">

            <p>
              I love this brand and the products.
            </p>

            <strong>
              Customer Name
            </strong>

          </div>


        </div>


      </section>






      {/* NEWSLETTER SECTION */}


      <section className="modern-newsletter">


        <h2>
          Join Our Newsletter
        </h2>


        <p>
          Get updates about new products and offers.
        </p>


        <input
          placeholder="Enter your email"
        />


<button
  style={{
    backgroundColor: primaryColor,
    color: "#ffffff",
    border: "none",
    padding: "12px 24px",
    borderRadius: "8px",
    cursor: "pointer"
  }}
>
Subscribe
</button>


      </section>
            {/* CONTACT SECTION */}

      <section className="modern-contact">

        <h2>
          Contact Us
        </h2>

        <p>
          Have questions? Get in touch with us.
        </p>

        <input
          placeholder="Your Name"
        />

        <input
          placeholder="Your Email"
        />

        <textarea
          placeholder="Your Message"
        />

        <button
  style={{
    backgroundColor: primaryColor,
    color: "#ffffff",
    border: "none",
    padding: "12px 24px",
    borderRadius: "8px",
    cursor: "pointer"
  }}
>
  Send Message
</button>         


      </section>




      {/* FOOTER */}

      <footer className="modern-footer">

        <h3>
            
          Your Brand
        </h3>

        <p>
          © 2026 Your Brand. All rights reserved.
        </p>

      </footer>

          </div>

  );

}

export default ModernTemplate;
