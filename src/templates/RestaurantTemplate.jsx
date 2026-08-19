function RestaurantTemplate() {

  return (

    <div className="restaurant-template">


      {/* NAVBAR */}

      <nav className="template-navbar">

        <h2>
          Your Restaurant
        </h2>


        <div>

          <span>
            Home
          </span>

          <span>
            Menu
          </span>

          <span>
            About
          </span>

          <span>
            Contact
          </span>

        </div>


      </nav>




      {/* HERO */}

      <section className="template-hero">


        <div>


          <h1>
            Fresh Food Made With Love
          </h1>


          <p>
            Experience delicious meals prepared with fresh ingredients.
          </p>


          <button>
            View Menu
          </button>


        </div>



        <div className="template-image">

          Image

        </div>



      </section>






      {/* PRODUCTS */}


      <section className="template-products">


        <h2>
          Our Special Menu
        </h2>



        <div className="product-grid">


          <div className="product-card">


            <div className="product-image">
              Image
            </div>


            <h3>
              Signature Dish
            </h3>


            <p>
              Delicious restaurant meal.
            </p>


            <strong>
              $25
            </strong>


          </div>




          <div className="product-card">


            <div className="product-image">
              Image
            </div>


            <h3>
              Special Meal
            </h3>


            <p>
              Fresh ingredients and amazing taste.
            </p>


            <strong>
              $30
            </strong>


          </div>



        </div>


      </section>






      {/* ABOUT */}


      <section className="template-about">


        <h2>
          About Us
        </h2>


        <p>
          We create unforgettable dining experiences for our customers.
        </p>


      </section>






      {/* REVIEWS */}


      <section className="template-reviews">


        <h2>
          Customer Reviews
        </h2>


        <div className="review-box">

          "Amazing food and great service."

        </div>


      </section>







      {/* CONTACT */}


      <section className="template-contact">


        <h2>
          Contact Us
        </h2>


        <p>
          Email: info@restaurant.com
        </p>


      </section>






      {/* FOOTER */}


      <footer className="template-footer">


        © 2026 Your Restaurant


      </footer>



    </div>

  );

}



export default RestaurantTemplate;