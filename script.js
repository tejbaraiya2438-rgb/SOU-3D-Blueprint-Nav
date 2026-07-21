let scene, camera, renderer, controls;
let roomsData = [];
let roomMeshes = []; // Click tracking ke liye array
let raycaster, mouse;
let selectedRoomMesh = null;

// Load Data
fetch('./rooms.json')
  .then(res => res.json())
  .then(data => { roomsData = data; });

function init() {
  const container = document.getElementById('canvas-container');

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a192f); // Deep Blueprint Navy

  // Isometric Camera Setup
  const aspect = window.innerWidth / window.innerHeight;
  const d = 24;
  camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
  camera.position.set(35, 30, 35);
  camera.lookAt(0, 9, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 9, 0);

  // Ground Blueprint Grid
  const gridHelper = new THREE.GridHelper(60, 40, 0x00f0ff, 0x113355);
  scene.add(gridHelper);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambientLight);

  // Build 10 Floors with 10 Clean Rooms Each
  buildDetailedRoomBuilding();

  // Event Listeners
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('pointerdown', onRoomClick);
  document.getElementById('searchInput').addEventListener('input', handleSearch);

  animate();
}

function buildDetailedRoomBuilding() {
  const totalFloors = 10;
  const floorHeight = 1.8;

  const cols = 5; 
  const rows = 2;
  const roomW = 3.2; 
  const roomD = 5.0; 
  const gap = 0.2; 

  const buildingGroup = new THREE.Group();

  const roomWireframeMat = new THREE.LineBasicMaterial({ color: 0x00b4d8, transparent: true, opacity: 0.4 });
  const roomEdgeMat = new THREE.LineBasicMaterial({ color: 0x64ffda, linewidth: 1.5 });

  for (let f = 1; f <= totalFloors; f++) {
    const yPosY = (f - 1) * floorHeight + floorHeight / 2;

    let roomIndex = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {

        // Clean & Simple Format: Room 10-4, Room 7-1, etc.
        const roomNameStr = `Room ${f}-${roomIndex}`;

        const xPos = (c - (cols - 1) / 2) * (roomW + gap);
        const zPos = (r - (rows - 1) / 2) * (roomD + gap);

        const roomGeo = new THREE.BoxGeometry(roomW, floorHeight - 0.2, roomD);
        const roomMat = new THREE.MeshBasicMaterial({
          color: 0x0f2b48,
          transparent: true,
          opacity: 0.7,
          depthWrite: true
        });

        const roomMesh = new THREE.Mesh(roomGeo, roomMat);
        roomMesh.position.set(xPos, yPosY, zPos);
        
        // Custom User Data mapping
        roomMesh.userData = { 
          roomId: roomNameStr, 
          floor: f, 
          roomNo: roomIndex 
        };

        const edgesGeo = new THREE.EdgesGeometry(roomGeo);
        const wireframe = new THREE.LineSegments(edgesGeo, roomEdgeMat);
        roomMesh.add(wireframe);

        buildingGroup.add(roomMesh);
        roomMeshes.push(roomMesh); // Track for raycasting

        roomIndex++;
      }
    }

    // Floor Plate Separator
    const baseGeo = new THREE.BoxGeometry(cols * (roomW + gap) + 0.4, 0.1, rows * (roomD + gap) + 0.4);
    const baseMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.2 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, (f - 1) * floorHeight, 0);
    buildingGroup.add(baseMesh);
  }

  scene.add(buildingGroup);
}

// EXACT ROOM CLICK LOGIC
function onRoomClick(event) {
  if (event.target.tagName === 'INPUT') return;

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(roomMeshes);

  if (intersects.length > 0) {
    const clickedRoom = intersects[0].object;

    // Reset previous selection
    if (selectedRoomMesh) {
      selectedRoomMesh.material.color.setHex(0x0f2b48);
      selectedRoomMesh.material.opacity = 0.7;
    }

    // Highlight selected room in bright cyan
    selectedRoomMesh = clickedRoom;
    selectedRoomMesh.material.color.setHex(0x00f0ff);
    selectedRoomMesh.material.opacity = 0.95;

    displayRoomData(clickedRoom.userData.roomId, clickedRoom.userData.floor);
  }
}

function displayRoomData(roomId, floorNum) {
  const infoCard = document.getElementById('infoCard');
  
  // Search json matching roomId (e.g., "Room 7-1") or simple ID
  const result = roomsData.find(r => r.id.toLowerCase() === roomId.toLowerCase() || r.name.toLowerCase().includes(roomId.toLowerCase()));

  if (result) {
    infoCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #00f0ff; padding-bottom: 4px; margin-bottom: 6px;">
        <span style="background: #00f0ff; color: #000; padding: 2px 6px; font-weight: bold; border-radius: 3px;">${roomId}</span>
        <span style="color: #64ffda; font-size: 0.75rem;">Floor ${floorNum}</span>
      </div>
      <strong>${result.name}</strong><br>
      🏷️ <b>Type:</b> ${result.type || 'Classroom / Faculty'}<br>
      👤 <b>In-charge:</b> ${result.incharge || 'N/A'}
    `;
  } else {
    infoCard.innerHTML = `
      <div style="border-bottom: 1px solid #00f0ff; padding-bottom: 4px; margin-bottom: 6px;">
        <span style="background: #00f0ff; color: #000; padding: 2px 6px; font-weight: bold; border-radius: 3px;">${roomId}</span>
      </div>
      <p style="color: #00b4d8;">Classroom / Unassigned Space</p>
    `;
  }
}

// SEARCH LOGIC
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  const infoCard = document.getElementById('infoCard');

  if (!query) {
    infoCard.innerHTML = `<p>Specific room par click karo ya number (e.g. 7-1) search karo.</p>`;
    return;
  }

  const targetRoomMesh = roomMeshes.find(m => 
    m.userData.roomId.toLowerCase().includes(query)
  );

  const result = roomsData.find(r => 
    r.id.toLowerCase().includes(query) || 
    r.name.toLowerCase().includes(query)
  );

  if (targetRoomMesh) {
    if (selectedRoomMesh) {
      selectedRoomMesh.material.color.setHex(0x0f2b48);
      selectedRoomMesh.material.opacity = 0.7;
    }
    selectedRoomMesh = targetRoomMesh;
    selectedRoomMesh.material.color.setHex(0x00f0ff);
    selectedRoomMesh.material.opacity = 0.95;

    displayRoomData(targetRoomMesh.userData.roomId, targetRoomMesh.userData.floor);
  } else if (result) {
    infoCard.innerHTML = `<strong>${result.name}</strong><br>📍 ${result.id}`;
  } else {
    infoCard.innerHTML = `<p style="color: #ff4a4a;">Room details nahi mili.</p>`;
  }
}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  const d = 24;
  camera.left = -d * aspect;
  camera.right = d * aspect;
  camera.top = d;
  camera.bottom = -d;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

window.onload = init;
