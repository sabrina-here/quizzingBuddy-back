const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    unique: true,
    ref: "User", // References the User collection
  },
  email: {
    type: String,
    required: true,
  },
  topics: {
    type: [String], // Array of topic names (strings)
    default: [],
  },
});

const Topic = mongoose.model("Topic", topicSchema);
module.exports = Topic;
