const mongoose = require("mongoose");

const topicPreferenceSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true }, // Unique per user
  email: { type: String, required: true },
  preferredTopics: { type: [String], default: [] }, // Array of strings
});

const TopicPreference = mongoose.model(
  "TopicPreference",
  topicPreferenceSchema
);

module.exports = TopicPreference;
