import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingCart, Package, CalendarDays, Users, Bell, Banknote } from "lucide-react";
import { orders as seedOrders, notifications as seedNotifications, serviceRequests as seedServices, customers as seedCustomers } from "../../data/mockManagement";
import { getPosOrders, getStoredNotifications } from "../../utils/managementStore";
import { loadMock } from "../../utils/prototypeStore";

const money = (v) => `₱${Number(v || 0).toLocaleString("en-PH")}`;
const statusClass=s=>{const v=String(s||"").toLowerCase();if(v.includes("complete")||v.includes("delivered")||v.includes("paid"))return"success";if(v.includes("pending")||v.includes("processing"))return"warning";return"info"};

export default function DashboardPage(){
 const nav=useNavigate();
 const [tick,setTick]=useState(0); const [posOrders,setPosOrders]=useState(()=>getPosOrders()); const [notifications,setNotifications]=useState(()=>getStoredNotifications(seedNotifications));
 useEffect(()=>{const refresh=()=>{setPosOrders(getPosOrders());setNotifications(getStoredNotifications(seedNotifications));setTick(x=>x+1)};window.addEventListener("av-management-updated",refresh);window.addEventListener("storage",refresh);return()=>{window.removeEventListener("av-management-updated",refresh);window.removeEventListener("storage",refresh)}},[]);
 const managedOrders=loadMock("av_managed_orders",seedOrders); const allOrders=useMemo(()=>[...posOrders,...managedOrders],[posOrders,managedOrders,tick]);
 const services=loadMock("av_module_service-requests",seedServices); const stock=loadMock("av_inventory_stock",{}); const lowStock=Object.keys(stock).length?Object.values(stock).filter(v=>Number(v)<=2).length:5; const customers=loadMock("av_customers",seedCustomers);
 const walkInSales=posOrders.reduce((s,o)=>s+Number(o.total||0),0); const unread=notifications.filter(x=>!x.read).length;
 const stats=[
  [ShoppingCart,"Orders",String(allOrders.length),"/management/orders"],
  [Banknote,"Walk-in POS Sales",money(walkInSales),"/management/pos"],
  [Package,"Low Stock",String(lowStock),"/management/inventory"],
  [CalendarDays,"Pending Services",String(services.filter(x=>!String(x.status).includes("Completed")&&!String(x.status).includes("Rejected")).length),"/management/service-requests"],
  [Users,"Customers",String(customers.length),"/management/customers"],
  [Bell,"Unread Alerts",String(unread),"/management/notifications"],
 ];
 return <><div className="mgmt-page-head"><div><h1>Dashboard</h1><p>Live prototype overview connected to POS, orders, service requests, inventory, customers, and notifications.</p></div></div><div className="metric-grid metric-grid-six">{stats.map(([Icon,label,value,path])=><button type="button" className="metric-card metric-card-button" key={label} onClick={()=>nav(path)}><Icon/><span>{label}</span><b>{value}</b></button>)}</div><div className="dashboard-panels"><section className="mgmt-panel"><div className="mgmt-panel-header"><h2>Recent Orders</h2><button className="text-action" onClick={()=>nav("/management/orders")}>View all</button></div><div className="responsive-table"><table><thead><tr><th>Order</th><th>Customer</th><th>Source</th><th>Status</th><th>Total</th></tr></thead><tbody>{allOrders.slice(0,6).map(o=><tr key={o.id}><td data-label="Order"><span className="table-primary">{o.id}</span></td><td data-label="Customer">{o.customer}</td><td data-label="Source">{o.source||"Online"}</td><td data-label="Status"><span className={`status-pill ${statusClass(o.status)}`}>{o.status}</span></td><td data-label="Total"><strong>{money(o.total)}</strong></td></tr>)}</tbody></table></div></section><section className="mgmt-panel dashboard-alert-panel"><div className="mgmt-panel-header"><h2>Needs Attention</h2><button className="text-action" onClick={()=>nav("/management/notifications")}>{unread} unread</button></div><div className="dashboard-alert-list">{notifications.filter(x=>!x.read).slice(0,5).map(x=><article key={x.id}><div className={`alert-dot ${x.priority==="High"?"high":""}`}/><div><strong>{x.title}</strong><p>{x.message}</p><small>{x.time}</small></div></article>)}</div></section></div></>
}
