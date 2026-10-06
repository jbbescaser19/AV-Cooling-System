import { useMemo, useState } from "react";
import { Eye, Pencil, Plus, Search, X } from "lucide-react";
import { products as seedProducts } from "../../data/products";
import { loadMock, saveMock, uid } from "../../utils/prototypeStore";

const KEY="av_managed_products";
const peso=v=>`₱${Number(v||0).toLocaleString("en-PH")}`;
const startingPrice=p=>p.quotationOnly||!p.variants?.length?"Quotation":peso(Math.min(...p.variants.map(v=>v.price)));

export default function ProductsPage(){
  const [items,setItems]=useState(()=>loadMock(KEY,seedProducts));
  const [search,setSearch]=useState(""); const [selected,setSelected]=useState(null); const [editing,setEditing]=useState(null); const [adding,setAdding]=useState(false);
  const persist=next=>{setItems(next);saveMock(KEY,next)};
  const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return !q?items:items.filter(p=>`${p.brand} ${p.name} ${p.category} ${p.variants?.map(v=>v.hp).join(" ")}`.toLowerCase().includes(q))},[items,search]);
  const saveProduct=form=>{
    const variants=String(form.variantsText||"").split(",").map(x=>x.trim()).filter(Boolean).map((hp,i)=>({hp,srp:Number(form.srp)||30000+i*1000,price:Number(form.price)||25000+i*1000}));
    const clean={...form,quotationOnly:form.quotationOnly||false,variants:form.quotationOnly?[]:variants.length?variants:(form.variants||[])}; delete clean.variantsText;
    if(clean.id) persist(items.map(x=>x.id===clean.id?clean:x)); else persist([{...clean,id:uid("product").toLowerCase()},...items]);
    setEditing(null);setAdding(false);
  };
  return <>
    <div className="mgmt-page-head"><div><h1>Products</h1><p>Create, view, and edit product families and HP variants used by the catalog.</p></div><button className="btn btn-dark" onClick={()=>setAdding(true)}><Plus size={17}/> Add Product</button></div>
    <div className="module-toolbar"><label className="mgmt-search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search brand, product, HP..."/></label></div>
    <section className="mgmt-panel"><div className="responsive-table"><table><thead><tr><th>Brand</th><th>Product</th><th>Category</th><th>Variants</th><th>Starting Price</th><th>Actions</th></tr></thead><tbody>{filtered.map(product=><tr key={product.id}><td data-label="Brand">{product.brand}</td><td data-label="Product"><span className="table-primary">{product.name}</span></td><td data-label="Category">{product.category}</td><td data-label="Variants">{product.variants?.length?product.variants.map(v=>v.hp).join(", "):"Commercial quotation"}</td><td data-label="Starting Price"><strong>{startingPrice(product)}</strong></td><td data-label="Actions"><div className="action-row"><button onClick={()=>setSelected(product)} title="View"><Eye/></button><button onClick={()=>setEditing(product)} title="Edit"><Pencil/></button></div></td></tr>)}</tbody></table></div></section>
    {selected&&<ProductView product={selected} onClose={()=>setSelected(null)}/>} 
    {(editing||adding)&&<ProductForm initial={editing||{brand:"Midea",name:"",category:"Split Type Inverter",tagline:"Cooling Solution",variants:[],quotationOnly:false}} onClose={()=>{setEditing(null);setAdding(false)}} onSave={saveProduct}/>} 
  </>;
}

function ProductView({product,onClose}){return <div className="mgmt-dialog-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="mgmt-dialog"><div className="mgmt-dialog-head"><div><span>Product Details</span><h2>{product.name}</h2></div><button onClick={onClose}><X size={18}/></button></div><div className="record-detail-list"><div><span>Brand</span><strong>{product.brand}</strong></div><div><span>Category</span><strong>{product.category}</strong></div><div><span>Tagline</span><strong>{product.tagline}</strong></div><div><span>Variants</span><strong>{product.variants?.length?product.variants.map(v=>`${v.hp} · ${peso(v.price)}`).join(" | "):"Quotation only"}</strong></div><div><span>Warranty</span><strong>{product.warranty?.join(" · ")||"Set during quotation"}</strong></div></div></section></div>}

function ProductForm({initial,onClose,onSave}){const [f,setF]=useState({...initial,variantsText:initial.variants?.map(v=>v.hp).join(", ")||""});const set=(k,v)=>setF(x=>({...x,[k]:v}));return <div className="mgmt-dialog-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="mgmt-dialog module-dialog"><div className="mgmt-dialog-head"><div><span>Catalog</span><h2>{f.id?"Edit Product":"Add Product"}</h2></div><button onClick={onClose}><X size={18}/></button></div><div className="module-dialog-body"><div className="module-form-grid"><label>Brand<input className="form-control" value={f.brand} onChange={e=>set("brand",e.target.value)}/></label><label>Product Name<input className="form-control" value={f.name} onChange={e=>set("name",e.target.value)}/></label><label>Category<input className="form-control" value={f.category} onChange={e=>set("category",e.target.value)}/></label><label>Tagline<input className="form-control" value={f.tagline||""} onChange={e=>set("tagline",e.target.value)}/></label><label className="full">HP variants (comma separated)<input className="form-control" value={f.variantsText} onChange={e=>set("variantsText",e.target.value)} placeholder="1.0HP, 1.5HP, 2.0HP"/></label><label>Default SRP<input className="form-control" type="number" value={f.srp||""} onChange={e=>set("srp",e.target.value)}/></label><label>Default Promo Price<input className="form-control" type="number" value={f.price||""} onChange={e=>set("price",e.target.value)}/></label><label className="module-check"><input type="checkbox" checked={!!f.quotationOnly} onChange={e=>set("quotationOnly",e.target.checked)}/> Quotation-only product</label></div></div><div className="module-dialog-footer"><button className="btn btn-soft" onClick={onClose}>Cancel</button><button className="btn btn-dark" onClick={()=>onSave(f)}>Save Product</button></div></section></div>}
