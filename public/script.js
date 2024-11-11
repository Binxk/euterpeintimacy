document.addEventListener('DOMContentLoaded', () => {
    // Get current user info
    getCurrentUser();
    
    // Load messages if we're on the index page
    if (window.location.pathname === '/') {
        getMessages();
        setupMessageForm();
    }
    
    // Setup logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Set up "Create Post" link
    const createPostLink = document.getElementById('create-post-link');
    if (createPostLink) {
        createPostLink.addEventListener('click', (event) => {
            event.preventDefault();
            window.location.href = '/create-post.html';
        });
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
    .then(data => {
        if (data && data.username) {
            const usernameSpan = document.getElementById('username');
            if (usernameSpan) {
                usernameSpan.textContent = data.username;
            }
        }
    })
    .catch(error => {
        console.error('Error:', error);
        window.location.href = '/login.html';
    });
}

function setupMessageForm() {
    const postBtn = document.getElementById('post-btn');
    const messageInput = document.getElementById('message-input');
    
    if (postBtn && messageInput) {
        postBtn.addEventListener('click', () => {
            const content = messageInput.value.trim();
            if (content) {
                postMessage(content);
                messageInput.value = '';
            }
        });
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                postBtn.click();
            }
        });
    }
}

function postMessage(content) {
    fetch('/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({ content }),
        credentials: 'include'
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            console.error('Error:', data.error);
        } else {
            getMessages();
        }
    })
    .catch(error => console.error('Error:', error));
}

function getMessages() {
    fetch('/messages', {
        credentials: 'include'
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        return response.json();
    })
    .then(messages => {
        displayMessages(messages);
    })
    .catch(error => console.error('Error:', error));
}

function displayMessages(messages) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    messagesContainer.innerHTML = messages.map(message => `
        <div class="message">
            <strong>${message.author}</strong>
            <p>${message.content}</p>
            <small>${new Date(message.timestamp).toLocaleString()}</small>
        </div>
    `).join('');
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

function createPost(event) {
    event.preventDefault();
    
    const titleInput = document.getElementById('title');
    const contentInput = document.getElementById('content');
    const imageInput = document.getElementById('image');
    
    const formData = new FormData();
    formData.append('title', titleInput.value);
    formData.append('content', contentInput.value);
    formData.append('image', imageInput.files[0]);
    
    fetch('/create-post', {
        method: 'POST',
        body: formData,
        credentials: 'include'
    })
    .then(response => {
        if (response.status === 401) {
            window.location.href = '/login.html';
            return;
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            console.error('Error creating post:', data.error);
        } else {
            // Redirect to the post page or display the new post
            window.location.href = `/post/${data._id}`;
        }
    })
    .catch(error => {
        console.error('Error creating post:', error);
    });
    
    return false;
}