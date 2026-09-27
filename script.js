let scene, camera, renderer, controls;
let roomsData = [];
let roomMeshes = [];
let raycaster, mouse;
let selectedRoomMesh = null;

// Clean / Normalize strings for exact matching
function cleanId(str) {
  if (!str) return '';
  return str.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Fetch JSON Data safely
fetch('./rooms.json')
  .then(res => {
    if (!res.ok) throw new Error("HTTP error " + res.status);
    return res.json();
  })
  .then(data => {
    roomsData = data;
    console.log("JSON loaded successfully:", roomsData.length, "rooms");
  })
  .catch(err => {
    console.warn("rooms.json loading issue:", err);
  });

function init() {
  try {
    const container = document.getElementById('canvas-container');
    if (!container) return;

    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x030c1e);

    const aspect = window.innerWidth / window.innerHeight;
    const d = 32;
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    camera.position.set(40, 35, 40);
    camera.lookAt(0, 9, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(0, 9, 0);

    // Ground Grid
    const gridHelper = new THREE.GridHelper(80, 50, 0x00f0ff, 0x113355);
    scene.add(gridHelper);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    // Build 10-Floor Building (EA + EB)
    buildBuilding10Floors();

    // Tap/Click Event
    renderer.domElement.addEventListener('pointerdown', onRoomTap);

    // Search Event
    const searchEl = document.getElementById('searchInput');
    if (searchEl) {
      searchEl.addEventListener('input', handleSearch);
    }

    // Close Modal Event
    const closeBtn = document.getElementById('closeModalBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    window.addEventListener('resize', onWindowResize);
    animate();
  } catch (e) {
    console.error("Init Error:", e);
  }
}

function create3DTextSprite(text) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(3, 15, 35, 0.85)';
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.rect(50, 40, 924, 176);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#00f0ff';
    ctx.font = 'Bold 52px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 128);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMaterial);
    
    sprite.scale.set(22, 5.5, 1);
    return sprite;
  } catch (err) {
    return new THREE.Group();
  }
}

function buildBuilding10Floors() {
  const totalFloors = 10;
  const floorHeight = 2.0;

  const roomW = 2.4; 
  const roomD = 3.6; 
  const gap = 0.25;

  const buildingGroup = new THREE.Group();
  const roomEdgeMat = new THREE.LineBasicMaterial({ color: 0x64ffda, linewidth: 1 });

  for (let f = 1; f <= totalFloors; f++) {
    const yPosY = (f - 1) * floorHeight + floorHeight / 2 + 0.2;

    // --- EA WING (20 Rooms: 801 to 820) ---
    const eaCols = 10;
    const eaRows = 2;
    let roomCounter = 1;

    for (let r = 0; r < eaRows; r++) {
      for (let c = 0; c < eaCols; c++) {
        const xPos = (c - (eaCols - 1) / 2) * (roomW + gap) - 6;
        const zPos = (r - (eaRows - 1) / 2) * (roomD + gap);

        const roomMesh = createRoomBox(roomW, floorHeight - 0.3, roomD, 0x0f2b48, roomEdgeMat);
        roomMesh.position.set(xPos, yPosY, zPos);

        // Fixed Room Calculation: 1 to 20 (e.g., 801 to 820)
        const calculatedRoomNo = (f * 100) + roomCounter;
        roomMesh.userData = { 
          roomId: `Room ${f}-${roomCounter}`, 
          roomCode: `EA ${calculatedRoomNo}`,
          floor: f, 
          wing: 'EA', 
          index: roomCounter 
        };

        buildingGroup.add(roomMesh);
        roomMeshes.push(roomMesh);
        roomCounter++;
      }
    }

    // --- EB WING EXTENSION (Rooms e.g. EB-821 / EB-822 onwards) ---
    const ebCols = 5;
    const ebRows = 2;
    let ebCounter = 1;

    for (let r = 0; r < ebRows; r++) {
      for (let c = 0; c < ebCols; c++) {
        const xPos = (c) * (roomW + gap) + 8.2;
        const zPos = (r - (ebRows - 1) / 2) * (roomD + gap);

        const roomMesh = createRoomBox(roomW, floorHeight - 0.3, roomD, 0x1d3557, roomEdgeMat);
        roomMesh.position.set(xPos, yPosY, zPos);

        const calculatedRoomNo = (f * 100) + 20 + ebCounter; // e.g. 821, 822...
        roomMesh.userData = { 
          roomId: `Room EB-${f}-${ebCounter}`, 
          roomCode: `EB ${calculatedRoomNo}`,
          floor: f, 
          wing: 'EB', 
          index: ebCounter 
        };

        buildingGroup.add(roomMesh);
        roomMeshes.push(roomMesh);
        ebCounter++;
      }
    }

    // Base Floor Slab
    const baseGeo = new THREE.BoxGeometry(15 * (roomW + gap) + 0.8, 0.15, 2 * (roomD + gap) + 0.8);
    const baseMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.25 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(1.1, (f - 1) * floorHeight + 0.1, 0);
    buildingGroup.add(baseMesh);
  }

  const titleSprite = create3DTextSprite('SOU 3D-DISHA (EA & EB)');
  const buildingTopY = totalFloors * floorHeight + 2.5;
  titleSprite.position.set(0, buildingTopY, 0);
  buildingGroup.add(titleSprite);

  scene.add(buildingGroup);
}

function createRoomBox(w, h, d, hexColor, edgeMat) {
  const roomGeo = new THREE.BoxGeometry(w, h, d);
  const roomMat = new THREE.MeshBasicMaterial({
    color: hexColor,
    transparent: true,
    opacity: 0.75,
    depthWrite: true
  });
  const roomMesh = new THREE.Mesh(roomGeo, roomMat);

  const edgesGeo = new THREE.EdgesGeometry(roomGeo);
  const wireframe = new THREE.LineSegments(edgesGeo, edgeMat);
  roomMesh.add(wireframe);

  return roomMesh;
}

// Tap Event Handler
function onRoomTap(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(roomMeshes);

  if (intersects.length > 0) {
    const clickedRoom = intersects[0].object;

    resetSelection();

    selectedRoomMesh = clickedRoom;
    selectedRoomMesh.material.color.setHex(0x00f0ff);
    selectedRoomMesh.material.opacity = 0.95;

    displayRoomData(clickedRoom.userData);
  }
}

function resetSelection() {
  if (selectedRoomMesh) {
    const defaultColor = selectedRoomMesh.userData.wing === 'EA' ? 0x0f2b48 : 0x1d3557;
    selectedRoomMesh.material.color.setHex(defaultColor);
    selectedRoomMesh.material.opacity = 0.75;
  }
}

function displayRoomData(uData) {
  const modalDetails = document.getElementById('modalDetails');
  const roomModal = document.getElementById('roomModal');
  const modalImageContainer = document.getElementById('modalImageContainer');
  const roomImage = document.getElementById('roomImage');
  
  if (!modalDetails || !roomModal) return;

  const numericPart = uData.roomCode.replace(/[^0-9]/g, '');
  const isEBWing = uData.wing === 'EB';

  // Precision matching with rooms.json
  let result = roomsData.find(r => {
    const jsonClean = cleanId(r.id);
    const jsonNum = jsonClean.replace(/[^0-9]/g, '');
    const jsonIsEB = jsonClean.includes('eb');

    if (isEBWing) {
      return jsonIsEB && jsonNum === numericPart;
    } else {
      return !jsonIsEB && jsonNum === numericPart;
    }
  });

  if (!result) {
    result = {
      id: uData.roomCode,
      name: `${uData.wing} Wing - Room ${numericPart}`,
      type: "Classroom / Lab Space",
      incharge: "SOU Department Staff",
      image: ""
    };
  }

  // Handle Image Display
  if (result.image && modalImageContainer && roomImage) {
    roomImage.src = result.image;
    modalImageContainer.classList.remove('hidden');
  } else if (modalImageContainer) {
    modalImageContainer.classList.add('hidden');
  }

  modalDetails.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #00f0ff; padding-bottom: 6px; margin-bottom: 8px;">
      <span style="background: #00f0ff; color: #000; padding: 2px 8px; font-weight: bold; border-radius: 3px;">${result.id || uData.roomCode}</span>
      <span style="color: #64ffda; font-size: 0.85rem;">Floor ${uData.floor} (${uData.wing} Wing)</span>
    </div>
    <h3 style="color:#ffffff; margin: 4px 0;">${result.name || 'Room Details'}</h3>
    <p style="margin: 4px 0; color: #e0e0e0;">🏷️ <b>Type:</b> ${result.type || 'N/A'}</p>
    <p style="margin: 4px 0; color: #e0e0e0;">👤 <b>In-charge:</b> ${result.incharge || 'N/A'}</p>
  `;

  roomModal.classList.remove('hidden');
}

function closeModal() {
  const roomModal = document.getElementById('roomModal');
  if (roomModal) roomModal.classList.add('hidden');
}

// Search Logic
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  const cleanQuery = cleanId(query);

  if (!query) {
    resetSelection();
    closeModal();
    return;
  }

  let matchedData = roomsData.find(r => 
    cleanId(r.id).includes(cleanQuery) || 
    cleanId(r.name).includes(cleanQuery) ||
    cleanId(r.type).includes(cleanQuery) ||
    cleanId(r.incharge).includes(cleanQuery)
  );

  let targetMesh = null;

  if (matchedData) {
    const jsonNum = matchedData.id.replace(/[^0-9]/g, '');
    const isEB = matchedData.id.toLowerCase().includes('eb');
    
    targetMesh = roomMeshes.find(m => {
      const meshNum = m.userData.roomCode.replace(/[^0-9]/g, '');
      const meshWing = m.userData.wing;
      return meshNum === jsonNum && (isEB ? meshWing === 'EB' : meshWing === 'EA');
    });
  }

  if (!targetMesh) {
    targetMesh = roomMeshes.find(m => 
      cleanId(m.userData.roomCode).includes(cleanQuery) ||
      cleanId(m.userData.roomId).includes(cleanQuery)
    );
  }

  if (targetMesh) {
    resetSelection();
    selectedRoomMesh = targetMesh;
    selectedRoomMesh.material.color.setHex(0xff0055);
    selectedRoomMesh.material.opacity = 1.0;

    displayRoomData(targetMesh.userData);
  }
}

function onWindowResize() {
  if (!camera || !renderer) return;
  const aspect = window.innerWidth / window.innerHeight;
  const d = 32;
  camera.left = -d * aspect;
  camera.right = d * aspect;
  camera.top = d;
  camera.bottom = -d;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) renderer.render(scene, camera);
}

if (document.readyState === 'complete') {
  init();
} else {
  window.addEventListener('load', init);
}
