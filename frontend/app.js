// frontend/app.js
const socket = io(); // Connect to the same origin

const chatLog = document.getElementById('chatLog');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const nameInput = document.getElementById('bluetoothName');
const targetSelect = document.getElementById('targetSelect');

// IndexedDB setup
let db;
const dbRequest = indexedDB.open('meshChat', 1);
dbRequest.onupgradeneeded = (e) => {
  const database = e.target.result;
  database.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
};
dbRequest.onsuccess = (e) => {
  db = e.target.result;
  loadStoredMessages();
};
dbRequest.onerror = (e) => console.error('IndexedDB error', e);


function addMessage(text, isSelf) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message');
  msgDiv.classList.add(isSelf ? 'self' : 'other');
  msgDiv.textContent = text;
  chatLog.appendChild(msgDiv);
  chatLog.scrollTop = chatLog.scrollHeight;
}

sendBtn.addEventListener('click', () => {
  const msg = messageInput.value.trim();
  if (!msg) return;
  const name = nameInput.value.trim() || 'Anonymous';
  const target = targetSelect.value; // empty means broadcast
  const payload = {
    bluetoothName: name,
    targetName: target || null,
    text: msg,
    timestamp: new Date().toISOString()
  };
  socket.emit('send_message', payload);
  addMessage(`${name}: ${msg}`, true);
  storeMessage(payload);
  messageInput.value = '';
});

// Receive messages (broadcast or private)
socket.on('receive_message', (data) => {
  const selfName = nameInput.value.trim() || 'Anonymous';
  // Skip if this is our own broadcast (already shown)
  if (data.bluetoothName === selfName) return;
  addMessage(`${data.bluetoothName}: ${data.text}`, false);
  storeMessage(data);
});

function storeMessage(msg) {
  if (!db) return;
  const tx = db.transaction('messages', 'readwrite');
  tx.objectStore('messages').add(msg);
}

function loadStoredMessages() {
  if (!db) return;
  const tx = db.transaction('messages', 'readonly');
  const store = tx.objectStore('messages');
  store.openCursor().onsuccess = (e) => {
    const cursor = e.target.result;
    if (cursor) {
      const data = cursor.value;
      const isSelf = data.bluetoothName === (nameInput.value.trim() || 'Anonymous');
      addMessage(`${data.bluetoothName}: ${data.text}`, isSelf);
      cursor.continue();
    }
  };
}

function populateUsers() {
  fetch('/api/users')
    .then(res => res.json())
    .then(names => {
      // Clear existing options (keep broadcast default)
      targetSelect.innerHTML = '<option value="">Broadcast to All</option>';
      names.forEach(n => {
        if (n !== nameInput.value.trim()) {
          const opt = document.createElement('option');
          opt.value = n;
          opt.textContent = n;
          targetSelect.appendChild(opt);
        }
      });
    })
    .catch(console.error);
}

window.addEventListener('load', () => {
  // Populate the target dropdown after a short delay to ensure DB is ready
  setTimeout(populateUsers, 500);
});

// Optional: press Enter to send
messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendBtn.click();
  }
});
