document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in and get username
    getCurrentUser();
    // Load initial messages
    getMessages();
    // Set up event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Post message button
    document.getElementById('post-btn').addEventListener('click', () => {
        const content = document.getElementById('message-input').value.trim();
        if (content) {
            postMessage(content);
            document.getElementById('message-input').value = ''; // Clear input
        }
    });

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', logout);

    // Enter key in textarea
    document.getElementById('message-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            document.getElementById('post-btn').click();
        }
    });
}

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
            document.getElementById('username').textContent = data.username;
        }
    })
    .catch(error => console.error('Error:', error));
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
            getMessages(); // Refresh messages
        }
    })
    .catch(error => console.error('Error:', error));
}

function getMessages() {
    fetch('/messages', {
        headers: {
            'Accept': 'application/json'
        },
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
    .catch(error => console.error('Error:', error));
}
}