import { useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import "../styles/websiteEditor.css";

export default function WebsiteEditor() {

  // Tablet mode
const [device, setDevice] = useState("desktop");

  // Website Data
  const [brandName, setBrandName] = useState("My Brand");

  const [headline, setHeadline] = useState(
    "Create your dream website"
  );

  const [description, setDescription] = useState(
    "Build your online business easily without coding."
  );


  // Colors
  const [primaryColor, setPrimaryColor] = useState("#111827");

  const [backgroundColor, setBackgroundColor] = useState("#ffffff");


  // Button
  const [buttonText, setButtonText] = useState(
    "Get Started"
  );


  // Load saved data
  useEffect(() => {

    const saved =
      localStorage.getItem("websiteEditorData");

    if(saved){

      const data = JSON.parse(saved);

      setBrandName(data.brandName || "My Brand");
      setHeadline(data.headline || "");
      setDescription(data.description || "");
      setPrimaryColor(data.primaryColor || "#111827");
      setBackgroundColor(
        data.backgroundColor || "#ffffff"
      );
      setButtonText(
        data.buttonText || "Get Started"
      );

    }

  },[]);



  // Save
  const saveWebsite = ()=>{

    const data = {

      brandName,
      headline,
      description,
      primaryColor,
      backgroundColor,
      buttonText

    };


    localStorage.setItem(
      "websiteEditorData",
      JSON.stringify(data)
    );


    alert("Website Saved!");

  };



  const publishWebsite = async ()=>{

  const websiteData = {
    brandName,
    headline,
    description,
    primaryColor,
    backgroundColor,
    buttonText,
    published: true,
    createdAt: new Date()
  };


  await setDoc(
    doc(db, "websites", brandName.toLowerCase().replace(/\s+/g, "-")),
    websiteData
  );

localStorage.setItem("websitePublished", "true");

  alert("Website Published!");
localStorage.setItem("websitePublished", "true");
};


return (

<div className="editor-container">


{/* LEFT SETTINGS */}

<div className="editor-sidebar">


<h2>
Website Editor
</h2>



<div className="device-buttons">


<button
className={device==="desktop"?"active":""}
onClick={()=>setDevice("desktop")}
>
Desktop
</button>


<button
className={device==="tablet"?"active":""}
onClick={()=>setDevice("tablet")}
>
Tablet
</button>



<button
className={device==="mobile"?"active":""}
onClick={()=>setDevice("mobile")}
>
Mobile
</button>


</div>




<label>
Brand Name
</label>

<input
value={brandName}
onChange={(e)=>
setBrandName(e.target.value)
}
/>



<label>
Headline
</label>

<input
value={headline}
onChange={(e)=>
setHeadline(e.target.value)
}
/>



<label>
Description
</label>


<textarea

value={description}

onChange={(e)=>
setDescription(e.target.value)
}

/>



<label>
Button Text
</label>


<input

value={buttonText}

onChange={(e)=>
setButtonText(e.target.value)
}

/>



<h3>
Primary Color
</h3>


<HexColorPicker

color={primaryColor}

onChange={setPrimaryColor}

/>



<h3>
Background Color
</h3>


<HexColorPicker

color={backgroundColor}

onChange={setBackgroundColor}

/>




<button
onClick={saveWebsite}
>
Save
</button>


<button
onClick={publishWebsite}
>
Publish
</button>



</div>





{/* PREVIEW */}

<div className="preview-area">


<div

className={`preview ${device}`}

style={{
backgroundColor
}}

>


<h1
style={{
color:primaryColor
}}
>

{brandName}

</h1>



<h2>

{headline}

</h2>



<p>

{description}

</p>



<button

style={{
backgroundColor:primaryColor
}}

>

{buttonText}

</button>



</div>


</div>



</div>

);

}