import { useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { getStore, saveStore } from "../services/storeService";
import "../styles/websiteEditor.css";
import { templateData } from "../data/templateData";
import ModernTemplate from "../templates/ModernTemplate";
import DarkTemplate from "../templates/DarkTemplate";
import { uploadProductImage } from "../services/imageService";
const editorTemplates = [
  {
    id: "modern",
    name: "Modern Style",
    elements:[
      {
        id:1,
        type:"heading",
        content:"Build Your Brand Online",
        x:120,
        y:80,
        style:{
          fontFamily:"Poppins",
          fontSize:42,
          color:"#111111",
          fontWeight:"700"
        }
      },

      {
        id:2,
        type:"text",
        content:"Create a beautiful website without coding.",
        x:120,
        y:170,
        style:{
          fontFamily:"Arial",
          fontSize:18,
          color:"#444444",
          fontWeight:"400"
        }
      },

      {
        id:3,
        type:"button",
        content:"Shop Now",
        x:120,
        y:250,
        style:{
          fontFamily:"Poppins",
          fontSize:16,
          color:"#ffffff",
          fontWeight:"600"
        }
      }
    ],

    background:"#ffffff",
    color:"#111111"
  },


  {
    id:"dark",
    name:"Luxury Dark",

    elements:[
      {
        id:1,
        type:"heading",
        content:"Luxury Fashion Brand",
        x:120,
        y:80,
        style:{
          fontFamily:"Montserrat",
          fontSize:42,
          color:"#ffffff",
          fontWeight:"700"
        }
      },

      {
        id:2,
        type:"text",
        content:"Premium designs made for your customers.",
        x:120,
        y:170,
        style:{
          fontFamily:"Arial",
          fontSize:18,
          color:"#dddddd",
          fontWeight:"400"
        }
      },

      {
        id:3,
        type:"button",
        content:"Explore Collection",
        x:120,
        y:250,
        style:{
          fontFamily:"Montserrat",
          fontSize:16,
          color:"#ffffff",
          fontWeight:"600"
        }
      }
    ],

    background:"#111111",
    color:"#ffffff"
  }
];
const fonts = [
  "Arial",
  "Helvetica",
  "Georgia",
  "Times New Roman",
  "Verdana",
  "Poppins",
  "Montserrat",
  "Roboto",
  "Open Sans",
  "Lato"
];
const selectedTemplateId =
  localStorage.getItem("selectedTemplate") || "modern";


export default function WebsiteEditor(){
  const [selectedTemplate, setSelectedTemplate] = useState(
  localStorage.getItem("selectedTemplate") || "modern"
);

const [device,setDevice] = useState("laptop");

const [elements,setElements] = useState([
{
id:1,
type:"heading",
content:"Create Your Dream Website",
x:120,
y:80,
style:{
fontFamily:"Poppins",
fontSize:42,
color:"#111111",
fontWeight:"700"
}
},

{
id:2,
type:"text",
content:"Build your online business easily without coding.",
x:120,
y:170,
style:{
fontFamily:"Arial",
fontSize:18,
color:"#444444",
fontWeight:"400"
}
},

{
id:3,
type:"button",
content:"Get Started",
x:120,
y:250,
style:{
fontFamily:"Poppins",
fontSize:16,
color:"#ffffff",
fontWeight:"600"
}
},

{
id:4,
type:"image",
content:"",
image:null,
x:650,
y:100,
style:{
fontFamily:"Arial",
fontSize:20,
color:"#111111",
fontWeight:"400"
}
}

]);


const [selected,setSelected] = useState(null);

const [brandName,setBrandName] = useState("My Brand");

const [primaryColor,setPrimaryColor] = useState("#111111");

const [backgroundColor,setBackgroundColor] = useState("#ffffff");


const [chatEmail,setChatEmail] = useState("");




useEffect(()=>{

const template =
editorTemplates.find(
(t)=>t.id === selectedTemplate
);


if(template){

setElements(template.elements);

setPrimaryColor(template.color);

setBackgroundColor(template.background);

}


},[selectedTemplate]);








const addElement=(type)=>{


const newElement={

id:Date.now(),

type,

x:100,

y:100,


content:
type==="text"
?
"Write your text"
:
type==="heading"
?
"New Heading"
:
type==="button"
?
"Button"
:
type==="product"
?
"Product Name"
:
"",


image:null,


style:{

fontFamily:"Arial",

fontSize:30,

color:"#111111",

fontWeight:"400"

},


product:{

price:"",
description:"",
image:null

}


};


setElements([
...elements,
newElement
]);


setSelected(newElement.id);


};
const updateElement = (id, changes)=>{

setElements(

elements.map(el=>

el.id===id

?

{

...el,

...changes

}

:

el

)

);

};





const updateStyle=(id, styleChanges)=>{


setElements(

elements.map(el=>


el.id===id

?

{

...el,

style:{

...el.style,

...styleChanges

}

}

:

el


)

);


};





const uploadImage = async (id, file) => {

  try {

    const imageURL = await uploadProductImage(file);

    setElements(
      elements.map(el =>
        el.id === id
          ? {
              ...el,
              image: imageURL
            }
          : el
      )
    );

  } catch (error) {

    console.error("Image upload failed:", error);

    alert("Image upload failed");

  }

};




const saveWebsite=()=>{


const data={

brandName,

elements,

chatEmail,

primaryColor,

backgroundColor

};


localStorage.setItem(

"websiteEditorData",

JSON.stringify(data)

);


alert("Saved");

};






const publishWebsite = async () => {
  try {
    const existingStore = await getStore();
    await saveStore({
      ...existingStore,
      brandName,
      elements,
      chatEmail,
      primaryColor,
      backgroundColor,
      published: true,
    });
    alert("Website Published Successfully");
  } catch (error) {

console.error("Publish error:", error.message, error);

alert(error.message);

  }

};





const startDrag=(e,id)=>{


const element =
elements.find(
el=>el.id===id
);



const offsetX =
e.clientX - element.x;



const offsetY =
e.clientY - element.y;



const move=(event)=>{


updateElement(

id,

{

x:event.clientX-offsetX,

y:event.clientY-offsetY

}


);


};



const stop=()=>{

document.removeEventListener(
"mousemove",
move
);


};



document.addEventListener(
"mousemove",
move
);



document.addEventListener(
"mouseup",
stop,
{
once:true
}

);


};
return (


<div className="editor-container">


{/* TOP BAR */}

<div className="editor-topbar">


<h2>
Website Editor
</h2>



<div className="device-buttons">


<button

className={device==="laptop"?"active":""}

onClick={()=>setDevice("laptop")}

>
Laptop
</button>


<button

className={device==="ipad"?"active":""}

onClick={()=>setDevice("ipad")}

>
iPad
</button>



<button

className={device==="phone"?"active":""}

onClick={()=>setDevice("phone")}

>
Phone
</button>


</div>



<div className="editor-actions">


<button
className="save-btn"
onClick={saveWebsite}
>
Save Draft
</button>



<button
className="publish-btn"
onClick={publishWebsite}
>
Publish Website
</button>


</div>


</div>






<div className="editor-body">





{/* LEFT SIDE */}


<div className="editor-sidebar">


<h3>
Add
</h3>


<button
onClick={()=>addElement("heading")}
>
+ Heading
</button>


<button
onClick={()=>addElement("text")}
>
+ Text
</button>



<button
onClick={()=>addElement("button")}
>
+ Button
</button>



<button
onClick={()=>addElement("image")}
>
+ Photo
</button>



<button
onClick={()=>addElement("product")}
>
+ Product
</button>



<button
onClick={()=>addElement("chat")}
>
+ Chat
</button>





<h3>
Brand
</h3>


<input

value={brandName}

onChange={
e=>setBrandName(e.target.value)
}

/>



<h3>
Colors
</h3>



<HexColorPicker

color={primaryColor}

onChange={setPrimaryColor}

/>



<HexColorPicker

color={backgroundColor}

onChange={setBackgroundColor}

/>




</div>


{/* WEBSITE PREVIEW */}

<div className="preview-area">






<div

className={`preview ${device}`}

style={{

backgroundColor

}}

>

{selectedTemplate === "modern" && (
  <ModernTemplate
  primaryColor={primaryColor}
  backgroundColor={backgroundColor}
/>

)}

{selectedTemplate === "dark" && (
  <DarkTemplate
  primaryColor={primaryColor}
  backgroundColor={backgroundColor}
/>

)}



{elements.map(element=>
<div
key={element.id}
onMouseDown={(e)=>
startDrag(
e,
element.id
)
}
onClick={()=>
setSelected(element.id)
}
style={{
position:"absolute",
left:element.x,
top:element.y
}}
>
{
element.type==="heading"
&&
<h1
style={{
fontFamily: element.style.fontFamily,
fontSize: element.style.fontSize,
color: element.style.color,
fontWeight: element.style.fontWeight,
margin: 0
}}
>
{element.content}
</h1>
}
{
element.type==="text"
&&
<p
style={{
fontFamily: element.style.fontFamily,
fontSize: element.style.fontSize,
color: element.style.color,
fontWeight: element.style.fontWeight,
margin: 0
}}
>
{element.content}
</p>
}


{
element.type==="button"

&&

<button
style={{
backgroundColor:primaryColor,
color:"white"
}}
>
{element.content}
</button>

}

{
element.type==="image"

&&

<div>

{

element.image

?

<img

src={element.image}

style={{

width:"200px",

borderRadius:"12px"

}}

/>

:

<label

style={{

display:"block",

padding:"20px",

background:"#eee",

cursor:"pointer"

}}

>

Upload Photo


<input

type="file"

hidden

accept="image/*"

onChange={(e)=>

uploadImage(

element.id,

e.target.files[0]

)

}


/>


</label>

}

</div>

}





{
element.type==="product"

&&

<div

className="product-card"

>


{

element.product.image

&&

<img

src={element.product.image}

style={{

width:"150px"

}}

/>

}



<h3>

{element.content}

</h3>


<p>

{element.product.description}

</p>


<h4>

{element.product.price}

</h4>



<button>

Add To Cart

</button>


</div>

}


{
element.type==="navbar"

&&

<div className="navbar-section">

<h3>
{element.content}
</h3>

<div>
{
element.menu?.map(item=>

<span
key={item}
style={{
marginLeft:"20px"
}}
>
{item}
</span>

)
}
</div>

</div>

}



{
element.type==="section"

&&

<h2>

{element.content}

</h2>

}



{
element.type==="review"

&&

<div className="review-box">

<p>
{element.content}
</p>

</div>

}



{
element.type==="footer"

&&

<div className="footer-section">

{element.content}

</div>

}


{
element.type==="chat"

&&

<div

className="chat-box"

>

Chat

</div>

}



</div>


)}



</div>


</div>





{/* RIGHT SETTINGS */}



<div className="element-settings">


{

selected &&

(() => {


const element =
elements.find(
el=>el.id===selected
);



if(!element)
return null;



return (


<>


<h3>
Edit
</h3>



<label>
Text
</label>


<input

value={element.content}

onChange={(e)=>

updateElement(

element.id,

{

content:e.target.value

}

)

}


/>



<label>
Font
</label>


<select

value={element.style.fontFamily}

onChange={(e)=>

updateStyle(

element.id,

{

fontFamily:e.target.value

}

)

}

>

{

fonts.map(font=>

<option

key={font}

>

{font}

</option>

)

}

</select>




<label>
Font Size
</label>


<input

type="number"

value={element.style.fontSize}

onChange={(e)=>

updateStyle(

element.id,

{

fontSize:
Number(e.target.value)

}

)

}


/>




<label>
Font Color
</label>


<input

type="color"

value={element.style.color}

onChange={(e)=>

updateStyle(

element.id,

{

color:e.target.value

}

)

}


/>



{
element.type==="chat"

&&

<>


<label>
Business Email
</label>


<input

value={chatEmail}

onChange={(e)=>

setChatEmail(e.target.value)

}


/>


</>

}



{
element.type==="product"

&&

<>


<label>
Product Price
</label>


<input

value={element.product.price}

onChange={(e)=>


updateElement(

element.id,

{

product:{

...element.product,

price:e.target.value

}

}

)


}


/>



<label>
Product Description
</label>


<textarea

value={element.product.description}

onChange={(e)=>


updateElement(

element.id,

{

product:{

...element.product,

description:e.target.value

}

}

)


}


/>


</>

}



<button

onClick={()=>{


setElements(

elements.filter(

el=>el.id!==element.id

)

);


setSelected(null);


}}

>

Delete

</button>



</>

)


})()

}

</div>

</div>

</div>

);



}