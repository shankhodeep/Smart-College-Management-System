const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "db.json");
const PUBLIC_DIR = path.join(__dirname, "..", "public");

app.use(express.json({ limit: "100kb" }));
app.use(express.static(PUBLIC_DIR));

function readDatabase() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.error("Could not read database file:", error.message);
    throw new Error("Database could not be read. Check backend/data/db.json.");
  }
}

function writeDatabase(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function makeId(prefix) {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Smart College Management System API is running." });
});

app.get("/api/dashboard", (req, res) => {
  try {
    const db = readDatabase();
    const totalStudents = db.students.length;
    const averageAttendance = totalStudents
      ? Math.round(db.students.reduce((sum, student) => sum + Number(student.attendance || 0), 0) / totalStudents)
      : 0;
    const averageMarks = totalStudents
      ? Math.round(db.students.reduce((sum, student) => sum + Number(student.marks || 0), 0) / totalStudents)
      : 0;

    res.json({
      totalStudents,
      averageAttendance,
      averageMarks,
      totalNotices: db.notices.length,
      students: db.students,
      notices: db.notices,
      schedule: db.schedule
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/students", (req, res) => {
  try {
    res.json(readDatabase().students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/students", (req, res) => {
  const { name, email, course, year } = req.body || {};
  if (![name, email, course, year].every(value => typeof value === "string" && value.trim())) {
    return res.status(400).json({ error: "Please provide name, email, course, and year." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  try {
    const db = readDatabase();
    const duplicate = db.students.some(student => student.email.toLowerCase() === email.trim().toLowerCase());
    if (duplicate) return res.status(409).json({ error: "A student with this email already exists." });

    const student = {
      id: makeId("STU"),
      name: name.trim(),
      email: email.trim(),
      course: course.trim(),
      year: year.trim(),
      attendance: 0,
      marks: 0
    };
    db.students.push(student);
    writeDatabase(db);
    res.status(201).json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/students/:id/attendance", (req, res) => {
  const attendance = Number(req.body && req.body.attendance);
  if (!Number.isFinite(attendance) || attendance < 0 || attendance > 100) {
    return res.status(400).json({ error: "Attendance must be a number from 0 to 100." });
  }

  try {
    const db = readDatabase();
    const student = db.students.find(item => item.id === req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found." });
    student.attendance = attendance;
    writeDatabase(db);
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch("/api/students/:id/marks", (req, res) => {
  const marks = Number(req.body && req.body.marks);
  if (!Number.isFinite(marks) || marks < 0 || marks > 100) {
    return res.status(400).json({ error: "Marks must be a number from 0 to 100." });
  }

  try {
    const db = readDatabase();
    const student = db.students.find(item => item.id === req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found." });
    student.marks = marks;
    writeDatabase(db);
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/notices", (req, res) => {
  try {
    res.json(readDatabase().notices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/notices", (req, res) => {
  const { title, message } = req.body || {};
  if (![title, message].every(value => typeof value === "string" && value.trim())) {
    return res.status(400).json({ error: "Please provide both a notice title and message." });
  }

  try {
    const db = readDatabase();
    const notice = {
      id: makeId("NOTICE"),
      title: title.trim(),
      message: message.trim(),
      date: new Date().toISOString().slice(0, 10)
    };
    db.notices.unshift(notice);
    writeDatabase(db);
    res.status(201).json(notice);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/schedule", (req, res) => {
  try {
    res.json(readDatabase().schedule);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// For a simple single-service deployment, Express also serves the frontend.
app.get("*", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Unexpected server error." });
});

app.listen(PORT, () => {
  console.log(`Smart College Management System is running at http://localhost:${PORT}`);
});