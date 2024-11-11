// script.js
document.addEventListener('DOMContentLoaded', () => {
    getCurrentUser();
    
    if (window.location.pathname === '/') {
        loadPosts();
        setupPostForm();
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});

function getCurrentUser() {
    fetch('/current-user', {
        credentials: 'include'
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        return response.json();
    })
    .then(user => {
        if (user && user.username) {
            const usernameSpan = document.getElementById('username');
            if (usernameSpan) {
                usernameSpan.textContent = user.username;
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        window.location.href = '/login.html';
    });
}

function loadPosts() {
    fetch('/posts', {
        credentials: 'include'
    })
    .then(response => response.json())
    .then(posts => {
        displayPosts(posts);
    })
    .catch(error => console.error('Error:', error));
}

function displayPosts(posts) {
    const postsContainer = document.getElementById('posts');
    if (!postsContainer) return;

    postsContainer.innerHTML = posts.map(post => `
        <div class="post" data-post-id="${post._id}">
            <div class="post-header">
                <strong>${post.author.username}</strong>
                <small>${new Date(post.createdAt).toLocaleString()}</small>
            </div>
            <h2>${post.title}</h2>
            ${post.image ? `<img src="${post.image}" alt="Post image" class="post-image">` : ''}
            <p>${post.content}</p>
            <div class="post-actions">
                <button onclick="likePost('${post._id}')" class="like-btn">
                    ❤️ ${post.likes.length}
                </button>
                <button onclick="showReplyForm('${post._id}')" class="reply-btn">
                    Reply
                </button>
            </div>
            <div class="replies">
                ${post.replies.map(reply => `
                    <div class="reply">
                        <strong>${reply.author.username}</strong>
                        <p>${reply.content}</p>
                        <small>${new Date(reply.createdAt).toLocaleString()}</small>
                    </div>
                `).join('')}
            </div>
            <div class="reply-form" id="reply-form-${post._id}" style="display: none;">
                <textarea class="reply-input"></textarea>
                <button onclick="submitReply('${post._id}')">Submit Reply</button>
            </div>
        </div>
    `).join('');
}

function likePost(postId) {
    fetch(`/post/${postId}/like`, {
        method: 'POST',
        credentials: 'include'
    })
    .then(response => response.json())
    .then(() => loadPosts())
    .catch(error => console.error('Error:', error));
}

function showReplyForm(postId) {
    const form = document.getElementById(`reply-form-${postId}`);
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

function submitReply(postId) {
    const form = document.getElementById(`reply-form-${postId}`);
    const content = form.querySelector('.reply-input').value;

    fetch(`/post/${postId}/reply`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ content })
    })
    .then(response => response.json())
    .then(() => {
        form.querySelector('.reply-input').value = '';
        form.style.display = 'none';
        loadPosts();
    })
    .catch(error => console.error('Error:', error));
}

function logout() {
    fetch('/logout', {
        method: 'POST',
        credentials: 'include'
    })
    .then(() => {
        window.location.href = '/login.html';
    })
    .catch(error => {
        console.error('Error:', error);
        window.location.href = '/login.html';
    });
}
