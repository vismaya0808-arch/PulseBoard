const $ = (s) => document.querySelector(s);
const state = { user: null, view: "feed", authMode: "login", posts: [], people: [], profile: null };
const avatars = ["✨", "🌻", "🪴", "🌙", "🦋", "🎧"];
let toastTimer;

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function toast(message) {
  const el = $("#toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function timeAgo(dateString) {
  const d = new Date(dateString.replace(" ", "T") + (dateString.includes("Z") ? "" : "Z"));
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (mins < 1) return "just now"; if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}
function setView(view) {
  state.view = view;
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  $("#authPanel").classList.add("hidden"); $("#discoverBanner").classList.toggle("hidden", view !== "discover");
  $("#profilePanel").classList.add("hidden");
  $("#pageTitle").textContent = view === "discover" ? "Find your people" : view === "profile" ? "Your little corner" : "The little things feed";
  $("#eyebrow").textContent = view === "discover" ? "MEET YOUR COMMUNITY" : view === "profile" ? "A SPACE THAT’S YOURS" : "YOUR DAILY DOSE OF GOOD";
  $("#feedHeading").innerHTML = view === "discover" ? 'People making things happen <span class="sparkle">✦</span>' : view === "profile" ? 'Your posts <span class="sparkle">✦</span>' : 'Fresh from the community <span class="sparkle">✦</span>';
  $("#feedSubheading").textContent = view === "discover" ? "Follow a few people and make this feed feel like you." : view === "profile" ? "Every small step deserves a place." : "Real people. Real progress. No perfect lives required.";
  $("#composer").classList.toggle("hidden", !state.user || view !== "feed");
  if (view === "profile" && state.user) loadProfile(state.user.username);
  else if (view === "discover") loadPeople();
  else loadPosts();
}
function updateUserUI() {
  const u = state.user;
  $("#authButton").textContent = u ? "Log out" : "Log in";
  $("#sidebarUser").innerHTML = u
    ? `<div class="avatar">${esc(u.avatar)}</div><div><strong>${esc(u.name)}</strong><small>@${esc(u.username)}</small></div>`
    : `<div class="avatar">✳</div><div><strong>Guest mode</strong><small>Join the conversation</small></div>`;
  $("#composerAvatar").textContent = u?.avatar || "✳";
  $("#composer").classList.toggle("hidden", !u || state.view !== "feed");
}
function renderPosts(posts) {
  state.posts = posts || [];
  $("#feed").innerHTML = state.posts.map(post => `
    <article class="post-card" data-post="${post.id}">
      <div class="post-head"><div class="avatar">${esc(post.avatar)}</div><div class="post-user"><strong>${esc(post.name)} <span>@${esc(post.username)}</span></strong><small>${esc(timeAgo(post.created_at))}</small></div><span class="mood-pill">${esc(post.mood)}</span></div>
      <p class="post-content">${esc(post.content)}</p><div class="post-divider"></div>
      <div class="post-actions">
        <button class="action-button ${post.liked ? "liked" : ""}" data-action="like" data-id="${post.id}"><span>${post.liked ? "♥" : "♡"}</span>${post.like_count} ${post.like_count === 1 ? "cheer" : "cheers"}</button>
        <button class="action-button" data-action="comments" data-id="${post.id}"><span>▢</span>${post.comment_count} comments</button>
        <button class="action-button" data-action="profile" data-username="${esc(post.username)}"><span>↗</span>Profile</button>
      </div>
      <div class="comments ${post.comments.length ? "" : "hidden"}">${post.comments.map(c => `<div class="comment"><div class="mini-avatar">${esc(c.avatar)}</div><div><strong>${esc(c.name)}</strong>${esc(c.content)}</div></div>`).join("")}</div>
      <form class="comment-form ${state.user ? "" : "hidden"}" data-comment="${post.id}"><input name="comment" maxlength="240" placeholder="Leave a kind thought…" required><button type="submit">Send ↗</button></form>
    </article>`).join("");
  $("#emptyState").classList.toggle("hidden", state.posts.length > 0);
}
async function loadPosts() {
  try {
    const { posts } = await api("/api/posts");
    let filtered = posts;
    if (state.view === "profile" && state.profile) filtered = posts.filter(p => p.user_id === state.profile.id);
    renderPosts(filtered);
  } catch (e) { toast(e.message); }
}
async function loadPeople() {
  try {
    const { posts } = await api("/api/posts");
    const map = new Map();
    posts.forEach(p => { if (!map.has(p.user_id)) map.set(p.user_id, {id:p.user_id,name:p.name,username:p.username,avatar:p.avatar,bio:p.bio}); });
    if (state.user) map.delete(state.user.id);
    const people = [...map.values()].slice(0, 6);
    $("#peopleList").innerHTML = people.length ? people.map(p => `<div class="person"><div class="avatar">${esc(p.avatar)}</div><div class="person-info"><strong>${esc(p.name)}</strong><small>@${esc(p.username)}</small></div><button class="follow-button" data-action="follow" data-id="${p.id}">+ Follow</button></div>`).join("") : `<p class="muted small">New faces will show up here as people join and post.</p>`;
    renderPosts(posts);
  } catch(e) { toast(e.message); }
}
async function loadProfile(username) {
  try {
    const data = await api(`/api/users/${encodeURIComponent(username)}`);
    state.profile = data.user;
    $("#profilePanel").classList.remove("hidden");
    $("#profilePanel").innerHTML = `<div class="profile-top"><div class="avatar">${esc(data.user.avatar)}</div><div class="profile-details"><h2>${esc(data.user.name)}</h2><p>@${esc(data.user.username)}</p></div>${state.user && state.user.id !== data.user.id ? `<button class="follow-button ${data.isFollowing ? "following" : ""}" data-action="follow" data-id="${data.user.id}">${data.isFollowing ? "✓ Following" : "+ Follow"}</button>` : ""}</div>
      <p class="profile-bio">${esc(data.user.bio || "Still writing my story…")}</p><div class="profile-stats"><div><strong>${data.posts.length}</strong><span>posts</span></div><div><strong>${data.followers}</strong><span>followers</span></div><div><strong>${data.following}</strong><span>following</span></div></div>
      ${state.user && state.user.id === data.user.id ? `<form id="editProfile" class="profile-edit"><input name="bio" maxlength="120" value="${esc(data.user.bio)}" placeholder="Write a short bio…"><select name="avatar">${avatars.map(a => `<option ${a === data.user.avatar ? "selected" : ""}>${a}</option>`).join("")}</select><button class="button button-purple" type="submit">Save profile</button></form>` : ""}`;
    renderPosts(data.posts);
  } catch(e) { toast(e.message); }
}
function showAuth(mode = "login") {
  state.authMode = mode;
  $("#authPanel").classList.remove("hidden");
  $("#nameField").classList.toggle("hidden", mode !== "register");
  $("#authSubmit").textContent = mode === "register" ? "Create my account →" : "Log in →";
  document.querySelectorAll(".auth-tab").forEach(b => b.classList.toggle("selected", b.dataset.auth === mode));
  $("#authMessage").textContent = "";
  $("#authPanel").scrollIntoView({behavior:"smooth", block:"nearest"});
}
document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => {
  if (b.dataset.view === "profile" && !state.user) { showAuth("login"); toast("Log in to see your profile."); return; }
  setView(b.dataset.view);
}));
$("#authButton").addEventListener("click", async () => {
  if (state.user) {
    try { await api("/api/logout", {method:"POST"}); state.user = null; state.profile = null; updateUserUI(); setView("feed"); toast("You’ve logged out."); }
    catch(e) { toast(e.message); }
  } else showAuth("login");
});
document.querySelectorAll(".auth-tab").forEach(b => b.addEventListener("click", () => showAuth(b.dataset.auth)));
$("#authForm").addEventListener("submit", async e => {
  e.preventDefault(); $("#authMessage").textContent = "";
  const body = { username: $("#username").value, password: $("#password").value };
  if (state.authMode === "register") body.name = $("#name").value;
  try {
    const data = await api(`/api/${state.authMode === "register" ? "register" : "login"}`, {method:"POST", body});
    state.user = data.user; updateUserUI(); $("#authPanel").classList.add("hidden"); $("#authForm").reset();
    toast(`Welcome${state.authMode === "register" ? " to PulseBoard" : " back"}, ${state.user.name.split(" ")[0]}!`); setView("feed");
  } catch(e) { $("#authMessage").textContent = e.message; }
});
$("#postContent").addEventListener("input", () => $("#charCount").textContent = `${$("#postContent").value.length} / 500`);
$("#postForm").addEventListener("submit", async e => {
  e.preventDefault(); $("#postMessage").textContent = "";
  try {
    await api("/api/posts", {method:"POST", body:{content:$("#postContent").value, mood:$("#postMood").value}});
    $("#postContent").value = ""; $("#charCount").textContent = "0 / 500"; toast("Your little moment is out in the world ✨"); await loadPosts();
  } catch(e) { $("#postMessage").textContent = e.message; }
});
$("#feed").addEventListener("click", async e => {
  const b = e.target.closest("[data-action]"); if (!b) return;
  const action = b.dataset.action;
  try {
    if (action === "like") {
      if (!state.user) return showAuth("login");
      const {post} = await api(`/api/posts/${b.dataset.id}/like`, {method:"POST"}); 
      const i = state.posts.findIndex(p => p.id === post.id); if (i >= 0) state.posts[i] = post;
      await loadPosts();
    } else if (action === "comments") {
      const form = b.closest(".post-card").querySelector(".comment-form");
      if (!state.user) { showAuth("login"); return; }
      form.classList.toggle("hidden"); form.querySelector("input").focus();
    } else if (action === "profile") {
      if (!state.user) { showAuth("login"); return; }
      state.view = "profile"; $("#profilePanel").classList.remove("hidden"); await loadProfile(b.dataset.username);
    }
  } catch(e) { toast(e.message); }
});
$("#feed").addEventListener("submit", async e => {
  const form = e.target.closest("[data-comment]"); if (!form) return;
  e.preventDefault();
  try { await api(`/api/posts/${form.dataset.comment}/comments`, {method:"POST", body:{content:form.comment.value}}); await loadPosts(); toast("Comment added — kindness delivered."); }
  catch(err) { toast(err.message); }
});
$("#peopleList").addEventListener("click", async e => {
  const b = e.target.closest('[data-action="follow"]'); if (!b) return;
  if (!state.user) return showAuth("login");
  try { const data = await api(`/api/users/${b.dataset.id}/follow`, {method:"POST"}); b.textContent = data.following ? "✓ Following" : "+ Follow"; b.classList.toggle("following", data.following); toast(data.following ? "You’re connected!" : "Unfollowed."); }
  catch(err) { toast(err.message); }
});
$("#profilePanel").addEventListener("click", async e => {
  const b = e.target.closest('[data-action="follow"]'); if (!b) return;
  try { const data = await api(`/api/users/${b.dataset.id}/follow`, {method:"POST"}); b.textContent = data.following ? "✓ Following" : "+ Follow"; b.classList.toggle("following", data.following); await loadProfile(state.profile.username); }
  catch(err) { toast(err.message); }
});
$("#profilePanel").addEventListener("submit", async e => {
  if (e.target.id !== "editProfile") return;
  e.preventDefault();
  try { const form = e.target; const {user} = await api("/api/me", {method:"GET"}); 
    const result = await api("/api/me", {method:"PATCH", body:{bio:form.bio.value, avatar:form.avatar.value}});
    state.user = result.user; updateUserUI(); await loadProfile(state.user.username); toast("Profile updated ✨");
  } catch(err) { toast(err.message); }
});
$("#refreshButton").addEventListener("click", () => state.view === "discover" ? loadPeople() : state.view === "profile" && state.user ? loadProfile(state.user.username) : loadPosts());

(async function init() {
  try { const data = await api("/api/me"); state.user = data.user; updateUserUI(); }
  catch(e) { console.error(e); }
  setView("feed");
})();
