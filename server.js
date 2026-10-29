const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "pulseboard-data.json");

function emptyDB() {
  return { users: [], posts: [], comments: [], likes: [], follows: [], nextUserId: 1, nextPostId: 1, nextCommentId: 1 };
}
function loadDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const fresh = emptyDB();
      fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
      return fresh;
    }
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
    return { ...emptyDB(), ...parsed };
  } catch (error) {
    console.error("Could not read database file:", error.message);
    return emptyDB();
  }
}
let db = loadDB();
function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}
function findUser(id) { return db.users.find(u => u.id === Number(id)); }
function findByUsername(username) { return db.users.find(u => u.username === String(username || "").trim().toLowerCase().replace(/^@/, "")); }
function requireAuth(req, res, next) {
  if (!req.session.userId || !findUser(req.session.userId)) return res.status(401).json({ error: "Please log in first." });
  next();
}
function postPayload(postId, viewerId) {
  const p = db.posts.find(post => post.id === Number(postId));
  if (!p) return null;
  const u = findUser(p.userId);
  if (!u) return null;
  const comments = db.comments.filter(c => c.postId === p.id).map(c => {
    const author = findUser(c.userId);
    return author ? { id:c.id, content:c.content, created_at:c.created_at, name:author.name, username:author.username, avatar:author.avatar } : null;
  }).filter(Boolean);
  return {
    id:p.id, content:p.content, mood:p.mood, created_at:p.created_at,
    user_id:u.id, name:u.name, username:u.username, avatar:u.avatar, bio:u.bio,
    like_count:db.likes.filter(l => l.postId === p.id).length,
    comment_count:comments.length,
    liked:db.likes.some(l => l.postId === p.id && l.userId === Number(viewerId)),
    comments
  };
}
app.use(express.json({ limit: "30kb" }));
app.use(session({
  secret: process.env.SESSION_SECRET || "change-this-development-secret",
  resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/me", (req, res) => res.json({ user: publicUser(findUser(req.session.userId)) }));

app.post("/api/register", (req, res) => {
  const { name, username, password } = req.body || {};
  if (!name?.trim() || !username?.trim() || !password) return res.status(400).json({ error: "Name, username and password are required." });
  const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) return res.status(400).json({ error: "Username must be 3–20 characters (letters, numbers or _)." });
  if (password.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters." });
  if (findByUsername(cleanUsername)) return res.status(409).json({ error: "That username is already taken." });
  const user = { id:db.nextUserId++, name:name.trim().slice(0,50), username:cleanUsername,
    passwordHash:bcrypt.hashSync(password, 10), bio:"Collecting little moments.", avatar:"✨", created_at:new Date().toISOString() };
  db.users.push(user); saveDB(); req.session.userId = user.id;
  res.json({ user:publicUser(user) });
});

app.post("/api/login", (req, res) => {
  const user = findByUsername(req.body?.username);
  if (!user || !bcrypt.compareSync(req.body?.password || "", user.passwordHash)) return res.status(401).json({ error:"Incorrect username or password." });
  req.session.userId = user.id; res.json({ user:publicUser(user) });
});
app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok:true })));

app.get("/api/posts", (req, res) => {
  const viewerId = req.session.userId || -1;
  res.json({ posts:db.posts.slice().sort((a,b) => b.id-a.id).slice(0,100).map(p => postPayload(p.id, viewerId)).filter(Boolean) });
});
app.post("/api/posts", requireAuth, (req, res) => {
  const content = String(req.body?.content || "").trim();
  const mood = String(req.body?.mood || "🌱");
  if (!content) return res.status(400).json({ error:"Write something before posting." });
  if (content.length > 500) return res.status(400).json({ error:"Posts can be up to 500 characters." });
  const post = { id:db.nextPostId++, userId:req.session.userId, content,
    mood:["🌱","✨","🔥","💭","🎯"].includes(mood) ? mood : "🌱", created_at:new Date().toISOString() };
  db.posts.push(post); saveDB();
  res.status(201).json({ post:postPayload(post.id, req.session.userId) });
});
app.post("/api/posts/:id/comments", requireAuth, (req, res) => {
  const postId = Number(req.params.id), content = String(req.body?.content || "").trim();
  if (!db.posts.some(p => p.id === postId)) return res.status(404).json({ error:"Post not found." });
  if (!content || content.length > 240) return res.status(400).json({ error:"Comment must be 1–240 characters." });
  db.comments.push({ id:db.nextCommentId++, postId, userId:req.session.userId, content, created_at:new Date().toISOString() });
  saveDB(); res.status(201).json({ post:postPayload(postId, req.session.userId) });
});
app.post("/api/posts/:id/like", requireAuth, (req, res) => {
  const postId = Number(req.params.id);
  if (!db.posts.some(p => p.id === postId)) return res.status(404).json({ error:"Post not found." });
  const i = db.likes.findIndex(l => l.userId === req.session.userId && l.postId === postId);
  if (i >= 0) db.likes.splice(i, 1); else db.likes.push({ userId:req.session.userId, postId });
  saveDB(); res.json({ post:postPayload(postId, req.session.userId) });
});
app.post("/api/users/:id/follow", requireAuth, (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.session.userId) return res.status(400).json({ error:"You cannot follow yourself." });
  if (!findUser(targetId)) return res.status(404).json({ error:"User not found." });
  const i = db.follows.findIndex(f => f.followerId === req.session.userId && f.followingId === targetId);
  if (i >= 0) db.follows.splice(i, 1); else db.follows.push({ followerId:req.session.userId, followingId:targetId });
  saveDB(); res.json({ following:i < 0 });
});
app.get("/api/users/:username", (req, res) => {
  const user = findByUsername(req.params.username);
  if (!user) return res.status(404).json({ error:"User not found." });
  const viewerId = req.session.userId || -1;
  const posts = db.posts.filter(p => p.userId === user.id).sort((a,b) => b.id-a.id).map(p => postPayload(p.id, viewerId)).filter(Boolean);
  res.json({
    user:publicUser(user), posts,
    followers:db.follows.filter(f => f.followingId === user.id).length,
    following:db.follows.filter(f => f.followerId === user.id).length,
    isFollowing:db.follows.some(f => f.followerId === viewerId && f.followingId === user.id)
  });
});
app.patch("/api/me", requireAuth, (req, res) => {
  const user = findUser(req.session.userId);
  user.bio = String(req.body?.bio ?? "").trim().slice(0,120);
  const avatar = String(req.body?.avatar ?? "✨");
  user.avatar = ["✨","🌻","🪴","🌙","🦋","🎧"].includes(avatar) ? avatar : "✨";
  saveDB(); res.json({ user:publicUser(user) });
});
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`PulseBoard is running at http://localhost:${PORT}`));
