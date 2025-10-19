// 3D Chat implementation using Three.js and PeerJS

// DOM elements
const startBtn = document.getElementById('start-btn');
const usernameInput = document.getElementById('username');
const setupPanel = document.getElementById('setup-panel');
const chatRoom = document.getElementById('chat-room');

const myIdEl = document.getElementById('my-id');
const copyIdBtn = document.getElementById('copy-id');
const remoteIdInput = document.getElementById('remote-id');
const connectBtn = document.getElementById('connect-btn');

const chatLog = document.getElementById('chat-log');
const chatMessageInput = document.getElementById('chat-message');
const sendBtn = document.getElementById('send-btn');

const canvas = document.getElementById('chat-canvas');

// Networking variables
let peer;
let connections = [];

// Player state
const localPlayer = {
  id: null,
  name: '',
  color: null,
  mesh: null,
  position: new THREE.Vector3(0, 0.5, 0),
};
const remotePlayers = {}; // key: peerId -> {name, color, mesh, position}

// Three.js variables
let scene, camera, renderer;
let keysPressed = {};

// Utility to generate a random pastel color
function randomColor() {
  // Generate pastel color by averaging with white
  const r = Math.floor((Math.random() * 128) + 127);
  const g = Math.floor((Math.random() * 128) + 127);
  const b = Math.floor((Math.random() * 128) + 127);
  return (r << 16) + (g << 8) + b;
}

// Initialise the Three.js scene
function initScene() {
  scene = new THREE.Scene();
  // Create camera
  camera = new THREE.PerspectiveCamera(
    60,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 10, 12);
  camera.lookAt(0, 0, 0);
  // Renderer
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 0.8);
  directional.position.set(5, 10, 7);
  scene.add(directional);
  // Ground grid
  const grid = new THREE.GridHelper(50, 50, 0x444444, 0x888888);
  scene.add(grid);
  // Local avatar
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: localPlayer.color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(localPlayer.position);
  localPlayer.mesh = mesh;
  scene.add(mesh);
  // Listen for window resize
  window.addEventListener('resize', onWindowResize);
  animate();
}

function onWindowResize() {
  if (!camera) return;
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
}

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  updateLocalMovement();
  // Update camera to follow player from an offset
  camera.position.x = localPlayer.position.x + 10;
  camera.position.z = localPlayer.position.z + 12;
  camera.position.y = 10;
  camera.lookAt(localPlayer.position);
  // Update remote player positions
  for (const id in remotePlayers) {
    const rp = remotePlayers[id];
    if (rp.mesh) rp.mesh.position.copy(rp.position);
  }
  renderer.render(scene, camera);
}

// Handle local movement based on keys pressed
function updateLocalMovement() {
  const speed = 0.1;
  let moved = false;
  if (keysPressed['ArrowUp'] || keysPressed['w'] || keysPressed['W']) {
    localPlayer.position.z -= speed;
    moved = true;
  }
  if (keysPressed['ArrowDown'] || keysPressed['s'] || keysPressed['S']) {
    localPlayer.position.z += speed;
    moved = true;
  }
  if (keysPressed['ArrowLeft'] || keysPressed['a'] || keysPressed['A']) {
    localPlayer.position.x -= speed;
    moved = true;
  }
  if (keysPressed['ArrowRight'] || keysPressed['d'] || keysPressed['D']) {
    localPlayer.position.x += speed;
    moved = true;
  }
  if (moved) {
    if (localPlayer.mesh) {
      localPlayer.mesh.position.copy(localPlayer.position);
    }
  }
}

// Broadcast local position regularly
function startPositionBroadcast() {
  setInterval(() => {
    if (connections.length === 0) return;
    const pos = {
      x: localPlayer.position.x,
      y: localPlayer.position.y,
      z: localPlayer.position.z,
    };
    const message = {
      type: 'pos',
      id: localPlayer.id,
      pos,
    };
    connections.forEach((conn) => {
      if (conn.open) conn.send(message);
    });
  }, 100);
}

// Setup PeerJS
function initPeer() {
  peer = new Peer();
  peer.on('open', (id) => {
    localPlayer.id = id;
    myIdEl.textContent = id;
    // Start broadcasting position after ID assigned
    startPositionBroadcast();
  });
  peer.on('connection', (conn) => {
    onConnection(conn);
  });
}

// Handle a new connection (incoming or outgoing)
function onConnection(conn) {
  connections.push(conn);
  logSystemMessage('Connesso con ' + conn.peer);
  conn.on('data', (data) => {
    handleData(data, conn.peer);
  });
  conn.on('close', () => {
    handleDisconnect(conn.peer);
  });
  // Send our player info to the new peer
  const initMsg = {
    type: 'init',
    id: localPlayer.id,
    name: localPlayer.name,
    color: localPlayer.color,
    pos: {
      x: localPlayer.position.x,
      y: localPlayer.position.y,
      z: localPlayer.position.z,
    },
  };
  conn.on('open', () => {
    conn.send(initMsg);
  });
}

// Handle incoming data from peers
function handleData(data, fromId) {
  switch (data.type) {
    case 'init': {
      // Register remote player
      if (!remotePlayers[fromId]) {
        const rp = {
          name: data.name,
          color: data.color,
          position: new THREE.Vector3(data.pos.x, data.pos.y, data.pos.z),
          mesh: null,
        };
        // Create mesh for remote avatar
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const material = new THREE.MeshStandardMaterial({ color: data.color });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(rp.position);
        rp.mesh = mesh;
        remotePlayers[fromId] = rp;
        scene.add(mesh);
        logSystemMessage(`${rp.name} (${fromId}) è entrato nella stanza.`);
      }
      break;
    }
    case 'pos': {
      const rp = remotePlayers[fromId];
      if (rp) {
        rp.position.set(data.pos.x, data.pos.y, data.pos.z);
      }
      break;
    }
    case 'chat': {
      const rp = remotePlayers[fromId];
      const senderName = rp ? rp.name : fromId;
      appendChatMessage(senderName, data.message, false);
      break;
    }
    case 'disconnect': {
      handleDisconnect(fromId);
      break;
    }
    default:
      break;
  }
}

// Handle peer disconnect
function handleDisconnect(peerId) {
  // Remove connection
  connections = connections.filter((c) => c.peer !== peerId);
  // Remove remote player
  const rp = remotePlayers[peerId];
  if (rp) {
    if (rp.mesh) scene.remove(rp.mesh);
    delete remotePlayers[peerId];
    logSystemMessage(`${rp.name} (${peerId}) ha lasciato la chat.`);
  }
}

// Chat UI helpers
function appendChatMessage(sender, message, isLocal) {
  const p = document.createElement('p');
  p.innerHTML = `<strong>${sender}:</strong> ${message}`;
  p.style.color = isLocal ? '#333' : '#007bff';
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function logSystemMessage(message) {
  const p = document.createElement('p');
  p.textContent = message;
  p.style.fontStyle = 'italic';
  p.style.color = '#6c757d';
  chatLog.appendChild(p);
  chatLog.scrollTop = chatLog.scrollHeight;
}

// Send chat message
function sendChat() {
  const msg = chatMessageInput.value.trim();
  if (!msg) return;
  appendChatMessage(localPlayer.name || 'Tu', msg, true);
  const message = {
    type: 'chat',
    message: msg,
  };
  connections.forEach((conn) => {
    if (conn.open) conn.send(message);
  });
  chatMessageInput.value = '';
}

// Event listeners
startBtn.addEventListener('click', () => {
  const name = usernameInput.value.trim();
  if (!name) {
    alert('Inserisci un nome valido');
    return;
  }
  localPlayer.name = name;
  localPlayer.color = randomColor();
  // Hide setup and show chat
  setupPanel.style.display = 'none';
  chatRoom.style.display = 'block';
  // Initialize Peer and Three.js
  initPeer();
  initScene();
});

copyIdBtn.addEventListener('click', () => {
  if (!localPlayer.id) return;
  navigator.clipboard.writeText(localPlayer.id).then(() => {
    copyIdBtn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => {
      copyIdBtn.innerHTML = '<i class="fas fa-copy"></i>';
    }, 1500);
  });
});

connectBtn.addEventListener('click', () => {
  const remoteId = remoteIdInput.value.trim();
  if (!remoteId) {
    alert('Inserisci un ID remoto valido');
    return;
  }
  if (!peer) return;
  // Avoid connecting to yourself
  if (remoteId === localPlayer.id) {
    alert('Non puoi connetterti a te stesso');
    return;
  }
  const existing = connections.find((c) => c.peer === remoteId);
  if (existing) {
    alert('Già connesso con questo peer');
    return;
  }
  const conn = peer.connect(remoteId);
  onConnection(conn);
});

sendBtn.addEventListener('click', sendChat);
chatMessageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendChat();
});

// Track key presses for movement
document.addEventListener('keydown', (e) => {
  keysPressed[e.key] = true;
});
document.addEventListener('keyup', (e) => {
  keysPressed[e.key] = false;
});