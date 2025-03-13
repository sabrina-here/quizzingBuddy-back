const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const SECRET_KEY = "your_jwt_secret";
const User = require("./models/User");
const bcrypt = require("bcrypt");

const app = express();

app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 5000;

app.get("/", async (req, res) => {
  res.send("quizzing buddy here");
});

require("dotenv").config();

app.post("/api/generate-questions", async (req, res) => {
  const { topic, difficulty, numQuestions } = req.body;

  if (!topic || !difficulty || !numQuestions) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const prompt = `Generate ${numQuestions} ${difficulty} multiple-choice questions on "${topic}". Provide the question answers in this exact format, do not add any other text:

    [
      { "question": "What is 2 + 2?", "answers": ["4", "3", "5", "6"], "correct": "4" },
      { "question": "What is 3 x 3?", "answers": ["6", "9", "12", "15"], "correct": "9" }
    ]`;

    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: prompt },
        ],
        temperature: 1,
        max_tokens: 1000,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
        response_format: { type: "text" },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    let content = response.data.choices[0].message.content;
    res.send(content);
  } catch (error) {
    console.error(
      "Error generating questions:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to generate quiz questions" });
  }
});

// ------------------ VERIFY JWT-------------------

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(403).send("Token required.");
  }

  try {
    const decoded = jwt.verify(token, process.env.SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).send("Invalid token.");
  }
};

const mongoose = require("mongoose");

mongoose
  .connect(
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@machbazar.vecifgc.mongodb.net/quizzingBuddy`,
    {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Connection failed:", err));

app.post("/register", async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      role,
      passwordHash: hashedPassword,
    });
    await newUser.save();
    const token = jwt.sign(
      { id: newUser._id, email: newUser.email },
      process.env.SECRET,
      {
        expiresIn: "2d",
      }
    );

    res.status(201).send({
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      id: newUser._id,
      accessToken: token,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error registering user.");
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).send("User not found.");
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).send("Invalid credentials.");
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.SECRET,
      {
        expiresIn: "2d",
      }
    );

    // res.status(200).json({ token });
    res.send({
      name: user.name,
      email: user.email,
      role: user.role,
      id: user._id,
      accessToken: token,
    });
  } catch (error) {
    res.status(500).send("Error logging in.");
  }
});

//--------- update user role
app.patch("/updateUser/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { role },
      { new: true } // Returns the updated document
    );

    if (!updatedUser) {
      return res.send({ message: "User not found" });
    }

    res.send({ message: "user role updated successfully", updatedUser });
  } catch (error) {
    console.error("Error updating user role:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

const Quiz = require("./models/Quiz");

app.post("/saveQuiz", authenticate, async (req, res) => {
  try {
    const {
      email,
      topic,
      timer,
      score,
      numQuestions,
      difficulty,
      quiz,
      penalty,
    } = req.body;
    const userId = req.user.id; // Retrieved from the token's payload

    const newQuiz = new Quiz({
      userId,
      email,
      topic,
      timer,
      penalty,
      score,
      numQuestions,
      difficulty,
      quiz,
    });

    await newQuiz.save();
    res.status(201).send("Quiz saved successfully");
  } catch (error) {
    console.error("Error saving quiz:", error);
    res.status(500).send("Internal server error");
  }
});

const Topic = require("./models/Topic");

app.post("/saveTopic", authenticate, async (req, res) => {
  try {
    const { email, topic } = req.body; // Expecting a single topic to add
    const userId = req.user.id; // Extracted from JWT token

    if (!topic) {
      return res.status(400).json({ message: "Topic is required" });
    }

    // Check if a document for this user exists
    let userTopics = await Topic.findOne({ user_id: userId });

    if (userTopics) {
      // If the topic already exists, ignore it
      if (userTopics.topics.includes(topic)) {
        return res.send({ message: "Topic already exists" });
      }

      // Otherwise, update the topics array
      userTopics.topics.push(topic);
      await userTopics.save();
      return res.send({ message: "Topic added", topics: userTopics.topics });
    } else {
      // If no record exists, create a new one
      const newTopic = new Topic({
        user_id: userId,
        email,
        topics: [topic],
      });

      await newTopic.save();
      return res.send({
        message: "New topic list created",
        topics: newTopic.topics,
      });
    }
  } catch (error) {
    console.error("Error saving topic:", error);
    res.send({ message: "Internal server error" });
  }
});

app.get("/getTopics", authenticate, async (req, res) => {
  try {
    const user_id = req.user.id; // Extract user ID from the token
    const userTopics = await Topic.findOne({ user_id });

    if (!userTopics) {
      return res.send({ message: "No topics found for this user." });
    }
    res.send({ topics: userTopics.topics });
  } catch (error) {
    console.error("Error fetching topics:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// ------------ get quizzes based on topic for a particular user
app.get("/getQuizzes", authenticate, async (req, res) => {
  try {
    const user_id = req.user.id; // Extract user ID from the token
    const { topic } = req.query; // Get the topic from the request query

    if (!topic) {
      return res.status(400).json({ message: "Topic is required." });
    }

    const quizzes = await Quiz.find({ userId: user_id, topic });

    if (!quizzes.length) {
      return res.send({ message: "No quizzes found for this topic." });
    }

    res.send({ quizzes });
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});
// ------------ get quizzes for a particular user
app.get("/getMyQuizzes", authenticate, async (req, res) => {
  try {
    const user_id = req.user.id; // Extract user ID from the token

    const quizzes = await Quiz.find({ userId: user_id });

    if (!quizzes.length) {
      return res.send({ message: "No quizzes found for this user." });
    }

    res.send({ quizzes });
  } catch (error) {
    console.error("Error fetching quizzes:", error);
    res.status(500).json({ message: "Internal server error." });
  }
});

//-------------------- update score of quiz after try again
app.patch("/updateQuiz/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { score, penalty } = req.body;

    const updatedQuiz = await Quiz.findByIdAndUpdate(
      id,
      { score, penalty },
      { new: true } // Returns the updated document
    );

    if (!updatedQuiz) {
      return res.send({ message: "Quiz not found" });
    }

    res.send({ message: "Quiz updated successfully", updatedQuiz });
  } catch (error) {
    console.error("Error updating quiz:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//---------------- delete topic -----------
app.delete("/deleteTopic", authenticate, async (req, res) => {
  try {
    const { topic } = req.body;
    const user_id = req.user.id; // Get user ID from the token

    // 1️⃣ Remove the topic from the topics array
    const updatedTopics = await Topic.findOneAndUpdate(
      { user_id },
      { $pull: { topics: topic } }, // Removes the topic from the array
      { new: true }
    );

    if (!updatedTopics) {
      return res.send({ message: "User topics not found" });
    }

    // 2️⃣ Delete all quizzes of that topic for the user
    const userId = user_id;
    await Quiz.deleteMany({ userId, topic });

    res.send({ message: "Topic and related quizzes deleted successfully" });
  } catch (error) {
    console.error("Error deleting topic and quizzes:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//----------------- delete quiz --------
app.delete("/deleteQuiz/:quizId", authenticate, async (req, res) => {
  try {
    const { quizId } = req.params;
    const qId = new mongoose.Types.ObjectId(quizId);
    const userId = req.user.id; // Ensure the user can only delete their own quiz

    const deletedQuiz = await Quiz.findOneAndDelete({ _id: qId, userId });

    if (!deletedQuiz) {
      return res
        .status(404)
        .json({ message: "Quiz not found or unauthorized" });
    }

    res.send({ message: "Quiz deleted successfully" });
  } catch (error) {
    console.error("Error deleting quiz:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//--------------------------------------------------------------------

app.get("/getUserTopicStats", authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    // Fetch user's topics
    const userTopics = await Topic.findOne({ user_id: userId });

    if (!userTopics) {
      return res.send({ message: "No topics found for this user" });
    }

    // Fetch all quizzes of this user
    const userQuizzes = await Quiz.find({ userId: userId });

    // Process quizzes and aggregate data
    const topicStats = userTopics.topics.map((topic) => {
      const quizzesForTopic = userQuizzes.filter(
        (quiz) => quiz.topic === topic
      );

      const totalScore = quizzesForTopic.reduce(
        (sum, quiz) => sum + quiz.score,
        0
      );
      const totalNumQuestions = quizzesForTopic.reduce(
        (sum, quiz) => sum + quiz.numQuestions,
        0
      );
      const totalQuizzes = quizzesForTopic.length;

      const difficultyCounts = quizzesForTopic.reduce(
        (acc, quiz) => {
          if (quiz.difficulty === "easy") acc.difficulty_easy++;
          if (quiz.difficulty === "medium") acc.difficulty_medium++;
          if (quiz.difficulty === "hard") acc.difficulty_hard++;
          return acc;
        },
        { difficulty_easy: 0, difficulty_medium: 0, difficulty_hard: 0 }
      );

      return {
        topic,
        score: totalScore,
        numQuestions: totalNumQuestions,
        total_quizzes: totalQuizzes,
        ...difficultyCounts,
      };
    });
    res.send(topicStats);
  } catch (error) {
    console.error("Error fetching topic statistics:", error);
    res.status(500).json({ message: "Server error" });
  }
});

//---------------------------- topic preference --------------
const TopicPreference = require("./models/TopicPreference");

// POST route to save topic preferences
app.post("/preferredTopics", authenticate, async (req, res) => {
  try {
    const { userId, email, preferredTopic } = req.body;

    if (!userId || !email || !preferredTopic) {
      return res.status(400).json({ message: "Invalid data format" });
    }

    // Check if user already has preferences
    let existingPreference = await TopicPreference.findOne({ userId });

    if (existingPreference) {
      // Append new topic if it doesn't already exist
      if (!existingPreference.preferredTopics.includes(preferredTopic)) {
        existingPreference.preferredTopics.push(preferredTopic);
        await existingPreference.save();
        return res
          .status(200)
          .json({ message: "Preferences updated", data: existingPreference });
      } else {
        return res
          .status(200)
          .json({ message: "Topic already exists", data: existingPreference });
      }
    }

    // If no existing preference, create a new one
    const newPreference = new TopicPreference({
      userId,
      email,
      preferredTopics: [preferredTopic], // Store it as an array
    });

    await newPreference.save();

    res.status(201).json({ message: "Preferences saved", data: newPreference });
  } catch (error) {
    console.error("Error saving topic preferences:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// GET user preferences by userId
app.get("/preferredTopics/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;

    const preferences = await TopicPreference.findOne({ userId });

    if (!preferences) {
      return res
        .status(404)
        .json({ message: "No preferences found for this user" });
    }

    res.send({ message: "Preferences retrieved", data: preferences });
  } catch (error) {
    console.error("Error fetching preferences:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE user preferences by userId
app.delete("/preferredTopics/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { preferredTopic } = req.body; // Get the topic to be removed from request body

    if (!preferredTopic) {
      return res.status(400).json({ message: "Preferred topic is required" });
    }

    // Find the document and update the array by pulling out the specific topic
    const updatedPreference = await TopicPreference.findOneAndUpdate(
      { userId },
      { $pull: { preferredTopics: preferredTopic } }, // Removes only the matching topic
      { new: true } // Returns the updated document
    );

    if (!updatedPreference) {
      return res
        .status(404)
        .json({ message: "No preferences found to update" });
    }

    res.status(200).json({
      message: "Preferred topic removed successfully",
      data: updatedPreference,
    });
  } catch (error) {
    console.error("Error deleting preferred topic:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//-----------------------------------------------------------------

// GET user quiz stats
app.get("/stats/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch all quizzes of the user
    const quizzes = await Quiz.find({ userId });

    if (!quizzes.length) {
      return res.send({ message: "No quizzes found for this user" });
    }

    // Initialize counters
    let totalQuizzes = quizzes.length;
    let easyQuizzes = 0,
      mediumQuizzes = 0,
      hardQuizzes = 0;
    let totalScore = 0,
      totalQuestions = 0;
    let easyScore = 0,
      mediumScore = 0,
      hardScore = 0;
    let easyQuestions = 0,
      mediumQuestions = 0,
      hardQuestions = 0;

    // Process each quiz
    quizzes.forEach((quiz) => {
      totalScore += quiz.score;
      totalQuestions += quiz.numQuestions;

      // Categorize by difficulty
      if (quiz.difficulty === "easy") {
        easyQuizzes++;
        easyScore += quiz.score;
        easyQuestions += quiz.numQuestions;
      } else if (quiz.difficulty === "medium") {
        mediumQuizzes++;
        mediumScore += quiz.score;
        mediumQuestions += quiz.numQuestions;
      } else if (quiz.difficulty === "hard") {
        hardQuizzes++;
        hardScore += quiz.score;
        hardQuestions += quiz.numQuestions;
      }
    });

    // Calculate percentages (handling division by zero)
    const avgMarks = totalQuestions
      ? ((totalScore / totalQuestions) * 100).toFixed(2)
      : 0;
    const easyMarks = easyQuestions
      ? ((easyScore / easyQuestions) * 100).toFixed(2)
      : 0;
    const mediumMarks = mediumQuestions
      ? ((mediumScore / mediumQuestions) * 100).toFixed(2)
      : 0;
    const hardMarks = hardQuestions
      ? ((hardScore / hardQuestions) * 100).toFixed(2)
      : 0;

    // Send response
    res.send({
      totalQuizzes,
      easyQuizzes,
      mediumQuizzes,
      hardQuizzes,
      avgMarks: `${avgMarks}`,
      easyMarks: `${easyMarks}`,
      mediumMarks: `${mediumMarks}`,
      hardMarks: `${hardMarks}`,
      // quizzes,
    });
  } catch (error) {
    console.error("Error fetching quiz stats:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
