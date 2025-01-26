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
    const prompt = `Generate ${numQuestions} multiple-choice questions on the topic "${topic}" with difficulty level "${difficulty}". Provide the output in this exact JSON format:

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
        max_tokens: 800,
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

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(403).send("Token required.");
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).send("Invalid token.");
  }
};

const mongoose = require("mongoose");

// Connect to MongoDB
// mongoose
//   .connect(
//     `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@machbazar.vecifgc.mongodb.net/?retryWrites=true&w=majority&appName=machbazar`,
//     {
//       useNewUrlParser: true,
//       useUnifiedTopology: true,
//     }
//   )
//   .then(() => console.log("Connected to MongoDB"))
//   .catch((err) => console.error("Connection failed:", err));

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

    res.status(201).send("User registered successfully!");
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

    const token = jwt.sign({ id: user._id, email: user.email }, SECRET_KEY, {
      expiresIn: "1h",
    });

    res.status(200).json({ token });
  } catch (error) {
    res.status(500).send("Error logging in.");
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
