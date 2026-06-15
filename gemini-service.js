import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
let genAI = null;

if (apiKey && apiKey !== 'your_gemini_api_key_here') {
  genAI = new GoogleGenerativeAI(apiKey);
} else {
  console.warn('WARNING: GEMINI_API_KEY is not set. Using fallback mock service for AI features.');
}

/**
 * Generates a dynamic 3-question multiple-choice quiz on a specific topic.
 * @param {string} topic - The domain and level details (e.g., "HTML & CSS Layouts")
 * @returns {Promise<Array>} List of questions
 */
export async function generateQuiz(topic) {
  if (!genAI) {
    return getMockQuiz(topic);
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are an expert technical interviewer and educator.
      Generate a quiz containing exactly 3 multiple-choice questions testing knowledge on the topic: "${topic}".
      
      Return the output as a valid JSON array of objects. Each object MUST have this exact structure:
      {
        "question": "The question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": 0 // 0-based index of the correct option (0, 1, 2, or 3)
      }
      
      Ensure the questions vary in difficulty (easy, medium, hard) and test core understanding, not just trivia. Do not wrap the JSON in markdown code blocks.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    
    // Parse response
    const questions = JSON.parse(text);
    if (Array.isArray(questions) && questions.length === 3) {
      return questions;
    }
    throw new Error('Invalid questions count or format');
  } catch (error) {
    console.error('Error generating quiz from Gemini:', error);
    return getMockQuiz(topic);
  }
}

/**
 * Gets a response from the Gemini AI tutor for a student's question.
 * @param {string} userMessage - The student's message
 * @param {Object} studentProfile - Current student profile details (XP, completed topics)
 * @param {string} currentRoadmap - Current roadmap they are focusing on ("web-dev" or "dsa")
 * @returns {Promise<string>} AI tutor response
 */
export async function getTutorResponse(userMessage, studentProfile, currentRoadmap) {
  if (!genAI) {
    return "Hi! I'm your AI tutor. (Note: Gemini API key is missing, so I'm running in offline mode). To learn Web Development, focus on HTML/CSS then JS. To learn DSA, start with Big O and Arrays! Let me know what you need help with.";
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemPrompt = `
      You are "EduQuest Guide", a supportive and encouraging AI learning companion for a student.
      The student is currently learning in the domain: "${currentRoadmap}".
      Here is the student's progress:
      - Current level/badges unlocked: ${JSON.stringify(studentProfile.badges || [])}
      - Total XP: ${studentProfile.xp}
      - Completed Levels in Web Dev: ${JSON.stringify(studentProfile.completedLevels['web-dev'] || [])}
      - Completed Levels in DSA: ${JSON.stringify(studentProfile.completedLevels['dsa'] || [])}

      Your goal:
      1. Guide the student on what to study next based on their roadmap and level.
      2. If they ask about web development or DSA, explain key concepts simply and recommend relevant learning resources.
      3. Always keep your response concise (max 3 short paragraphs), friendly, and structured.
      4. Use formatting (bolding, lists) to make information readable.
      5. Include a motivational sign-off.
    `;

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: "Hello! Who are you?" }] },
        { role: 'model', parts: [{ text: "Hello! I am your EduQuest Guide. I'm here to help you navigate your Web Development and DSA roadmaps, answer your questions, and support you on your learning journey. Let's level up together!" }] }
      ],
      systemInstruction: systemPrompt
    });

    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (error) {
    console.error('Error getting tutor response from Gemini:', error);
    return "I apologize, but I encountered an error connecting to my knowledge base. Let's try again! What topic would you like to review?";
  }
}

// Fallback mock quizzes in case API key is not configured or fails
function getMockQuiz(topic) {
  console.log(`Serving mock quiz for topic: ${topic}`);
  const topicLower = topic.toLowerCase();
  
  if (topicLower.includes('html') || topicLower.includes('css')) {
    return [
      {
        question: "Which HTML5 element is used to define key navigation links?",
        options: ["<navigation>", "<nav>", "<links>", "<menu>"],
        correctAnswer: 1
      },
      {
        question: "What does the 'flex-direction: column-reverse' property do in CSS Flexbox?",
        options: [
          "Lays out flex items vertically from bottom to top",
          "Lays out flex items horizontally from right to left",
          "Reverses the color scheme of columns",
          "Creates a grid layout with reversed columns"
        ],
        correctAnswer: 0
      },
      {
        question: "How do you select an element with the class name 'btn' in CSS?",
        options: ["#btn", "btn", ".btn", "*btn"],
        correctAnswer: 2
      }
    ];
  } else if (topicLower.includes('javascript') || topicLower.includes('js')) {
    return [
      {
        question: "What is the difference between 'let' and 'var' in JavaScript?",
        options: [
          "'let' is block-scoped, while 'var' is function-scoped",
          "'var' is block-scoped, while 'let' is function-scoped",
          "There is no difference, they are aliases",
          "'let' cannot be reassigned, whereas 'var' can"
        ],
        correctAnswer: 0
      },
      {
        question: "Which of the following array methods returns a new array with elements that pass a test?",
        options: ["map()", "forEach()", "find()", "filter()"],
        correctAnswer: 3
      },
      {
        question: "What is the correct syntax to write an arrow function that returns the sum of a and b?",
        options: [
          "(a, b) => { return a + b; }",
          "function(a, b) => a + b",
          "(a, b) => return a + b",
          "arrow(a, b) => a + b"
        ],
        correctAnswer: 0
      }
    ];
  } else if (topicLower.includes('complexity') || topicLower.includes('array')) {
    return [
      {
        question: "What is the time complexity of accessing an element in an array by its index?",
        options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
        correctAnswer: 0
      },
      {
        question: "If an algorithm's running time doubles each time the input size increases by 1, what is its time complexity?",
        options: ["O(n^2)", "O(2^n)", "O(log n)", "O(n!)"],
        correctAnswer: 1
      },
      {
        question: "Which technique uses two index pointers moving towards each other or at different speeds to solve array problems?",
        options: ["Binary Search", "Two-pointer technique", "Sliding Window", "Recursion"],
        correctAnswer: 1
      }
    ];
  } else if (topicLower.includes('python') || topicLower.includes('numpy') || topicLower.includes('pandas') || topicLower.includes('data') || topicLower.includes('visual') || topicLower.includes('plot') || topicLower.includes('machine') || topicLower.includes('learn') || topicLower.includes('ml')) {
    return [
      {
        question: "Which of the following describes a key benefit of NumPy arrays over standard Python lists?",
        options: [
          "NumPy arrays support mixed datatypes in a single list",
          "NumPy arrays use contiguous memory and vectorized operations for speed",
          "NumPy arrays are automatically visualised in browser windows",
          "NumPy arrays do not support mathematical operations"
        ],
        correctAnswer: 1
      },
      {
        question: "What Pandas function is commonly used to load a dataset from a comma-separated text file?",
        options: ["pd.read_json()", "pd.load_csv()", "pd.read_csv()", "pd.import_csv()"],
        correctAnswer: 2
      },
      {
        question: "In Machine Learning, what is the purpose of splitting data into training and testing sets?",
        options: [
          "To speed up the mathematical fitting of parameters",
          "To test model performance on unseen data and check for overfitting",
          "To convert continuous attributes to categoric labels",
          "To clean missing values from rows automatically"
        ],
        correctAnswer: 1
      }
    ];
  } else if (topicLower.includes('linux') || topicLower.includes('net') || topicLower.includes('cyber') || topicLower.includes('security') || topicLower.includes('crypt') || topicLower.includes('cipher') || topicLower.includes('hack') || topicLower.includes('pentest') || topicLower.includes('owasp')) {
    return [
      {
        question: "In Linux file systems, what command is used to modify read, write, and execute permissions?",
        options: ["chown", "chmod", "pwd", "grep"],
        correctAnswer: 1
      },
      {
        question: "What security exploit occurs when user-supplied database inputs are executed as raw database queries?",
        options: ["Cross-Site Scripting (XSS)", "SQL Injection (SQLi)", "Brute Force Attack", "Man-in-the-Middle (MITM)"],
        correctAnswer: 1
      },
      {
        question: "In Cryptography, what is the defining characteristic of Asymmetric Encryption?",
        options: [
          "It uses a single shared key for both encrypting and decrypting",
          "It uses a public key to encrypt and a separate private key to decrypt",
          "It is mathematically impossible to decrypt by anyone",
          "It does not require any keys"
        ],
        correctAnswer: 1
      }
    ];
  } else {
    // Default fallback quiz
    return [
      {
        question: "What does DSA stand for in computer science?",
        options: ["Data System Analysis", "Data Structures and Algorithms", "Database Security Administration", "Digital Signal Allocation"],
        correctAnswer: 1
      },
      {
        question: "Which data structure operates on a Last-In-First-Out (LIFO) basis?",
        options: ["Queue", "Array", "Stack", "Binary Tree"],
        correctAnswer: 2
      },
      {
        question: "Which of these is a divide-and-conquer sorting algorithm?",
        options: ["Bubble Sort", "Insertion Sort", "Selection Sort", "Merge Sort"],
        correctAnswer: 3
      }
    ];
  }
}

/**
 * Gets a response from the Gemini AI tutor using a full conversation history list.
 * @param {Array} historyMessages - Array of { role: 'ai'|'student', text: string, attachment: string|null }
 * @returns {Promise<string>} AI response
 */
export async function getEduBotResponse(historyMessages) {
  if (!genAI) {
    const lastMsg = historyMessages[historyMessages.length - 1];
    return getOfflineTutorReply(lastMsg.text);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const chatHistory = [];
    const systemPrompt = `
      You are "EduBot", a highly engaging, friendly, and expert AI tutor designed to assist students.
      Help them learn concepts, solve programming errors, structure their study schedules, and guide them in domains like Web Development or DSA.
      Keep your responses readable, use code formatting blocks where appropriate, and maintain an encouraging educational tone.
    `;

    for (let i = 0; i < historyMessages.length - 1; i++) {
      const msg = historyMessages[i];
      chatHistory.push({
        role: msg.role === 'student' ? 'user' : 'model',
        parts: [{ text: msg.text + (msg.attachment ? `\n[Attached File: ${msg.attachment}]` : '') }]
      });
    }

    const activeChat = model.startChat({
      history: chatHistory,
      systemInstruction: systemPrompt
    });

    const lastMsg = historyMessages[historyMessages.length - 1];
    const userPrompt = lastMsg.text + (lastMsg.attachment ? `\n[Attached File: ${lastMsg.attachment}]` : '');

    const result = await activeChat.sendMessage(userPrompt);
    return result.response.text();
  } catch (error) {
    console.error('Error in getEduBotResponse:', error);
    return "I encountered a learning block when generating a response. Could you please rephrase your question?";
  }
}

/**
 * Custom offline expert tutor logic that parses user input and returns high-quality explanations.
 * @param {string} text - User message
 * @returns {string} Detailed educational response
 */
function getOfflineTutorReply(text) {
  const query = text.toLowerCase().trim();
  
  if (query.includes('array')) {
    return `### 📊 What is an Array?

An **Array** is a linear data structure that stores a collection of elements of the same type at **contiguous (adjacent) memory locations**. It is one of the most fundamental data structures in computer science.

#### Key Characteristics:
1. **Fixed Size**: Once initialized, its size cannot be changed (in languages like C++ or Java. JavaScript arrays are dynamic but operate on similar principles under the hood).
2. **Indexing**: Elements are accessed using a 0-based index. 
3. **Contiguous Memory**: This allows $O(1)$ constant time access.

#### Operations & Complexity:
- **Access**: $O(1)$ — directly access by index: \`arr[i]\`.
- **Search (Unsorted)**: $O(n)$ — linear search.
- **Search (Sorted)**: $O(\\log n)$ — binary search.
- **Insertion/Deletion**: $O(n)$ — requires shifting elements.

#### Example code (JavaScript):
\`\`\`javascript
// Declare and initialize an array
const fruits = ['Apple', 'Banana', 'Orange'];

// Accessing an element (O(1))
console.log(fruits[1]); // Output: Banana

// Adding to the end
fruits.push('Mango');
\`\`\`
Let me know if you want to test your knowledge on arrays!`;
  }

  if (query.includes('recursion') || query.includes('recursive')) {
    return `### 🧭 Understanding Recursion

**Recursion** is a programming technique where a function calls itself to solve a smaller instance of the same problem. Think of it as solving a puzzle by breaking it down into identical, smaller puzzles.

#### The Two Golden Rules of Recursion:
1. **Base Case**: The condition under which the function *stops* calling itself. Without a base case, the function will call itself infinitely, leading to a **Stack Overflow** error.
2. **Recursive Step**: The part where the function calls itself with a modified (usually smaller) input, moving closer to the base case.

#### Example: Calculating Factorial ($n!$)
Factorial of $n$ is defined as $n \\times (n-1) \\times ... \\times 1$. We can write this recursively:
- **Base Case**: If $n = 1$, return $1$.
- **Recursive Step**: Otherwise, return $n \\times \\text{factorial}(n-1)$.

#### Example code (JavaScript):
\`\`\`javascript
function factorial(n) {
  // 1. Base Case
  if (n <= 1) {
    return 1;
  }
  // 2. Recursive Step
  return n * factorial(n - 1);
}

console.log(factorial(5)); // Output: 120 (5 * 4 * 3 * 2 * 1)
\`\`\`

#### Call Stack Visualization for \`factorial(3)\`:
1. \`factorial(3)\` calls \`factorial(2)\`
2. \`factorial(2)\` calls \`factorial(1)\`
3. \`factorial(1)\` returns \`1\` (Base case hit!)
4. \`factorial(2)\` receives \`1\` and returns \`2 * 1 = 2\`
5. \`factorial(3)\` receives \`2\` and returns \`3 * 2 = 6\``;
  }

  if (query.includes('complexity') || query.includes('big o') || query.includes('big-o')) {
    return `### ⏱️ Time & Space Complexity (Big O)

**Big O Notation** is a mathematical notation used to describe the efficiency and performance of an algorithm as the input size ($n$) grows. It focuses on the **worst-case scenario**.

#### Common Time Complexities (From Fastest to Slowest):

1. **$O(1)$ — Constant Time**: The runtime is independent of the input size.
   * *Example*: Accessing an array element by index: \`arr[2]\`.
2. **$O(\\log n)$ — Logarithmic Time**: The input size is cut in half at each step.
   * *Example*: Binary Search. Very efficient for large inputs.
3. **$O(n)$ — Linear Time**: The runtime grows proportionally to the input size.
   * *Example*: Iterating through a loop to find an element in an unsorted array.
4. **$O(n \\log n)$ — Linearithmic Time**: Commonly found in efficient sorting algorithms.
   * *Example*: Merge Sort, Quick Sort.
5. **$O(n^2)$ — Quadratic Time**: The runtime grows quadratically. Usually caused by nested loops.
   * *Example*: Bubble Sort, Selection Sort.

#### Cheat Sheet:
- **Fastest**: $O(1) < O(\\log n) < O(n)$
- **Moderate**: $O(n \\log n)$
- **Slow**: $O(n^2) < O(2^n) < O(n!)$`;
  }

  if (query.includes('html')) {
    return `### 🌐 HTML (HyperText Markup Language)

**HTML** is the skeleton of the web. It defines the structure and content of web pages using tags.

#### 1. Document Structure:
Every HTML5 document starts with a doctype and includes \`<html>\`, \`<head>\` (for metadata, styling links), and \`<body>\` (visible content) elements:
\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Web Page</title>
</head>
<body>
  <h1>Welcome to EduBot!</h1>
</body>
</html>
\`\`\`

#### 2. Semantic Elements:
Semantic HTML elements clearly describe their meaning to both the browser and the developer (which helps with SEO and Accessibility):
- \`<header>\`: Defines a header section.
- \`<nav>\`: Container for navigation links.
- \`<main>\`: Holds the primary content of the body.
- \`<section>\`: Group of related content.
- \`<footer>\`: Defines the footer area.`;
  }

  if (query.includes('css')) {
    return `### 🎨 CSS (Cascading Style Sheets)

**CSS** controls the presentation, colors, layouts, and styling of HTML content.

#### 1. Selectors & Specificity:
How you target HTML elements in CSS:
- **Element Selector**: \`p { color: grey; }\`
- **Class Selector**: \`.btn { background-color: blue; }\` (Re-usable, prefixed with \`.\`)
- **ID Selector**: \`#header { padding: 10px; }\` (Unique, prefixed with \`#\`)

#### 2. CSS Flexbox (1D Layouts):
Enables alignment of elements along a single direction (row or column):
\`\`\`css
.container {
  display: flex;
  flex-direction: row; /* or column */
  justify-content: center; /* horizontal alignment */
  align-items: center; /* vertical alignment */
}
\`\`\`

#### 3. CSS Grid (2D Layouts):
Enables grid alignments along rows AND columns simultaneously:
\`\`\`css
.grid-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr); /* 3 equal columns */
  gap: 10px;
}
\`\`\`
Which CSS layout technique are you currently studying?`;
  }

  if (query.includes('javascript') || query.includes('js')) {
    return `### ⚡ JavaScript (JS) Basics

**JavaScript** is the scripting language of the web. It enables dynamic interactivity, asynchronously fetches data, and handles user interactions.

#### 1. Scope & Variables:
- \`const\`: Declares a block-scoped read-only constant (cannot be reassigned).
- \`let\`: Declares a block-scoped variable (can be reassigned).
- \`var\`: Declares a function-scoped variable (avoid using in modern JS).

#### 2. Arrow Functions (ES6+):
Shorthand syntax for writing functions:
\`\`\`javascript
// Traditional Function
function add(a, b) {
  return a + b;
}

// Arrow Function
const addArrow = (a, b) => a + b;
\`\`\`

#### 3. Asynchronous JavaScript (Promises & Fetch):
\`\`\`javascript
// Fetching data from an API using async/await
async function getUserData() {
  try {
    const response = await fetch('/api/student');
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error("Fetch failed", error);
  }
}
\`\`\`
Ask me about loops, arrays, objects, or event handlers in JavaScript!`;
  }

  if (query.includes('react')) {
    return `### ⚛️ React.js Overview

**React** is a popular JavaScript library developed by Meta for building user interfaces, specifically Single Page Applications (SPAs).

#### Core Concepts:

1. **Components**: The building blocks of React. They are reusable JavaScript functions that return JSX (HTML-like syntax inside JS).
2. **Props**: Input data passed from a parent component to a child component (read-only).
3. **State**: Data local to a component that can change over time. When state updates, React automatically re-renders the component.

#### Basic React Counter Example:
\`\`\`jsx
import React, { useState } from 'react';

function Counter() {
  // Declare count state variable, initialized to 0
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>You clicked {count} times</p>
      <button onClick={() => setCount(count + 1)}>
        Click Me
      </button>
    </div>
  );
}
\`\`\`
What hooks are you studying? I can explain \`useState\`, \`useEffect\`, or \`useRef\`!`;
  }

  if (query.includes('stack') || query.includes('queue')) {
    return `### 🥞 Stacks vs. Queues

Both **Stacks** and **Queues** are linear data structures, but they differ fundamentally in the order in which elements are added and removed.

---

#### 1. Stack (LIFO: Last-In-First-Out)
Think of a stack of plates. You add plates to the top, and you must remove plates from the top first.
- **Key Operations**:
  - \`push(x)\`: Insert an element at the top.
  - \`pop()\`: Remove and return the top element.
  - \`peek()\`: Look at the top element without removing it.
- **Use Cases**: Browser history (back button), undo mechanism in editors, function call stack.

---

#### 2. Queue (FIFO: First-In-First-Out)
Think of a line of people waiting. The person who enters the line first is served first.
- **Key Operations**:
  - \`enqueue(x)\`: Add an element to the back.
  - \`dequeue()\`: Remove and return the front element.
- **Use Cases**: CPU scheduling, printer jobs queue, BFS graph traversal.`;
  }

  // Default offline help text
  return `Hi! I'm running in **Offline Mode** because the \`GEMINI_API_KEY\` is not set in your \`.env\` file.

However, I am fully equipped to explain core engineering and DSA concepts locally! Ask me questions about any of the following:

- **Data Structures**: Arrays, Linked Lists, Stacks, Queues, Binary Search Trees (BST)
- **Algorithms**: Recursion, Sorting Algorithms, Binary Search
- **Big O Notation**: Time and Space Complexities
- **Web Development**: HTML structure, CSS layout techniques (Flexbox, Grid), JavaScript (ES6, Fetch, Async/Await), and React basics (Components, Props, State)

Type **"explain recursion"** or **"explain complexity"** to test me out!`;
}

/**
 * Gets domain guidance advice from Gemini AI.
 * @param {string} userMessage - Career guidance question
 * @returns {Promise<string>} AI guidance response
 */
export async function getDomainGuidance(userMessage) {
  if (!genAI) {
    return getOfflineGuidance(userMessage);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const systemPrompt = `
      You are "EduQuest Career Advisor", an expert academic counselor helping students decide where to start in computer science.
      Focus on guiding them between:
      1. Web Development (Frontend, HTML/CSS, JS, React, product building).
      2. Data Structures & Algorithms (Logic, optimizations, interview prep, competitive coding).
      
      Your goals:
      - Answer their questions about tech domains clearly.
      - Contrast Web Dev and DSA based on their interest.
      - Recommend where they should start and outline a 3-step action plan.
      - Keep your response friendly, clear, and under 3 short paragraphs.
    `;

    const chat = model.startChat({
      systemInstruction: systemPrompt
    });

    const result = await chat.sendMessage(userMessage);
    return result.response.text();
  } catch (error) {
    console.error('Error in getDomainGuidance:', error);
    return getOfflineGuidance(userMessage);
  }
}

function getOfflineGuidance(text) {
  const query = text.toLowerCase();
  
  if (query.includes('web') || query.includes('develop') || query.includes('visual') || query.includes('design') || query.includes('front') || query.includes('app')) {
    return `### 🌐 (Offline Advisor) I recommend Web Development!

Since you are interested in visual elements, building apps, or designing interfaces, Web Development is the perfect starting point.

#### Why Web Development?
- **Visual Feedback**: You immediately see the results of your code in the browser.
- **Project Building**: You can build and deploy real products that users can interact with.
- **Versatile Skills**: Teaches HTML, CSS, JavaScript, React, and server-side development.

#### Recommended 3-Step Plan:
1. Start with **HTML & CSS Foundations** (Level 1 in Web Dev Quest) to understand layouts.
2. Add interactivity with **JavaScript Fundamentals** (Level 2).
3. Try building a simple portfolio website to showcase your work!`;
  }

  if (query.includes('logic') || query.includes('dsa') || query.includes('interview') || query.includes('google') || query.includes('competitive') || query.includes('algorithm')) {
    return `### 📊 (Offline Advisor) I recommend Data Structures & Algorithms (DSA)!

Since you enjoy logical problem-solving, math challenges, or are preparing for technical interviews, DSA is the best route for you.

#### Why DSA?
- **Logic & Efficiency**: Teaches you how to write optimized, high-performing code.
- **Interview Core**: The main topic tested during technical interviews at companies like Google, Meta, and Amazon.
- **Problem Solving**: Develops strong mental models for break-down debugging.

#### Recommended 3-Step Plan:
1. Learn **Big O Notation** (Level 1 in DSA Quest) to analyze code speed.
2. Master linear structures: **Arrays** and **Stacks/Queues** (Level 2).
3. Start practicing simple problems on platforms like LeetCode or GeeksforGeeks!`;
  }

  if (query.includes('data') || query.includes('science') || query.includes('python') || query.includes('pandas') || query.includes('numpy') || query.includes('machine') || query.includes('learn') || query.includes('ml')) {
    return `### 📈 (Offline Advisor) I recommend Data Science!

Since you are interested in analyzing datasets, statistics, machine learning, or Python development, Data Science is the path for you.

#### Why Data Science?
- **High Demand**: One of the fastest-growing fields in technology, used by companies to make data-driven decisions.
- **Insightful Results**: You translate raw numbers into meaningful graphs and predictions.
- **AI Core**: The foundation of modern AI, including large language models and computer vision.

#### Recommended 3-Step Plan:
1. Start with **Python & NumPy Foundations** (Level 1 in Data Science Quest).
2. Learn data manipulation with **Pandas** (Level 2).
3. Try analyzing a public dataset (like a CSV from Kaggle) and plot the results!`;
  }

  if (query.includes('security') || query.includes('cyber') || query.includes('network') || query.includes('linux') || query.includes('crypt') || query.includes('hack') || query.includes('cipher')) {
    return `### 🛡️ (Offline Advisor) I recommend Cybersecurity!

Since you are interested in system architectures, ethical hacking, digital encryption, or secure network communication, Cybersecurity is a great fit.

#### Why Cybersecurity?
- **Critical Mission**: Protects companies, organizations, and individuals against digital threats and hacking attempts.
- **Hands-on OS Work**: You work closely with operating system command lines (Linux) and networks.
- **Fascinating Concepts**: Involves cryptography (ciphers, keys) and offensive/defensive methodologies.

#### Recommended 3-Step Plan:
1. Learn **Linux CLI & Network Basics** (Level 1 in Cybersecurity Quest).
2. Understand web security threats and **OWASP Top 10** (Level 2).
3. Explore simple hacking and scanning tools (like Nmap) on sandbox networks!`;
  }

  return `### 🔍 (Offline Advisor) Domain Guidance

I am running in Offline Mode. Based on your question, here is a general comparison to help you choose:

- **Web Development**: Build visual websites and apps. Start with **Web Dev Quest Level 1**.
- **DSA**: Optimizations and competitive programming interviews. Start with **DSA Quest Level 1**.
- **Data Science**: Analyze data, plot visualizations, and build Machine Learning models. Start with **Data Science Quest Level 1**.
- **Cybersecurity**: Secure networks, learn Linux commands, and try ethical hacking. Start with **Cybersecurity Quest Level 1**.

Tell me what sounds most interesting: **Visual apps, logical puzzles, data analytics, or securing systems?**`;
}

// Offline Mock Flashcards database
function getMockFlashcards(topic) {
  const t = topic.toLowerCase();
  if (t.includes('html') || t.includes('css') || t.includes('layout')) {
    return [
      { term: "Semantic HTML", definition: "HTML tags that convey meaning about their content (e.g., <article>, <header>, <nav>) rather than just presentation." },
      { term: "Flexbox", definition: "A 1D CSS layout model for distributing space and aligning items within a container, adapting dynamically to screen sizes." },
      { term: "CSS Specificity", definition: "The score weight algorithm browsers use to determine which CSS rules apply to an element (Inline style > ID > Class > Tag)." },
      { term: "Media Queries", definition: "A CSS technique used to apply specific styling rules only when certain conditions match, such as viewport width." }
    ];
  }
  if (t.includes('javascript') || t.includes('js') || t.includes('dom')) {
    return [
      { term: "Closure", definition: "A function that retains access to its lexical outer scope even when executed outside that scope." },
      { term: "DOM Manipulation", definition: "The process of using JavaScript to add, remove, or modify elements and attributes in an HTML document dynamically." },
      { term: "Asynchronous JavaScript", definition: "Programming model utilizing Promises and async/await to run long operations (like network requests) without blocking the thread." },
      { term: "Event Bubbling", definition: "The phase where an event triggers on the deepest element first and then propagates upwards through its parent elements." }
    ];
  }
  if (t.includes('react') || t.includes('component')) {
    return [
      { term: "React Props", definition: "Short for properties; read-only parameters passed into a child component by its parent to customize rendering." },
      { term: "React State", definition: "An internal data store local to a component that can change over time, triggering a component re-render when modified." },
      { term: "useEffect Hook", definition: "A React hook used to perform side effects (fetching data, subscriptions, manual DOM changes) in functional components." },
      { term: "Virtual DOM", definition: "A lightweight, in-memory representation of the real DOM that React uses to compute and apply fast UI updates." }
    ];
  }
  if (t.includes('express') || t.includes('node') || t.includes('backend') || t.includes('api')) {
    return [
      { term: "Express Middleware", definition: "Functions executed sequentially in Express request-response cycles, having access to req, res, and next()." },
      { term: "REST API", definition: "Representational State Transfer; an architectural pattern for web services using HTTP verbs (GET, POST, PUT, DELETE) and JSON payloads." },
      { term: "Node.js Event Loop", definition: "The mechanism that allows Node.js to perform non-blocking I/O operations by offloading tasks to the system kernel." },
      { term: "CORS", definition: "Cross-Origin Resource Sharing; a browser security mechanism restricting web apps from requesting resources from a different origin." }
    ];
  }
  if (t.includes('complexity') || t.includes('big o')) {
    return [
      { term: "Big O Notation", definition: "Mathematical notation representing the worst-case time or space complexity of an algorithm as input size grows." },
      { term: "O(1) Complexity", definition: "Constant time complexity, meaning execution time is independent of the size of the input dataset." },
      { term: "O(log N) Complexity", definition: "Logarithmic time complexity, typical of divide-and-conquer algorithms like Binary Search, where input splits in half." },
      { term: "O(N^2) Complexity", definition: "Quadratic time complexity, common in nested loops (like Bubble Sort), scaling exponentially with input size." }
    ];
  }
  if (t.includes('stack') || t.includes('queue')) {
    return [
      { term: "Stack Data Structure", definition: "A linear data structure following Last-In-First-Out (LIFO) protocol. Key operations: push and pop." },
      { term: "Queue Data Structure", definition: "A linear data structure following First-In-First-Out (FIFO) protocol. Key operations: enqueue and dequeue." },
      { term: "Priority Queue", definition: "An abstract data type where each element has a priority, and the element with the highest priority is served first." },
      { term: "Circular Queue", definition: "A queue implementation where the last position connects back to the first position, maximizing memory efficiency." }
    ];
  }
  if (t.includes('recursion')) {
    return [
      { term: "Recursion Base Case", definition: "The condition under which a recursive function stops calling itself, preventing infinite loops and stack overflow." },
      { term: "Recursion Call Stack", definition: "The stack memory allocation used by compilers to track active function calls and their local variables during recursion." },
      { term: "Memoization", definition: "An optimization technique of caching expensive function call results and returning the cached result when same inputs occur." },
      { term: "Call Stack Overflow", definition: "An error when the call stack exceeds its memory limit, typically caused by infinite recursion without a valid base case." }
    ];
  }
  if (t.includes('python') || t.includes('numpy') || t.includes('array')) {
    return [
      { term: "NumPy ndarray", definition: "The core multidimensional array object of NumPy, offering fast, vectorised math operations on homogenous data." },
      { term: "Vectorization", definition: "Performing mathematical operations on entire arrays at once, replacing explicit element-by-element loops in Python." },
      { term: "Broadcasting", definition: "A NumPy mechanism allowing arithmetic operations between arrays of different shapes (e.g., adding scalar to a 2D matrix)." },
      { term: "List Comprehension", definition: "A concise, readable syntax in Python for creating lists based on existing lists or iterables." }
    ];
  }
  if (t.includes('cyber') || t.includes('security') || t.includes('network') || t.includes('linux')) {
    return [
      { term: "OWASP Top 10", definition: "A regularly updated report outlining the most critical security risks to web applications (e.g. SQLi, XSS)." },
      { term: "SQL Injection (SQLi)", definition: "A security vulnerability where attackers inject malicious SQL queries into inputs, compromising database control." },
      { term: "Cross-Site Scripting (XSS)", definition: "An attack where malicious scripts are injected into trusted websites, executing inside a victim's browser context." },
      { term: "Symmetric Encryption", definition: "An encryption method where a single, shared secret key is used both for encrypting and decrypting data." }
    ];
  }
  return [
    { term: "Data Structure", definition: "A specialized format for organizing, processing, retrieving, and storing data in computer memory." },
    { term: "Algorithm", definition: "A step-by-step procedure or set of rules to solve a computational problem or perform a specific task." },
    { term: "API Endpoint", definition: "A specific URL point where an API receives requests and sends responses, interfacing backend systems." },
    { term: "Deployment", definition: "The process of packaging, building, and running software applications on hosting environments for production use." }
  ];
}

// Generate Flashcards via Gemini
export async function generateFlashcards(topic) {
  if (!genAI) {
    return getMockFlashcards(topic);
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are an expert computer science tutor.
      Generate exactly 4 study flashcards testing knowledge on the topic: "${topic}".
      
      Return the output as a valid JSON array of objects. Each object MUST have this exact structure:
      {
        "term": "Brief name or concept (e.g. Flexbox)",
        "definition": "Clear, concise definition (max 2 sentences) explaining the concept simply"
      }
      Do not wrap the JSON in markdown code blocks.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const flashcards = JSON.parse(text);
    if (Array.isArray(flashcards) && flashcards.length === 4) {
      return flashcards;
    }
    throw new Error('Invalid flashcards count or format');
  } catch (error) {
    console.error('Error generating flashcards from Gemini:', error);
    return getMockFlashcards(topic);
  }
}

// Offline Mock Interviewer Reply
function getMockInterviewReply(historyMessages, role, difficulty) {
  if (historyMessages.length <= 1) {
    return `Hello! I am your Technical Interviewer for the **${role}** position. Today, we will conduct a screening at the **${difficulty}** level.

To start, could you please describe how you would design a RESTful API structure for a simple user registration system? Include HTTP methods, endpoints, and status codes.`;
  }

  const userMessages = historyMessages.filter(m => m.role === 'student');
  if (userMessages.length === 1) {
    return `Understood. Thanks for detailing the REST endpoints. Let's shift our focus to data integrity and algorithms.

For your second question: In **${role}**, how do you evaluate the difference in performance (specifically time complexity) between searching an element in an unsorted list versus a Binary Search Tree (BST)? Under what conditions does the BST performance degrade?`;
  }
  
  if (userMessages.length === 2) {
    return `Good point about tree balance and worst-case O(N) complexity. Let's move to system reliability.

For your third question: How do you handle exceptions or edge cases in your code? For example, if a database connection times out or a client sends an invalid payload, what architectural patterns do you apply to keep the service healthy?`;
  }

  return `Thank you for sharing your thoughts on that. I have gathered enough information for this round.

Please click the **"Finish & Grade"** button below so I can evaluate your answers and compile your score report card.`;
}

// Offline Mock Interviewer Grading
function getMockInterviewGrade(historyMessages, role) {
  let totalWords = 0;
  const userMessages = historyMessages.filter(m => m.role === 'student');
  userMessages.forEach(m => {
    totalWords += m.text.split(/\s+/).length;
  });

  let score = 65;
  if (totalWords > 150) score = 88;
  else if (totalWords > 80) score = 78;
  else if (totalWords > 30) score = 70;

  let feedback = "";
  let strengths = [];
  let improvements = [];

  if (score >= 85) {
    feedback = `Excellent performance! You demonstrated depth of knowledge in ${role} and explained structural choices well. Your explanations are concise yet technically sound.`;
    strengths = ["Strong understanding of architectural protocols", "Clear communication of time complexities", "Resilient error handling strategies"];
    improvements = ["Explore edge cases in high-throughput database systems", "Explain potential downsides of selected structures"];
  } else if (score >= 75) {
    feedback = `Good general knowledge in ${role}, though some explanations could be more detailed. You have a solid handle on HTTP states and basic searching logic.`;
    strengths = ["Solid baseline knowledge", "Understands differences in complexity levels", "Proper status code conventions"];
    improvements = ["Detail your strategies for error recovery in backend operations", "Use concrete coding examples where applicable"];
  } else {
    feedback = `You have a basic understanding of the fundamentals of ${role}, but need to spend more time studying core concepts to pass a technical interview.`;
    strengths = ["Enthusiastic attitude", "Aware of REST conventions"];
    improvements = ["Study Time and Space Big O complexities in depth", "Review how status codes should map to specific errors", "Explain concepts using structured steps"];
  }

  return {
    score,
    feedback,
    strengths,
    improvements
  };
}

// Interactive AI Interview Handler via Gemini
export async function getInterviewResponse(historyMessages, role, difficulty) {
  if (!genAI) {
    return getMockInterviewReply(historyMessages, role, difficulty);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    
    const chatHistory = [];
    const systemPrompt = `
      You are "InterviewBot", a technical interviewer conducting a technical screening for a **${role}** position.
      The candidate has selected difficulty: **${difficulty}**.
      
      Conduct the interview step-by-step:
      1. Ask one question at a time.
      2. Keep questions technical, specific, and relevant to the role.
      3. Acknowledge their response briefly and ask the next question or a follow-up.
      4. After 3 questions are asked and answered, tell the user that the interview is complete and they should click "Finish & Grade" to compile their scorecard.
      5. Keep your answers concise, realistic, and professional.
    `;

    for (let i = 0; i < historyMessages.length - 1; i++) {
      const msg = historyMessages[i];
      chatHistory.push({
        role: msg.role === 'student' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      });
    }

    const activeChat = model.startChat({
      history: chatHistory,
      systemInstruction: systemPrompt
    });

    const lastMsg = historyMessages[historyMessages.length - 1];
    const userPrompt = lastMsg ? lastMsg.text : "Start the interview, greeting me and asking the first question.";

    const result = await activeChat.sendMessage(userPrompt);
    return result.response.text();
  } catch (error) {
    console.error('Error in getInterviewResponse:', error);
    return getMockInterviewReply(historyMessages, role, difficulty);
  }
}

// Interview Grading via Gemini
export async function gradeInterview(historyMessages, role) {
  if (!genAI) {
    return getMockInterviewGrade(historyMessages, role);
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: "application/json" }
    });

    const conversationTranscript = historyMessages
      .filter(m => m.text)
      .map(m => `${m.role === 'student' ? 'Candidate' : 'Interviewer'}: ${m.text}`)
      .join('\n');

    const prompt = `
      You are a senior engineering manager. Review the following technical interview transcript for a **${role}** role:
      
      ---TRANSCRIPT---
      ${conversationTranscript}
      ----------------
      
      Evaluate the candidate's performance. Return a valid JSON object with this exact structure:
      {
        "score": 85, // integer score from 0 to 100
        "feedback": "A summary of their performance...",
        "strengths": ["Strength 1", "Strength 2"],
        "improvements": ["Area to improve 1", "Area to improve 2"]
      }
      
      Keep feedback constructive and detailed. Do not wrap JSON in markdown blocks.
    `;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    return JSON.parse(text);
  } catch (error) {
    console.error('Error in gradeInterview:', error);
    return getMockInterviewGrade(historyMessages, role);
  }
}



