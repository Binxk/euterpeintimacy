// public/script.js

// ---------- Auth / session ----------
async function checkAuth() {
  try {
    const res = await fetch('/check-session');
    const data = await res.json();
    if (data?.authenticated && data.user?.username) {
      const el = document.getElementById('username');
      if (el) el.textContent = data.user.username;
      return data.user.username;
    }
  } catch (e) {
    console.error('Auth check failed:', e);
  }
  // not authed -> go to login
  window.location.href = '/login';
  return null;
}

async function logout() {
  try {
    await fetch('/logout', { method: 'POST' });
  } finally {
    window.location.href = '/login';
  }
}

// ---------- Replies ----------
async function submitReply(postId, textarea) {
  const content = textarea.value.trim();
  if (!content) return;
  try {
    const res = await fetch(`/post/${encodeURIComponent(postId)}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await res.json().catch(() => ({}));
    if (!data?.success) throw new Error(data?.error || 'Failed to submit reply');
    textarea.value = '';
    await loadPosts();
  } catch (e) {
    console.error(e);
    alert(e.message || 'Failed to submit reply');
  }
}

function buildReplyForm(postId) {
  const wrap = document.createElement('div');
  wrap.className = 'reply-form';

  const ta = document.createElement('textarea');
  ta.className = 'reply-textarea';
  ta.placeholder = 'Write your reply...';

  const btn = document.createElement('button');
  btn.type = 'button'; // important
  btn.className = 'reply-button';
  btn.textContent = 'Reply';
  btn.addEventListener('click', () => submitReply(postId, ta));

  wrap.appendChild(ta);
  wrap.appendChild(btn);
  return wrap;
}

// ---------- Posts ----------
async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;
  try {
    const res = await fetch(`/posts/${encodeURIComponent(postId)}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Failed to delete post');
    }
    await loadPosts();
  } catch (e) {
    console.error(e);
    alert(e.message || 'Failed to delete post');
  }
}

function renderReplies(replies) {
  if (!replies || !replies.length) return '';
  return `
    <div class="replies">
      ${replies.map(r => `
        <div class="reply">
          <div class="reply-author">Reply by: ${r?.author?.username ?? 'Unknown'}</div>
          <div class="reply-content">${r?.content ?? ''}</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function loadPosts() {
  try {
    const [postsRes, authRes] = await Promise.all([fetch('/posts'), fetch('/check-session')]);
    const posts = await postsRes.json();
    const auth = await authRes.json().catch(() => ({}));
    const currentUser = auth?.user?.username || null;

    const container = document.getElementById('posts');
    if (!container) return;
    container.innerHTML = '';

    (posts || []).forEach(post => {
      const isEuterpe = (post?.author?.username || '').toLowerCase() === 'euterpe';

      const postEl = document.createElement('div');
      postEl.className = 'post' + (isEuterpe ? ' euterpe-post' : '');

      // header
      const header = document.createElement('div');
      header.className = 'post-header';

      const h3 = document.createElement('h3');
      h3.textContent = post.title;
      header.appendChild(h3);

      if (post?.author?.username === currentUser) {
        const del = document.createElement('button');
        del.className = 'delete-btn';
        del.type = 'button';
        del.textContent = 'Delete';
        del.addEventListener('click', () => deletePost(post._id));
        header.appendChild(del);
      }

      // author + content
      const author = document.createElement('div');
      author.className = 'author';
      author.textContent = 'Posted by: ' + (post?.author?.username ?? 'Unknown');

      const content = document.createElement('div');
      content.className = 'content';
      content.textContent = post?.content ?? '';

      postEl.appendChild(header);
      postEl.appendChild(author);
      postEl.appendChild(content);

      if (post?.image) {
        const img = document.createElement('img');
        img.src = post.image;
        img.alt = 'Post image';
        img.className = 'post-image';
        postEl.appendChild(img);
      }

      // replies (existing)
      const repliesHtml = renderReplies(post.replies);
      if (repliesHtml) {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = repliesHtml;
        postEl.appendChild(wrapper.firstElementChild);
      }

      // reply form (new)
      postEl.appendChild(buildReplyForm(post._id));

      document.getElementById('posts').appendChild(postEl);
    });
  } catch (e) {
    console.error('Failed to load posts:', e);
  }
}

// ---------- Create Post (with image) ----------
function attachCreatePostHandler() {
  const form = document.getElementById('create-post-form');
  if (!form) return;

  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Posting...'; }

    const fd = new FormData(form); // reads title, content, image directly

    try {
      const res = await fetch('/post', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `Failed (${res.status})`);
      }
      form.reset();
      await loadPosts();
    } catch (e) {
      console.error('[create-post] error', e);
      alert(e.message || 'Failed to create post');
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Create Post'; }
    }
  });
}

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();            // redirects if not logged in
  attachCreatePostHandler();    // handles the create post form
  await loadPosts();            // load existing posts

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', logout);
});
