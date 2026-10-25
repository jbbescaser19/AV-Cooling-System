export default function CustomerPageHeader({ Icon, title, copy }) {
  return (
    <div className="customer-module-head">
      <Icon />

      <div>
        <span>My Account</span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
    </div>
  );
}
