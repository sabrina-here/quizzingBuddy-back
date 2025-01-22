const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

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

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
