export async function updateFeedback(model, staff, id, data) {
  let result;
  let converted = null;
  result = await model.updateFeedbackReply(id, data.staffReply);
  return { result, converted };
}
