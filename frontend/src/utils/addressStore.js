import { loadMock, saveMock, uid } from "./prototypeStore";

const ADDRESS_KEY = "av_customer_addresses";

export const MAX_SAVED_ADDRESSES = 3;

function normalizeAddresses(items) {
  const addresses = Array.isArray(items)
    ? items.slice(0, MAX_SAVED_ADDRESSES)
    : [];

  if (addresses.length > 0 && !addresses.some((item) => item.default)) {
    addresses[0] = {
      ...addresses[0],
      default: true,
    };
  }

  return addresses;
}

export function readCustomerAddresses() {
  return normalizeAddresses(loadMock(ADDRESS_KEY, []));
}

export function getDefaultCustomerAddress() {
  const addresses = readCustomerAddresses();

  return addresses.find((item) => item.default) || addresses[0] || null;
}

export function addCustomerAddress({ label, address }) {
  const addresses = readCustomerAddresses();

  if (addresses.length >= MAX_SAVED_ADDRESSES) {
    throw new Error(`You can save up to ${MAX_SAVED_ADDRESSES} addresses.`);
  }

  const cleanAddress = String(address || "").trim();

  const cleanLabel = String(label || "Address").trim() || "Address";

  if (!cleanAddress) {
    throw new Error("Please enter an address.");
  }

  const record = {
    id: uid("ADDR"),
    label: cleanLabel,
    address: cleanAddress,
    default: addresses.length === 0,
  };

  const next = [...addresses, record];

  saveMock(ADDRESS_KEY, next);

  return {
    record,
    addresses: next,
  };
}

export function deleteCustomerAddress(id) {
  const current = readCustomerAddresses();

  const removed = current.find((item) => item.id === id);

  let next = current.filter((item) => item.id !== id);

  if (removed?.default && next.length > 0) {
    next = next.map((item, index) => ({
      ...item,
      default: index === 0,
    }));
  }

  saveMock(ADDRESS_KEY, next);

  return next;
}

export function setDefaultCustomerAddress(id) {
  const next = readCustomerAddresses().map((item) => ({
    ...item,
    default: item.id === id,
  }));

  saveMock(ADDRESS_KEY, next);

  return next;
}
