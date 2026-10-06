import { useEffect, useMemo, useState } from "react";
import {
  Bell, Check, Download, Eye, FileText, MessageSquareReply, Pencil, Plus,
  RefreshCcw, Search, Star, UserCheck, Wrench, X,
} from "lucide-react";
import {
  auditLogs, contactMessages, facebookRequests, feedback, notifications as seedNotifications,
  payments, reports, schedules, serviceRequests, serviceTypes, stockMovements, technicians,
  websiteContent, workOrders,
} from "../../data/mockManagement";
import { getStoredNotifications, saveNotifications } from "../../utils/managementStore";
import { loadMock, saveMock, uid } from "../../utils/prototypeStore";

const money = (v) => `₱${Number(v || 0).toLocaleString("en-PH")}`;
const labels = {
  payments: "Payments", "stock-movements": "Stock Movements", "service-types": "Service Types",
  "service-requests": "Service Requests", "work-orders": "Work Orders", technicians: "Technicians",
  schedules: "Schedules", "website-content": "Website Content", feedback: "Feedback",
  "contact-messages": "Contact Messages", "facebook-requests": "Facebook Requests", reports: "Reports",
  notifications: "Notifications", "audit-logs": "Audit Logs",
};
const descriptions = {
  payments: "Verify, review, and update payment records from online and walk-in sales.",
  "stock-movements": "Record stock-in, stock-out, adjustments, and sale deductions.",
  "service-types": "Create and maintain the service catalog used by customers and staff.",
  "service-requests": "Approve requests, assign technicians, and prepare jobs for scheduling.",
  "work-orders": "Track technician jobs from assignment through completion.",
  technicians: "Manage technician availability, skills, and workload.",
  schedules: "Create and confirm technician schedules while avoiding conflicts.",
  "website-content": "Edit customer-facing section copy and publication status.",
  feedback: "Review customer ratings, comments, and follow-up status.",
  "contact-messages": "Open customer messages and mark replies/follow-ups.",
  "facebook-requests": "Track social-media inquiries and staff responses.",
  reports: "Operational summaries with export-ready mock output.",
  notifications: "Operational alerts for orders, stock, payments, services, and schedules.",
  "audit-logs": "Read-only history of important staff actions.",
};

const seedMap = {
  payments, "stock-movements": stockMovements, "service-requests": serviceRequests,
  "work-orders": workOrders, technicians, schedules, "website-content": websiteContent,
  feedback, "contact-messages": contactMessages, "facebook-requests": facebookRequests,
  "audit-logs": auditLogs,
};

function Pill({ value }) {
  const text = String(value || "");
  const lower = text.toLowerCase();
  let cls = "info";
  if (["paid","active","available","completed","published","confirmed","replied","approved","reviewed"].some(x => lower.includes(x))) cls = "success";
  if (["pending","processing","assigned","scheduled","follow","busy","partial"].some(x => lower.includes(x))) cls = "warning";
  if (["failed","inactive","off duty","rejected","refunded"].some(x => lower.includes(x))) cls = "danger";
  return <span className={`status-pill ${cls}`}>{text}</span>;
}

function ModuleHeader({ module, count, action }) {
  return <div className="mgmt-page-head"><div><h1>{labels[module]}</h1><p>{descriptions[module]}</p></div><div className="module-head-actions">{typeof count === "number" && <span className="badge badge-blue">{count} records</span>}{action}</div></div>;
}

function Dialog({ title, subtitle, onClose, children, footer }) {
  return <div className="mgmt-dialog-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <section className="mgmt-dialog module-dialog" role="dialog" aria-modal="true">
      <div className="mgmt-dialog-head"><div><span>{subtitle || "Record"}</span><h2>{title}</h2></div><button onClick={onClose} aria-label="Close"><X size={18}/></button></div>
      <div className="module-dialog-body">{children}</div>
      {footer && <div className="module-dialog-footer">{footer}</div>}
    </section>
  </div>;
}

function SearchToolbar({ search, setSearch, status, setStatus, statuses = [] }) {
  return <div className="module-toolbar">
    <label className="mgmt-search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search records..."/></label>
    {statuses.length > 0 && <select className="form-control module-filter" value={status} onChange={e => setStatus(e.target.value)}><option value="">All statuses</option>{statuses.map(s => <option key={s}>{s}</option>)}</select>}
  </div>;
}

function ServiceTypesModule() {
  const key = "av_module_service_types";
  const [items, setItems] = useState(() => loadMock(key, serviceTypes));
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const persist = next => { setItems(next); saveMock(key, next); };
  const toggle = id => persist(items.map(x => x.id === id ? { ...x, status: x.status === "Active" ? "Inactive" : "Active" } : x));
  const saveService = data => {
    const next = data.id ? items.map(x => x.id === data.id ? data : x) : [...items, { ...data, id: uid("SVT") }];
    persist(next); setEditing(null); setAdding(false);
  };
  const blank = { name:"", category:"Maintenance", basePrice:1500, duration:"1–2 hrs", status:"Active", description:"" };
  const formItem = editing || (adding ? blank : null);
  return <>
    <ModuleHeader module="service-types" count={items.length} action={<button className="btn btn-dark" onClick={() => setAdding(true)}><Plus size={16}/> Add Service Type</button>}/>
    <div className="module-card-grid service-type-grid">{items.map(service => <article className="mgmt-panel service-type-card" key={service.id}>
      <div className="service-type-top"><div className="module-icon"><Wrench size={19}/></div><Pill value={service.status}/></div>
      <span className="module-kicker">{service.category}</span><h2>{service.name}</h2><p>{service.description}</p>
      <div className="service-type-facts"><div><span>Base price</span><strong>{money(service.basePrice)}</strong></div><div><span>Duration</span><strong>{service.duration}</strong></div></div>
      <div className="module-card-actions"><button className="btn btn-soft" onClick={() => setEditing(service)}><Pencil size={15}/> Edit</button><button className="btn btn-soft" onClick={() => toggle(service.id)}>{service.status === "Active" ? "Deactivate" : "Activate"}</button></div>
    </article>)}</div>
    {formItem && <ServiceTypeForm initial={formItem} onCancel={() => { setEditing(null); setAdding(false); }} onSave={saveService}/>} 
  </>;
}

function ServiceTypeForm({ initial, onCancel, onSave }) {
  const [form, setForm] = useState(initial);
  const set = (k,v) => setForm(f => ({...f,[k]:v}));
  return <Dialog title={form.id ? `Edit ${form.name}` : "Add Service Type"} subtitle="Service Catalog" onClose={onCancel} footer={<><button className="btn btn-soft" onClick={onCancel}>Cancel</button><button className="btn btn-dark" onClick={() => onSave({...form,basePrice:Number(form.basePrice)||0})}>Save Service</button></>}>
    <div className="module-form-grid"><label>Name<input className="form-control" value={form.name} onChange={e=>set("name",e.target.value)}/></label><label>Category<input className="form-control" value={form.category} onChange={e=>set("category",e.target.value)}/></label><label>Base price<input className="form-control" type="number" value={form.basePrice} onChange={e=>set("basePrice",e.target.value)}/></label><label>Duration<input className="form-control" value={form.duration} onChange={e=>set("duration",e.target.value)}/></label><label className="full">Description<textarea className="form-control" rows="4" value={form.description} onChange={e=>set("description",e.target.value)}/></label></div>
  </Dialog>;
}

function NotificationsModule() {
  const [items, setItems] = useState(() => getStoredNotifications(seedNotifications));
  useEffect(() => { const refresh = () => setItems(getStoredNotifications(seedNotifications)); window.addEventListener("av-management-updated", refresh); return () => window.removeEventListener("av-management-updated", refresh); }, []);
  const update = next => { setItems(next); saveNotifications(next); };
  const unread = items.filter(x => !x.read).length;
  return <><ModuleHeader module="notifications" count={items.length} action={<button className="btn btn-soft" disabled={!unread} onClick={() => update(items.map(x => ({...x,read:true})))}><Check size={16}/> Mark all read</button>}/>
    <section className="mgmt-panel"><div className="mgmt-panel-header"><h2>Notification Center</h2><span className="badge badge-warning">{unread} unread</span></div><div className="notification-list">{items.map(item => <article className={`notification-item ${item.read?"read":"unread"}`} key={item.id}><div className={`notification-icon ${item.priority === "High" ? "high" : ""}`}><Bell size={17}/></div><div className="notification-copy"><div className="notification-title-row"><strong>{item.title}</strong><span>{item.type}</span></div><p>{item.message}</p><small>{item.time} · {item.priority} priority</small></div>{!item.read && <button className="notification-read" onClick={() => update(items.map(x => x.id===item.id?{...x,read:true}:x))}>Mark read</button>}</article>)}</div></section>
  </>;
}

function ReportsModule() {
  const exportCsv = () => {
    const rows = [["Report","Value","Detail","Trend"], ...reports.map(r => [r.title,r.value,r.detail,r.trend])];
    const csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], {type:"text/csv"}));
    const a = document.createElement("a"); a.href=url; a.download="av-cooling-reports.csv"; a.click(); URL.revokeObjectURL(url);
  };
  return <><ModuleHeader module="reports" count={reports.length} action={<button className="btn btn-dark" onClick={exportCsv}><Download size={16}/> Export CSV</button>}/><div className="report-example-grid">{reports.map(item => <article className="mgmt-panel report-example" key={item.id}><FileText size={20}/><span>{item.title}</span><strong>{item.value}</strong><p>{item.detail}</p><small>{item.trend}</small></article>)}</div><section className="mgmt-panel"><div className="mgmt-panel-header"><h2>Report Coverage</h2><span className="badge badge-blue">Prototype</span></div><div className="report-topic-grid"><div>Sales by date / source / payment</div><div>Best-selling products and HP</div><div>Service revenue and completion</div><div>Technician workload</div><div>Inventory movement</div><div>Customer activity</div></div></section></>;
}

const configs = {
  payments: { columns:[["id","Payment"],["order","Order"],["customer","Customer"],["method","Method"],["amount","Amount"],["status","Status"],["date","Date"]], statuses:["Paid","Partially Paid","Pending","Refunded"] },
  "stock-movements": { columns:[["id","Movement"],["product","Product"],["type","Type"],["qty","Qty"],["reference","Reference"],["user","User"],["date","Date"]], statuses:["Stock In","Stock Out","Adjustment"] },
  "service-requests": { columns:[["id","Request"],["customer","Customer"],["service","Service"],["preferred","Preferred Schedule"],["location","Location"],["technician","Technician"],["status","Status"]], statuses:["Pending Approval","Approved","Scheduled","Completed","Rejected"] },
  "work-orders": { columns:[["id","Work Order"],["customer","Customer"],["job","Job"],["technician","Technician"],["schedule","Schedule"],["status","Status"]], statuses:["Assigned","Scheduled","In Progress","Completed"] },
  technicians: { columns:[["id","ID"],["name","Technician"],["skills","Skills"],["jobsToday","Jobs Today"],["status","Status"]], statuses:["Available","Busy","Off Duty"] },
  schedules: { columns:[["id","ID"],["time","Time"],["technician","Technician"],["customer","Customer"],["service","Service"],["area","Area"],["status","Status"]], statuses:["Pending","Confirmed","Completed","Cancelled"] },
  "website-content": { columns:[["section","Section"],["content","Current Content"],["status","Status"],["updated","Last Updated"]], statuses:["Published","Draft"] },
  feedback: { columns:[["customer","Customer"],["category","Category"],["rating","Rating"],["sentiment","Sentiment"],["comment","Comment"],["date","Date"],["reviewStatus","Review"]], statuses:["New","Reviewed"] },
  "contact-messages": { columns:[["id","Message"],["name","Customer"],["subject","Subject"],["channel","Channel"],["status","Status"],["date","Date"]], statuses:["New","For Follow-up","Replied"] },
  "facebook-requests": { columns:[["id","Request"],["customer","Customer"],["category","Type"],["message","Message"],["status","Status"],["date","Date"]], statuses:["New","For Follow-up","Replied"] },
  "audit-logs": { columns:[["time","Time"],["user","User"],["module","Module"],["action","Action"],["record","Record"]] },
};

function displayValue(key, value) {
  if (key === "amount") return <strong>{money(value)}</strong>;
  if (["status","type","sentiment","reviewStatus"].includes(key)) return <Pill value={value || "New"}/>;
  if (key === "rating") return <span className="rating-cell"><Star size={14}/>{value}/5</span>;
  if (["id","name","customer","section","time"].includes(key)) return <span className="table-primary">{value}</span>;
  return value ?? "—";
}

function GenericDataModule({ module }) {
  const config = configs[module];
  const storageKey = `av_module_${module}`;
  const [items, setItems] = useState(() => loadMock(storageKey, (seedMap[module] || []).map(x => module === "feedback" ? {...x,reviewStatus:x.reviewStatus||"New"} : x)));
  const [search,setSearch]=useState(""); const [status,setStatus]=useState(""); const [selected,setSelected]=useState(null); const [adding,setAdding]=useState(false);
  const persist = next => { setItems(next); saveMock(storageKey,next); };
  const filtered = useMemo(() => items.filter(item => {
    const q=search.toLowerCase().trim(); const text=Object.values(item).join(" ").toLowerCase();
    const matchQ=!q||text.includes(q); const matchStatus=!status||String(item.status||item.type||item.reviewStatus||"")===status;
    return matchQ&&matchStatus;
  }),[items,search,status]);

  const updateItem = (id, patch) => persist(items.map(x => (x.id||x.section||x.customer) === id ? {...x,...patch}:x));
  const rowId = row => row.id || row.section || row.customer;
  const primaryAction = row => {
    if (module === "payments") updateItem(rowId(row), {status: row.status === "Paid" ? "Refunded" : "Paid"});
    if (module === "service-requests") updateItem(rowId(row), {status: row.status === "Pending Approval" ? "Approved" : row.status === "Approved" ? "Scheduled" : "Completed", technician: row.technician === "Unassigned" ? "Joel Mendoza" : row.technician});
    if (module === "work-orders") updateItem(rowId(row), {status: row.status === "Completed" ? "Completed" : row.status === "In Progress" ? "Completed" : "In Progress"});
    if (module === "technicians") updateItem(rowId(row), {status: row.status === "Available" ? "Off Duty" : "Available"});
    if (module === "schedules") updateItem(rowId(row), {status: row.status === "Confirmed" ? "Completed" : "Confirmed"});
    if (module === "website-content") updateItem(rowId(row), {status: row.status === "Published" ? "Draft" : "Published", updated:new Date().toLocaleDateString("en-PH")});
    if (module === "feedback") updateItem(rowId(row), {reviewStatus:"Reviewed"});
    if (["contact-messages","facebook-requests"].includes(module)) updateItem(rowId(row), {status:"Replied"});
  };
  const actionLabel = row => ({payments:row.status==="Paid"?"Refund":"Mark Paid","service-requests":row.status==="Pending Approval"?"Approve":row.status==="Approved"?"Schedule":"Complete","work-orders":row.status==="In Progress"?"Complete":"Start Job",technicians:row.status==="Available"?"Set Off Duty":"Set Available",schedules:row.status==="Confirmed"?"Complete":"Confirm","website-content":row.status==="Published"?"Unpublish":"Publish",feedback:"Mark Reviewed","contact-messages":"Mark Replied","facebook-requests":"Mark Replied"})[module];
  const canAdd = ["stock-movements","service-requests","work-orders","schedules"].includes(module);

  const addRecord = form => {
    let record = {...form};
    if (module === "stock-movements") record={id:uid("STM"),product:form.product||"Midea Celest Pro 1.5HP",type:form.type||"Stock In",qty:Number(form.qty||1),reference:form.reference||"MANUAL",user:"Manager",date:new Date().toLocaleString("en-PH")};
    if (module === "service-requests") record={id:uid("SR"),customer:form.customer||"Walk-in Customer",service:form.service||"Cleaning & Maintenance",preferred:form.preferred||"To schedule",location:form.location||"Calamba, Laguna",technician:"Unassigned",status:"Pending Approval"};
    if (module === "work-orders") record={id:uid("WO"),serviceRequest:form.serviceRequest||"Manual",customer:form.customer||"Walk-in Customer",job:form.job||"General Service",technician:form.technician||"Joel Mendoza",schedule:form.schedule||"To schedule",status:"Assigned"};
    if (module === "schedules") record={id:uid("SCH"),time:form.time||"9:00–11:00 AM",technician:form.technician||"Joel Mendoza",customer:form.customer||"Walk-in Customer",service:form.service||"Cleaning & Maintenance",area:form.area||"Calamba",status:"Pending"};
    persist([record,...items]); setAdding(false);
  };

  return <>
    <ModuleHeader module={module} count={items.length} action={canAdd?<button className="btn btn-dark" onClick={()=>setAdding(true)}><Plus size={16}/> Add Record</button>:null}/>
    {module !== "audit-logs" && <SearchToolbar search={search} setSearch={setSearch} status={status} setStatus={setStatus} statuses={config.statuses||[]}/>} 
    <section className="mgmt-panel"><div className="responsive-table"><table><thead><tr>{config.columns.map(([,label])=><th key={label}>{label}</th>)}<th>Actions</th></tr></thead><tbody>{filtered.map((row,i)=><tr key={rowId(row)||i}>{config.columns.map(([key,label])=><td key={key} data-label={label}>{displayValue(key,row[key])}</td>)}<td data-label="Actions"><div className="action-row"><button title="View" onClick={()=>setSelected(row)}><Eye/></button>{actionLabel(row)&&<button className="action-primary" title={actionLabel(row)} onClick={()=>primaryAction(row)}><Check/></button>}</div></td></tr>)}</tbody></table></div>{!filtered.length&&<div className="mgmt-empty">No matching records.</div>}</section>
    {selected&&<RecordDetails module={module} record={selected} onClose={()=>setSelected(null)} onSave={(patch)=>{updateItem(rowId(selected),patch);setSelected(null);}}/>}
    {adding&&<AddRecordDialog module={module} onClose={()=>setAdding(false)} onAdd={addRecord}/>} 
  </>;
}

function RecordDetails({ module, record, onClose, onSave }) {
  const editable = ["website-content"].includes(module);
  const [draft,setDraft]=useState(record);
  return <Dialog title={record.id||record.section||record.customer||labels[module]} subtitle={labels[module]} onClose={onClose} footer={<><button className="btn btn-soft" onClick={onClose}>Close</button>{editable&&<button className="btn btn-dark" onClick={()=>onSave(draft)}>Save Changes</button>}</>}>
    <div className="record-detail-list">{Object.entries(record).map(([k,v]) => <div key={k}><span>{k.replaceAll(/([A-Z])/g," $1").replaceAll("_"," ")}</span>{editable&&k==="content"?<textarea className="form-control" value={draft[k]} onChange={e=>setDraft(d=>({...d,[k]:e.target.value}))}/>:<strong>{String(v)}</strong>}</div>)}</div>
  </Dialog>;
}

function AddRecordDialog({ module, onClose, onAdd }) {
  const [form,setForm]=useState({}); const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const fields = module === "stock-movements" ? [["product","Product"],["type","Type"],["qty","Quantity"],["reference","Reference"]]
    : module === "service-requests" ? [["customer","Customer"],["service","Service"],["preferred","Preferred Schedule"],["location","Location"]]
    : module === "work-orders" ? [["customer","Customer"],["job","Job / Concern"],["technician","Technician"],["schedule","Schedule"]]
    : [["time","Time"],["technician","Technician"],["customer","Customer"],["service","Service"],["area","Area"]];
  return <Dialog title={`Add ${labels[module].replace(/s$/,'')}`} subtitle="New Record" onClose={onClose} footer={<><button className="btn btn-soft" onClick={onClose}>Cancel</button><button className="btn btn-dark" onClick={()=>onAdd(form)}>Save Record</button></>}><div className="module-form-grid">{fields.map(([k,l])=><label key={k}>{l}<input className="form-control" type={k==="qty"?"number":"text"} value={form[k]||""} onChange={e=>set(k,e.target.value)}/></label>)}</div></Dialog>;
}

export default function ManagementModulePage({ module }) {
  if (module === "service-types") return <ServiceTypesModule/>;
  if (module === "notifications") return <NotificationsModule/>;
  if (module === "reports") return <ReportsModule/>;
  return <GenericDataModule module={module}/>;
}
