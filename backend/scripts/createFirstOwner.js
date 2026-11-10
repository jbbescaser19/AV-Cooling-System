// One-time setup:
// node scripts/createFirstOwner.js owner@example.com

// Enter the password in the terminal,
// not in a command-line argument.

import process from "node:process";

import bcrypt from "bcrypt";

import connectDB from "../utils/dbConn.js";

import { staffModel } from "../models/management/staffModel.js";

const email = String(process.argv[2] || "")
  .trim()
  .toLowerCase();

if (!/^\S+@\S+\.\S+$/.test(email) || !process.stdin.isTTY) {
  console.error("Usage: node scripts/createFirstOwner.js owner@example.com");

  process.exit(1);
}

async function readHiddenPassword(prompt) {
  process.stdout.write(prompt);

  process.stdin.setRawMode(true);
  process.stdin.resume();

  let password = "";

  try {
    for await (const chunk of process.stdin) {
      for (const character of String(chunk)) {
        if (character === "\r" || character === "\n") {
          process.stdout.write("\n");

          return password;
        }

        if (character === "\u0003") {
          process.exit(130);
        }

        if (character === "\u007f") {
          password = password.slice(0, -1);
        } else if (character >= " " && password.length < 128) {
          password += character;
        }
      }
    }
  } finally {
    process.stdin.setRawMode(false);
    process.stdin.pause();
  }

  return password;
}

try {
  const model = staffModel(connectDB);

  if (await model.countOwners()) {
    throw new Error("An owner account already exists. No changes made.");
  }

  const password = await readHiddenPassword(
    "New owner password (12+ characters): ",
  );

  if (password.length < 12 || password.length > 128) {
    throw new Error("Password must be 12–128 characters.");
  }

  const confirm = await readHiddenPassword("Repeat password: ");

  if (password !== confirm) {
    throw new Error("Passwords do not match.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await model.createOwner(email, passwordHash);

  console.log("Owner created. Sign in at /management/login.");
} catch (error) {
  console.error("Owner creation failed:", error.message);

  process.exitCode = 1;
} finally {
  await connectDB.end();
}
