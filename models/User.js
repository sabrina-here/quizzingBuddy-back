const mongoose = require("mongoose");

// Define the user schema
// const userSchema = new mongoose.Schema({
//   googleId: { type: String, required: true },
//   displayName: { type: String, required: true },
//   email: { type: String, required: true, unique: true },
//   createdAt: { type: Date, default: Date.now },
// });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true }, // User's name (required)
  email: { type: String, required: true, unique: true }, // User's email (required and unique)
  role: { type: String }, // User's email (required and unique)
  passwordHash: { type: String, required: true }, // Hashed password (required)
});

// Create the User model
const User = mongoose.model("User", userSchema);

// Export the model
module.exports = User;
