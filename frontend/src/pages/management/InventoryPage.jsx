import { useMemo, useState } from "react";
import { Minus, Plus, Search } from "lucide-react";
import { products } from "../../data/products";
import { loadMock, saveMock } from "../../utils/prototypeStore";

const KEY="av_inventory_stock";
const makeRows=()=>products.flatMap(product=>(product.variants||[]).map(variant=>({key:`${product.id}:${variant.hp}`,product:product.name,brand:product.brand,hp:variant.hp,model:variant.model||"—"})));
export default function InventoryPage(){
 const rows=useMemo(makeRows,[]); const [stock,setStock]=useState(()=>{const defaults=Object.fromEntries(rows.map((r,i)=>[r.key,i%7===0?2:8+(i%5)]));return {...defaults,...loadMock(KEY,{})}}); const [search,setSearch]=useState("");
 const change=(key,delta)=>{const next={...stock,[key]:Math.max(0,Number(stock[key]||0)+delta)};setStock(next);saveMock(KEY,next)};
 const filtered=rows.filter(r=>`${r.brand} ${r.product} ${r.hp}`.toLowerCase().includes(search.toLowerCase()));
 return <><div className="mgmt-page-head"><div><h1>Inventory</h1><p>Track stock by product and HP variant. Adjustments persist in this browser prototype.</p></div></div><div className="module-toolbar"><label className="mgmt-search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search inventory..."/></label></div><section className="mgmt-panel"><div className="responsive-table"><table><thead><tr><th>Brand</th><th>Product</th><th>HP</th><th>Stock</th><th>Level</th><th>Adjust</th></tr></thead><tbody>{filtered.map(row=>{const qty=Number(stock[row.key]||0);return <tr key={row.key}><td data-label="Brand">{row.brand}</td><td data-label="Product"><span className="table-primary">{row.product}</span></td><td data-label="HP">{row.hp}</td><td data-label="Stock"><strong>{qty}</strong></td><td data-label="Level"><span className={`status-pill ${qty<=2?"danger":qty<=5?"warning":"success"}`}>{qty<=2?"Low Stock":qty<=5?"Reorder Soon":"Healthy"}</span></td><td data-label="Adjust"><div className="inventory-stepper"><button onClick={()=>change(row.key,-1)}><Minus size={15}/></button><span>{qty}</span><button onClick={()=>change(row.key,1)}><Plus size={15}/></button></div></td></tr>})}</tbody></table></div></section></>
}
