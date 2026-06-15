import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateQuiz, getTutorResponse, getEduBotResponse, getDomainGuidance, generateFlashcards, getInterviewResponse, gradeInterview } from './server/services/gemini-service.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'server', 'data', 'db.json');

// Helper to read database
async function readDB() {
  try {
    const data = await fs.readFile(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading local db.json:', error);
    return null;
  }
}

// Helper to write database
async function writeDB(data) {
  try {
    await fs.writeFile(dbPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Error writing to local db.json:', error);
    return false;
  }
}

// Helper to log a student activity
async function logActivity(db, type, description) {
  const newActivity = {
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    type,
    description
  };
  db.activities.unshift(newActivity);
  // Keep last 30 activities
  if (db.activities.length > 30) {
    db.activities = db.activities.slice(0, 30);
  }
  return newActivity;
}

// Check and update login streak
async function checkStreak(db) {
  const todayStr = new Date().toISOString().split('T')[0];
  const lastActiveStr = db.student.lastActive;

  if (lastActiveStr === todayStr) {
    return; // Already active today, streak remains the same
  }

  const lastActive = new Date(lastActiveStr);
  const today = new Date(todayStr);
  const diffTime = Math.abs(today - lastActive);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    db.student.streak += 1;
    await logActivity(db, 'streak', `Streak active! Day ${db.student.streak} in a row.`);
  } else if (diffDays > 1) {
    if (db.student.streakFreezes && db.student.streakFreezes > 0) {
      db.student.streakFreezes -= 1;
      await logActivity(db, 'streak', `Streak Freeze consumed! Protected your ${db.student.streak}-day streak.`);
    } else {
      db.student.streak = 1;
      await logActivity(db, 'streak', `Streak reset! Started a new 1-day learning streak.`);
    }
  }
  db.student.lastActive = todayStr;
}

// Helper to record XP history for the heatmap
async function recordXPEarned(db, amount) {
  if (amount <= 0) return;
  const todayStr = new Date().toISOString().split('T')[0];
  db.student.xpHistory = db.student.xpHistory || [];
  let record = db.student.xpHistory.find(r => r.date === todayStr);
  if (record) {
    record.xpEarned = (record.xpEarned || 0) + amount;
  } else {
    db.student.xpHistory.push({ date: todayStr, xpEarned: amount });
  }
  // Keep last 100 history records to avoid bloating db
  if (db.student.xpHistory.length > 100) {
    db.student.xpHistory.shift();
  }
}

// Route: Get student profile and activity log
app.get('/api/student', async (req, res) => {
  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });

  // Update streak if active today
  await checkStreak(db);
  await writeDB(db);

  res.json({
    student: db.student,
    activities: db.activities
  });
});

// Route: Reset student profile
app.post('/api/student/reset', async (req, res) => {
  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });

  const todayStr = new Date().toISOString().split('T')[0];
  db.student = {
    name: "Student Explorer",
    level: 1,
    xp: 0,
    streak: 1,
    lastActive: todayStr,
    badges: [],
    completedLevels: {
      "web-dev": [],
      "dsa": [],
      "data-science": [],
      "cybersecurity": []
    },
    completedBounties: [],
    streakFreezes: 0,
    inventory: [],
    xpHistory: [
      {
        "date": todayStr,
        "xpEarned": 0
      }
    ]
  };

  db.quests = [
    {
      "id": "q1",
      "text": "Complete a Quiz Level",
      "rewardXP": 50,
      "completed": false
    },
    {
      "id": "q2",
      "text": "Review concepts inside a level",
      "rewardXP": 30,
      "completed": false
    },
    {
      "id": "q3",
      "text": "Have a conversation with EduBot",
      "rewardXP": 40,
      "completed": false
    }
  ];

  db.activities = [
    {
      id: `act-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: "milestone",
      description: "Reset profile. Adventure restarted!"
    }
  ];

  await writeDB(db);
  res.json({ student: db.student, activities: db.activities });
});

// Route: Get roadmaps list
app.get('/api/roadmaps', async (req, res) => {
  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });
  res.json(db.roadmaps);
});

// Route: Get dynamic quiz from Gemini
app.post('/api/quiz/generate', async (req, res) => {
  const { roadmap, levelId, topicName } = req.body;
  if (!roadmap || !levelId || !topicName) {
    return res.status(400).json({ error: 'Missing quiz details' });
  }

  console.log(`Generating quiz for ${roadmap} Level ${levelId}: ${topicName}`);
  const questions = await generateQuiz(topicName);
  res.json({ questions });
});

// Route: Submit Quiz and update level
app.post('/api/quiz/submit', async (req, res) => {
  const { roadmap, levelId, score, totalQuestions } = req.body;
  if (roadmap === undefined || levelId === undefined || score === undefined) {
    return res.status(400).json({ error: 'Missing submission details' });
  }

  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });

  const roadmapLevels = db.roadmaps[roadmap];
  if (!roadmapLevels) {
    return res.status(404).json({ error: 'Roadmap not found' });
  }

  const currentLevelInfo = roadmapLevels.find(l => l.id === parseInt(levelId));
  if (!currentLevelInfo) {
    return res.status(404).json({ error: 'Level not found' });
  }

  const passed = score >= 2; // Pass criteria: 2 out of 3 correct
  const wasCompleted = db.student.completedLevels[roadmap].includes(parseInt(levelId));

  let xpEarned = 0;
  let badgeEarned = null;

  if (passed && !wasCompleted) {
    // Add level to completed list
    db.student.completedLevels[roadmap].push(parseInt(levelId));

    // Award XP
    xpEarned = currentLevelInfo.xpReward;
    db.student.xp += xpEarned;
    await recordXPEarned(db, xpEarned);

    // Award Badge
    badgeEarned = currentLevelInfo.badgeReward;
    if (badgeEarned && !db.student.badges.includes(badgeEarned)) {
      db.student.badges.push(badgeEarned);
    }

    // Update overall Student Level (every 500 XP = 1 Level)
    const newStudentLevel = Math.floor(db.student.xp / 500) + 1;
    const levelUpOccurred = newStudentLevel > db.student.level;
    db.student.level = newStudentLevel;

    // Log activities
    await logActivity(
      db, 
      'milestone', 
      `Passed Level ${levelId} of ${roadmap === 'web-dev' ? 'Web Development' : 'DSA'}! (+${xpEarned} XP)`
    );

    if (badgeEarned) {
      await logActivity(db, 'reward', `Earned the badge: "${badgeEarned}"!`);
    }

    if (levelUpOccurred) {
      await logActivity(db, 'milestone', `Leveled up! You are now Level ${newStudentLevel}! 🎉`);
    }
  }

  await writeDB(db);

  res.json({
    passed,
    xpEarned,
    badgeEarned,
    student: db.student,
    activities: db.activities
  });
});

// Route: AI Tutor chat messages
app.post('/api/chat', async (req, res) => {
  const { message, roadmap } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });

  const responseText = await getTutorResponse(message, db.student, roadmap || 'general');
  res.json({ reply: responseText });
});

// Route: Get all chat sessions
app.get('/api/chats', async (req, res) => {
  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });
  
  db.chats = db.chats || [];
  res.json(db.chats);
});

// Route: Create a new chat session
app.post('/api/chats', async (req, res) => {
  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });
  
  db.chats = db.chats || [];
  const newChat = {
    id: `chat-${Date.now()}`,
    title: 'New Chat',
    messages: [
      {
        role: 'ai',
        text: 'Hello! I am EduBot. I can help explain concepts, answer questions, or study together. How can I help you today?',
        timestamp: new Date().toISOString()
      }
    ]
  };
  
  db.chats.push(newChat);
  await writeDB(db);
  res.json(newChat);
});

// Route: Delete a chat session
app.delete('/api/chats/:id', async (req, res) => {
  const { id } = req.params;
  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });
  
  db.chats = db.chats || [];
  db.chats = db.chats.filter(c => c.id !== id);
  await writeDB(db);
  res.json({ success: true });
});

// Route: Send message to a chat session and get AI reply
app.post('/api/chats/:id/messages', async (req, res) => {
  const { id } = req.params;
  const { message, attachment } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });
  
  db.chats = db.chats || [];
  const chat = db.chats.find(c => c.id === id);
  if (!chat) {
    return res.status(404).json({ error: 'Chat session not found' });
  }

  // Add student message
  const studentMsg = {
    role: 'student',
    text: message,
    timestamp: new Date().toISOString(),
    attachment: attachment || null
  };
  chat.messages.push(studentMsg);

  // If this is the first message (meaning only 1 bot message and 1 user message), update title
  if (chat.title === 'New Chat' || chat.title === 'Untitled Chat') {
    chat.title = message.length > 25 ? message.substring(0, 25) + '...' : message;
  }

  // Get response from Gemini
  const responseText = await getEduBotResponse(chat.messages);

  // Add AI message
  const aiMsg = {
    role: 'ai',
    text: responseText,
    timestamp: new Date().toISOString()
  };
  chat.messages.push(aiMsg);

  await writeDB(db);
  res.json(chat);
});

// Route: AI Domain guidance advisor
app.post('/api/advisor', async (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  console.log(`Getting domain guidance for: "${message}"`);
  const responseText = await getDomainGuidance(message);
  res.json({ reply: responseText });
});

// Route: Get daily quests
app.get('/api/quests', async (req, res) => {
  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });
  
  db.quests = db.quests || [];
  res.json(db.quests);
});

// Route: Complete a daily quest
app.post('/api/quests/complete', async (req, res) => {
  const { questId } = req.body;
  if (!questId) {
    return res.status(400).json({ error: 'Quest ID is required' });
  }

  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });

  db.quests = db.quests || [];
  const quest = db.quests.find(q => q.id === questId);
  if (!quest) {
    return res.status(404).json({ error: 'Quest not found' });
  }

  if (quest.completed) {
    return res.json({ success: false, message: 'Quest already completed today', student: db.student });
  }

  quest.completed = true;
  const xpReward = quest.rewardXP || 30;
  db.student.xp += xpReward;
  await recordXPEarned(db, xpReward);

  // Update level
  const newStudentLevel = Math.floor(db.student.xp / 500) + 1;
  const levelUpOccurred = newStudentLevel > db.student.level;
  db.student.level = newStudentLevel;

  await logActivity(db, 'milestone', `Completed Daily Quest: "${quest.text}"! (+${xpReward} XP)`);
  if (levelUpOccurred) {
    await logActivity(db, 'milestone', `Leveled up! You are now Level ${newStudentLevel}! 🎉`);
  }

  await writeDB(db);
  res.json({
    success: true,
    student: db.student,
    quests: db.quests,
    activities: db.activities
  });
});

// Route: Buy from Streak shop
app.post('/api/store/buy', async (req, res) => {
  const { item } = req.body;
  if (!item) {
    return res.status(400).json({ error: 'Item is required' });
  }

  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });

  if (item === 'streak-freeze') {
    const cost = 300;
    if (db.student.xp < cost) {
      return res.status(400).json({ error: 'Insufficient XP. Need 300 XP.' });
    }
    
    db.student.xp -= cost;
    db.student.streakFreezes = (db.student.streakFreezes || 0) + 1;
    
    // Adjust level down if XP falls (we calculate level = floor(xp/500) + 1)
    const newStudentLevel = Math.max(1, Math.floor(db.student.xp / 500) + 1);
    db.student.level = newStudentLevel;

    await logActivity(db, 'reward', `Bought a Streak Freeze for ${cost} XP!`);
    await writeDB(db);
    
    return res.json({
      success: true,
      student: db.student,
      activities: db.activities
    });
  }

  res.status(400).json({ error: 'Unknown item' });
});

// Route: Generate level-specific flashcards
app.post('/api/flashcards/generate', async (req, res) => {
  const { topicName } = req.body;
  if (!topicName) {
    return res.status(400).json({ error: 'Topic Name is required' });
  }

  console.log(`Generating flashcards for topic: "${topicName}"`);
  const cards = await generateFlashcards(topicName);
  res.json({ cards });
});

// Route: Continue AI technical interview
app.post('/api/interview/chat', async (req, res) => {
  const { messages, role, difficulty } = req.body;
  if (!role || !difficulty) {
    return res.status(400).json({ error: 'Role and difficulty are required' });
  }

  const history = messages || [];
  const reply = await getInterviewResponse(history, role, difficulty);
  res.json({ reply });
});

// Route: Grade AI technical interview
app.post('/api/interview/grade', async (req, res) => {
  const { messages, role } = req.body;
  if (!role || !messages) {
    return res.status(400).json({ error: 'Messages and role are required' });
  }

  const result = await gradeInterview(messages, role);
  
  // Award XP if completed with decent effort
  const db = await readDB();
  if (db) {
    const xpReward = 100;
    db.student.xp += xpReward;
    await recordXPEarned(db, xpReward);
    
    // Update level
    const newStudentLevel = Math.floor(db.student.xp / 500) + 1;
    const levelUpOccurred = newStudentLevel > db.student.level;
    db.student.level = newStudentLevel;

    await logActivity(db, 'milestone', `Completed a ${role} Mock Interview! (+${xpReward} XP)`);
    if (levelUpOccurred) {
      await logActivity(db, 'milestone', `Leveled up! You are now Level ${newStudentLevel}! 🎉`);
    }
    
    await writeDB(db);
    result.student = db.student;
    result.activities = db.activities;
  }

  res.json(result);
});

// Route: Get active bug bounties
app.get('/api/bounties', async (req, res) => {
  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });

  db.bounties = db.bounties || [];
  
  // Make sure student has completedBounties list
  db.student.completedBounties = db.student.completedBounties || [];
  
  // Return bounties with status relative to current student
  const normalizedBounties = db.bounties.map(b => ({
    ...b,
    claimed: db.student.completedBounties.includes(b.id)
  }));
  
  res.json(normalizedBounties);
});

// Route: Submit Bug Bounty report
app.post('/api/bounties/submit', async (req, res) => {
  const { bountyId, selectedLine, selectedCategory, proposedFix } = req.body;
  if (!bountyId || selectedLine === undefined || !selectedCategory || !proposedFix) {
    return res.status(400).json({ error: 'Missing report details' });
  }

  const db = await readDB();
  if (!db) return res.status(500).json({ error: 'Database read failed' });

  db.bounties = db.bounties || [];
  const bounty = db.bounties.find(b => b.id === bountyId);
  if (!bounty) {
    return res.status(404).json({ error: 'Bounty not found' });
  }

  db.student.completedBounties = db.student.completedBounties || [];
  if (db.student.completedBounties.includes(bountyId)) {
    return res.status(400).json({ error: 'Bounty already claimed by student' });
  }

  // Validate report audit correctness
  const lineMatch = parseInt(selectedLine) === bounty.correctLine;
  const categoryMatch = selectedCategory.toLowerCase() === bounty.correctCategory.toLowerCase();
  const fixEntered = proposedFix.trim().length > 5;

  if (lineMatch && categoryMatch && fixEntered) {
    // Audit Passed!
    db.student.completedBounties.push(bountyId);
    
    // XP reward
    const xpReward = bounty.bountyXP || 100;
    db.student.xp += xpReward;
    await recordXPEarned(db, xpReward);

    // Update level
    const newStudentLevel = Math.floor(db.student.xp / 500) + 1;
    const levelUpOccurred = newStudentLevel > db.student.level;
    db.student.level = newStudentLevel;

    // Check for audit milestone badges
    db.student.badges = db.student.badges || [];
    const count = db.student.completedBounties.length;
    let badgeEarned = null;

    if (count === 1 && !db.student.badges.includes("Bug Bounty Hunter")) {
      badgeEarned = "Bug Bounty Hunter";
      db.student.badges.push(badgeEarned);
    } else if (count === 3 && !db.student.badges.includes("SecOps Auditor")) {
      badgeEarned = "SecOps Auditor";
      db.student.badges.push(badgeEarned);
    } else if (count === 4 && !db.student.badges.includes("Zero-Day Slayer")) {
      badgeEarned = "Zero-Day Slayer";
      db.student.badges.push(badgeEarned);
    }

    await logActivity(db, 'reward', `Audit success! Found bug in "${bounty.title}". (+${xpReward} XP)`);
    if (badgeEarned) {
      await logActivity(db, 'reward', `Earned audit badge: "${badgeEarned}"!`);
    }
    if (levelUpOccurred) {
      await logActivity(db, 'milestone', `Leveled up! You are now Level ${newStudentLevel}! 🎉`);
    }

    await writeDB(db);

    return res.json({
      success: true,
      student: db.student,
      activities: db.activities,
      message: `Bounty claimed! You identified the bug correctly on line ${selectedLine}. +${xpReward} XP rewarded.`
    });
  } else {
    // Audit Failed
    let errorMsg = "Audit report rejected. ";
    if (!lineMatch) {
      errorMsg += "The selected line number is not the root cause of the vulnerability. ";
    } else if (!categoryMatch) {
      errorMsg += "The bug classification category is incorrect. ";
    } else {
      errorMsg += "Please write a more detailed proposed fix (more than 5 characters). ";
    }
    return res.json({
      success: false,
      error: errorMsg,
      hint: bounty.hint
    });
  }
});

// Serve frontend in production environment
const frontendBuildPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(frontendBuildPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`EduQuest server is running on http://localhost:${PORT}`);
});
