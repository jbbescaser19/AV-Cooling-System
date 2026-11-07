import connectDB from "../../../utils/dbConn.js";
import { cartModel } from "../../../models/customer/cart/cartModel.js";
import { parseSelectedCartItems } from "../../../validators/customer/cart/selectionValidator.js";

const MAX_CART_UNITS = 99;

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

function validHP(hp) {
  if (typeof hp !== "string" || !/^(?:\d{1,2})(?:\.\d)?HP$/.test(hp)) {
    fail("Choose a valid horsepower option.");
  }
  return Number(hp.slice(0, -2));
}

function validQuantity(qty) {
  if (!Number.isInteger(qty) || qty < 1 || qty > MAX_CART_UNITS) {
    fail("Quantity must be a whole number from 1 to 99.");
  }
  return qty;
}

function itemInput(value) {
  const productId = value?.productId;
  if (typeof productId !== "string" || !/^[a-z0-9-]{1,100}$/.test(productId)) {
    fail("Invalid product.");
  }
  const hp = value?.hp;
  const qty = validQuantity(value?.qty);
  return { productId, hp, horsepower: validHP(hp), qty };
}

async function transaction(userId, callback) {
  const connection = await connectDB.getConnection();
  try {
    await connection.beginTransaction();
    const model = cartModel(connection);
    const customer = await model.customer(userId, true);
    if (!customer) fail("Active customer account required.", 403);
    const result = await callback(model, customer.id);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function snapshot(model, customerId) {
  const cartId = await model.activeCart(customerId);
  const [items, availableVariants] = await Promise.all([
    model.listItems(cartId),
    model.listVariantOptions(cartId),
  ]);
  const optionsByProduct = new Map();
  for (const option of availableVariants) {
    if (!optionsByProduct.has(option.productId)) {
      optionsByProduct.set(option.productId, []);
    }
    optionsByProduct.get(option.productId).push({
      hp: option.hp,
      price: Number(option.price),
      srp: Number(option.srp),
    });
  }
  return {
    items: items.map((item) => ({
      ...item,
      options: optionsByProduct.get(item.productId) || [],
    })),
    count: items.reduce((sum, item) => sum + Number(item.qty), 0),
  };
}

export async function readCustomerCart(userId) {
  const model = cartModel(connectDB);
  const customer = await model.customer(userId);
  if (!customer) fail("Active customer account required.", 403);
  return snapshot(model, customer.id);
}

export async function addCustomerCartItem(userId, body) {
  const input = itemInput({ ...body, qty: body?.quantity });
  return transaction(userId, async (model, customerId) => {
    const cartId =
      (await model.activeCart(customerId)) ||
      (await model.createCart(customerId));
    if ((await model.quantity(cartId)) + input.qty > MAX_CART_UNITS) {
      fail("Your cart can contain a maximum of 99 total units.", 409);
    }
    const variant = await model.findVariant(input.productId, input.horsepower);
    if (!variant) fail("This product option is not available.", 404);
    await model.upsert(cartId, variant.variantId, input.qty);
    return snapshot(model, customerId);
  });
}

export async function updateCustomerCartItem(userId, rawVariantId, body) {
  const variantId = Number(rawVariantId);
  if (!Number.isSafeInteger(variantId) || variantId < 1)
    fail("Invalid cart item.");
  const qty = validQuantity(body?.quantity);
  const horsepower = validHP(body?.hp);

  return transaction(userId, async (model, customerId) => {
    const cartId = await model.activeCart(customerId);
    if (!cartId) fail("Cart item not found.", 404);

    const current = await model.findCartLine(cartId, variantId);
    if (!current) fail("Cart item not found. Refresh your cart.", 404);

    // Resolve the new HP only within the original product; never trust a
    // product ID supplied by a browser for changing an existing cart line.
    const target = await model.findVariant(current.productId, horsepower);
    if (!target) fail("That horsepower is unavailable for this product.", 409);

    const projectedTotal =
      (await model.quantity(cartId)) - Number(current.qty) + qty;
    if (projectedTotal > MAX_CART_UNITS) {
      fail("Your cart can contain a maximum of 99 total units.", 409);
    }

    if (target.variantId === variantId) {
      await model.setQuantity(cartId, variantId, qty);
    } else {
      // If the target HP already exists, upsert combines the quantities.
      // Both statements are inside one transaction, so neither can be half-saved.
      await model.remove(cartId, variantId);
      await model.upsert(cartId, target.variantId, qty);
    }
    return snapshot(model, customerId);
  });
}

export async function mergeGuestCart(userId, body) {
  if (
    !body ||
    typeof body.mergeId !== "string" ||
    !/^[a-zA-Z0-9-]{8,80}$/.test(body.mergeId)
  ) {
    fail("Invalid cart merge ID.");
  }
  if (!Array.isArray(body.items) || body.items.length > MAX_CART_UNITS) {
    fail("Invalid guest cart.");
  }
  const inputs = body.items.map(itemInput);
  const totalIncoming = inputs.reduce((sum, item) => sum + item.qty, 0);
  if (totalIncoming > MAX_CART_UNITS) fail("Guest cart exceeds 99 units.");

  return transaction(userId, async (model, customerId) => {
    if (await model.hasMerge(customerId, body.mergeId)) {
      return snapshot(model, customerId);
    }
    const cartId =
      (await model.activeCart(customerId)) ||
      (await model.createCart(customerId));
    if ((await model.quantity(cartId)) + totalIncoming > MAX_CART_UNITS) {
      fail(
        "Your saved cart and guest cart exceed 99 units. Remove some items and retry.",
        409,
      );
    }
    const resolved = [];
    for (const item of inputs) {
      const variant = await model.findVariant(item.productId, item.horsepower);
      if (!variant)
        fail(`Product ${item.productId} (${item.hp}) is unavailable.`, 409);
      resolved.push({ variantId: variant.variantId, qty: item.qty });
    }
    for (const item of resolved)
      await model.upsert(cartId, item.variantId, item.qty);
    await model.markMerge(customerId, body.mergeId);
    return snapshot(model, customerId);
  });
}

export async function removeCustomerCartItem(userId, rawVariantId) {
  const variantId = Number(rawVariantId);
  if (!Number.isSafeInteger(variantId) || variantId < 1)
    fail("Invalid cart item.");
  return transaction(userId, async (model, customerId) => {
    const cartId = await model.activeCart(customerId);
    if (cartId) await model.remove(cartId, variantId);
    return snapshot(model, customerId);
  });
}

export async function clearCustomerCart(userId) {
  return transaction(userId, async (model, customerId) => {
    const cartId = await model.activeCart(customerId);
    if (cartId) await model.clear(cartId);
    return { items: [], count: 0 };
  });
}

// Only remove items included in the current checkout. A transaction keeps
// the other cart items untouched and rejects stale quantities.
export async function removeSelectedCustomerCartItems(userId, body) {
  const selected = parseSelectedCartItems(body);

  return transaction(userId, async (model, customerId) => {
    const cartId = await model.activeCart(customerId);
    if (!cartId) fail("Your cart has changed. Review it before checkout.", 409);

    for (const item of selected) {
      const current = await model.findCartLine(cartId, item.variantId);
      if (!current || Number(current.qty) !== item.quantity) {
        fail("A selected item changed. Review your cart before checkout.", 409);
      }
    }

    for (const item of selected) {
      await model.remove(cartId, item.variantId);
    }
    return snapshot(model, customerId);
  });
}
