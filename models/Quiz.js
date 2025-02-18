const mongoose = require("mongoose");

const quizSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  email: { type: String, required: true }, // User's email (required and unique)
  topic: { type: String, required: true },
  score: { type: Number, required: true },
  numQuestions: { type: Number, required: true }, // Changed to Number type
  timer: { type: Number, required: true }, // Changed to Number type
  penalty: { type: Number, required: true }, // Changed to Number type
  difficulty: { type: String, required: true },
  quiz: {
    type: [
      {
        question: { type: String, required: true },
        answers: { type: [String], required: true }, // Array of strings for options
        correct: { type: String, required: true }, // Correct answer
      },
    ],
    required: true,
  }, // Array of objects
});

// Create the User model
const Quiz = mongoose.model("Quiz", quizSchema);

// Export the model
module.exports = Quiz;
