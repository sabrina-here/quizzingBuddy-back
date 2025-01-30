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
    const prompt = `Generate ${numQuestions} multiple-choice questions on the topic "${topic}" with difficulty level "${difficulty}". Provide the question answers in this exact JSON format, do not add any other text:

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
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let content = response.data.choices[0].message.content;
    console.log(content);
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
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
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

    res.status(201).send({ message: "User registered successfully!", token });
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
    res.send({ name: user.name, email: user.email, accessToken: token });
  } catch (error) {
    res.status(500).send("Error logging in.");
  }
});

const Quiz = require("./models/Quiz");

app.post("/saveQuiz", authenticate, async (req, res) => {
  try {
    const { email, topic, score, numQuestions, difficulty, quiz } = req.body;
    const userId = req.user.id; // Retrieved from the token's payload

    const newQuiz = new Quiz({
      userId,
      email,
      topic,
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
    console.log("hit the api");
    const userTopics = await Topic.findOne({ user_id });
    console.log(userTopics);

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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
