import { NavLink,Link } from "react-router-dom";
import { LayoutDashboard,ShoppingCart,ClipboardList,CreditCard,Package,Boxes,ArrowLeftRight,Wrench,ClipboardCheck,BriefcaseBusiness,Users,CalendarDays,Image,PanelsTopLeft,MessageSquare,MessagesSquare,Globe2,FileText,Bell,ScrollText,Snowflake,X } from "lucide-react";
import { getStaff } from "../../utils/authMock";
import "../../styles/management/sidebar.css";
const groups=[
  ["",[["dashboard",LayoutDashboard,"Dashboard",["OWNER","MANAGER","SALES_CASHIER","TECHNICIAN"]]]],
  ["Sales",[["pos",ShoppingCart,"POS / Walk-in",["OWNER","MANAGER","SALES_CASHIER"]],["orders",ClipboardList,"Orders",["OWNER","MANAGER","SALES_CASHIER"]],["payments",CreditCard,"Payments",["OWNER","MANAGER","SALES_CASHIER"]]]],
  ["Catalog",[["products",Package,"Products",["OWNER","MANAGER","SALES_CASHIER"]],["inventory",Boxes,"Inventory",["OWNER","MANAGER"]],["stock-movements",ArrowLeftRight,"Stock Movements",["OWNER","MANAGER"]]]],
  ["Services",[["service-types",Wrench,"Service Types",["OWNER","MANAGER"]],["service-requests",ClipboardCheck,"Service Requests",["OWNER","MANAGER","TECHNICIAN"]],["work-orders",BriefcaseBusiness,"Work Orders",["OWNER","MANAGER","TECHNICIAN"]],["technicians",Users,"Technicians",["OWNER","MANAGER"]],["schedules",CalendarDays,"Schedules",["OWNER","MANAGER","TECHNICIAN"]]]],
  ["Customers",[["customers",Users,"Customers",["OWNER","MANAGER","SALES_CASHIER"]]]],
  ["Website",[["promos",Image,"Promos",["OWNER","MANAGER"]],["website-content",PanelsTopLeft,"Website Content",["OWNER","MANAGER"]],["feedback",MessageSquare,"Feedback",["OWNER","MANAGER"]],["contact-messages",MessagesSquare,"Contact Messages",["OWNER","MANAGER","SALES_CASHIER"]]]],
  ["Operations",[["facebook-requests",Globe2,"Facebook Requests",["OWNER","MANAGER","SALES_CASHIER"]],["reports",FileText,"Reports",["OWNER","MANAGER"]],["notifications",Bell,"Notifications",["OWNER","MANAGER","SALES_CASHIER","TECHNICIAN"]],["audit-logs",ScrollText,"Audit Logs",["OWNER"]]]],
];
export default function Sidebar({open,onClose}){const role=getStaff()?.role||"OWNER";return <aside className={`mgmt-sidebar ${open?"open":""}`}><div className="mgmt-brand"><Link to="/management/dashboard"><Snowflake/>AV Cooling</Link><button onClick={onClose}><X/></button></div><div className="side-scroll">{groups.map(([g,items],i)=>{const allowed=items.filter(([, , ,roles])=>roles.includes(role));if(!allowed.length)return null;return <div className="side-group" key={i}>{g&&<div className="side-label">{g}</div>}{allowed.map(([p,I,t])=><NavLink key={p} to={`/management/${p}`} onClick={onClose}><I size={17}/><span>{t}</span></NavLink>)}</div>})}</div></aside>}
