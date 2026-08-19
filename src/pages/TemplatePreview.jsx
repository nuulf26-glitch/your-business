import { useParams } from "react-router-dom";

import RestaurantTemplate from "../templates/RestaurantTemplate";
import StartupTemplate from "../templates/StartupTemplate";
import RealEstateTemplate from "../templates/RealEstateTemplate";
import BeautyTemplate from "../templates/BeautyTemplate";
import FashionTemplate from "../templates/FashionTemplate";
import PortfolioTemplate from "../templates/PortfolioTemplate";
import FitnessTemplate from "../templates/FitnessTemplate";
import CoffeeTemplate from "../templates/CoffeeTemplate";
import ModernTemplate from "../templates/ModernTemplate";

function TemplatePreview() {


  
  const { id } = useParams();

  const templates = {
    modern: ModernTemplate,
    restaurant: RestaurantTemplate,
    startup: StartupTemplate,
    realestate: RealEstateTemplate,
    beauty: BeautyTemplate,
    fashion: FashionTemplate,
    portfolio: PortfolioTemplate,
    fitness: FitnessTemplate,
    coffee: CoffeeTemplate,
  };


  const SelectedTemplate = templates[id];


  if (!SelectedTemplate) {
    return <h1>Template not found</h1>;
  }


  return (
    <SelectedTemplate />
  );

}

export default TemplatePreview;