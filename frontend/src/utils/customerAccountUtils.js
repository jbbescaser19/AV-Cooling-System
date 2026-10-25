export const formatCustomerMoney = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH")}`;
