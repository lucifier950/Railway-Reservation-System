const API_URL = 'http://localhost:8080';
const USER_ROLE = window.USER_ROLE; 

// Function to handle logout
function logout() {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    window.location.href = 'login.html';
}
window.logout = logout; 

// Display user role
document.getElementById('roleDisplay').textContent = USER_ROLE.toUpperCase();

// Role-based visibility logic 
function applyRoleRestrictions() {
    if (USER_ROLE === 'passenger') {
        // Passenger View
        document.getElementById('adminStatsBar').style.display = 'none';
        document.getElementById('queueCard').style.display = 'none';
        document.getElementById('passengerMessage').style.display = 'block';
        document.getElementById('bookingCard').style.display = 'block'; 
        document.getElementById('routeCard').style.display = 'block'; 
        
        const mainContent = document.querySelector('.main-content');
        mainContent.style.gridTemplateColumns = '1fr 1fr'; 
        document.querySelector('.network-viz').style.gridColumn = '1 / -1';
    } else {
        // Admin View: Focus purely on management
        document.getElementById('adminStatsBar').style.display = 'flex';
        document.getElementById('queueCard').style.display = 'block';
        document.getElementById('passengerMessage').style.display = 'none';
        
        // Hide Booking and Route Cards for Admin
        document.getElementById('bookingCard').style.display = 'none'; 
        document.getElementById('routeCard').style.display = 'none'; 
        
        // Adjust grid to single column for network viz and queue management
        const mainContent = document.querySelector('.main-content');
        mainContent.style.gridTemplateColumns = '1fr'; 
        document.querySelector('.network-viz').style.gridColumn = 'auto'; 
    }
}
applyRoleRestrictions();

// --- UPDATED STATION DATA (REFINED COORDINATES) ---
const stations = [
    { id: 0, name: 'Delhi', x: 200, y: 150 },      // North
    { id: 1, name: 'Agra', x: 350, y: 250 },       // Central
    { id: 2, name: 'Jaipur', x: 50, y: 300 },      // West
    { id: 3, name: 'Mumbai', x: 200, y: 400 },     // Southwest (Moved left and up slightly)
    { id: 4, name: 'Pune', x: 400, y: 450 },       // Southeast of Mumbai (More separation from 3)
    { id: 5, name: 'Goa', x: 550, y: 350 },        // South-East
    { id: 6, name: 'Lucknow', x: 550, y: 200 },    // East
    { id: 7, name: 'Muzaffarnagar', x: 380, y: 50 } // Far North
];
document.getElementById('totalStations').textContent = stations.length;

// Note: Routes here must match the C++ backend routes to correctly draw the graph.
const routes = [
    { from: 0, to: 1 }, { from: 0, to: 2 }, { from: 1, to: 2 },
    { from: 1, to: 3 }, { from: 2, to: 3 }, { from: 3, to: 4 },
    { from: 3, to: 5 }, { from: 4, to: 5 },
    { from: 0, to: 7 }, { from: 7, to: 6 }, { from: 6, to: 1 }
];

// --- ANIMATION FUNCTIONS (Unchanged) ---
function findLineElement(startId, endId) {
    const svg = document.querySelector('#network svg');
    if (!svg) return null;
    const [id1, id2] = [Math.min(startId, endId), Math.max(startId, endId)];

    for (const route of routes) {
        const routeStart = Math.min(route.from, route.to);
        const routeEnd = Math.max(route.from, route.to);
        if (routeStart === id1 && routeEnd === id2) {
            const index = routes.findIndex(r => 
                (Math.min(r.from, r.to) === id1 && Math.max(r.from, r.to) === id2)
            );
            return svg.children[index] || null;
        }
    }
    return null;
}

function animatePath(path, color) {
    document.querySelectorAll('#network svg line').forEach(line => {
        line.setAttribute('stroke', '#667eea');
        line.setAttribute('stroke-width', '4');
        line.setAttribute('opacity', '0.3');
        line.classList.remove('active-line');
    });
    document.querySelectorAll('.station').forEach(station => {
        station.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    });

    if (path.length < 2) return;

    path.forEach((stationId, index) => {
        const stationElement = document.querySelector(`.station[title="${stations[stationId].name}"]`);
        if (stationElement) {
            setTimeout(() => {
                stationElement.style.background = color;
                stationElement.style.transform = 'scale(1.2)';
            }, index * 300);
            
            setTimeout(() => {
                stationElement.style.transform = 'scale(1)';
            }, index * 300 + 150);
        }
    });

    for (let i = 0; i < path.length - 1; i++) {
        const startId = path[i];
        const endId = path[i+1];
        const line = findLineElement(startId, endId);

        if (line) {
            setTimeout(() => {
                line.setAttribute('stroke', color);
                line.setAttribute('stroke-width', '6');
                line.setAttribute('opacity', '1');
                line.classList.add('active-line');
            }, i * 300 + 300);
        }
    }
}
window.animatePath = animatePath;


// --- CORE FUNCTIONS ---

async function checkServer() {
    try {
        const response = await fetch(`${API_URL}/stations`, { 
            method: 'GET',
            mode: 'cors'
        });
        if (response.ok) {
            document.getElementById('serverStatus').className = 'status connected';
            document.getElementById('serverStatus').textContent = '✅ Connected to C++ Backend (IN-MEMORY)'; 
            return true;
        }
    } catch (error) {
        document.getElementById('serverStatus').className = 'status disconnected';
        document.getElementById('serverStatus').textContent = '❌ Server Not Running - Start railway_backend.exe';
        return false;
    }
}

function drawNetwork() {
    const network = document.getElementById('network');
    network.innerHTML = '';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.position = 'absolute';
    // Set SVG height/width to encompass all nodes for scroll
    svg.style.width = '100%';
    svg.style.height = '100%';
    
    routes.forEach(route => {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        const s1 = stations[route.from];
        const s2 = stations[route.to];
        line.setAttribute('x1', s1.x + 35);
        line.setAttribute('y1', s1.y + 35);
        line.setAttribute('x2', s2.x + 35);
        line.setAttribute('y2', s2.y + 35);
        line.setAttribute('stroke', '#667eea');
        line.setAttribute('stroke-width', '4');
        line.setAttribute('opacity', '0.3');
        svg.appendChild(line);
    });
    network.appendChild(svg);

    stations.forEach(station => {
        const div = document.createElement('div');
        div.className = 'station';
        div.style.left = station.x + 'px';
        div.style.top = station.y + 'px';
        div.innerHTML = station.id;
        div.title = station.name;
        
        const label = document.createElement('div');
        label.className = 'station-label';
        label.textContent = station.name;
        label.style.left = station.x + 'px';
        label.style.top = station.y + 'px';
        
        network.appendChild(div);
        network.appendChild(label);
    });
}

function updateStats(pending, completed) {
    if (USER_ROLE === 'admin') { 
        document.getElementById('pendingCount').textContent = pending.length;
        document.getElementById('completedCount').textContent = completed.length;
    }
}

// Handle Booking Form 
document.getElementById('bookingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('bookBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Submitting...';

    const name = document.getElementById('passengerName').value.trim();
    const from = document.getElementById('fromStation').value;
    const to = document.getElementById('toStation').value;

    if (!from || !to || from === to) {
        alert('⚠️ Please select valid and different departure/destination stations!');
        btn.disabled = false;
        btn.textContent = '🎫 Book Ticket';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/addBooking`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `name=${encodeURIComponent(name)}&from=${from}&to=${to}`
        });

        const data = await response.json();
        alert(`✅ Booking Added to Queue!\n\n🎫 Booking ID: ${data.id}\n👤 Passenger: ${name}\n\nStatus: PENDING ADMIN CONFIRMATION`);
        document.getElementById('bookingForm').reset();
        refreshBookings();
    } catch (error) {
        alert('❌ Error: Unable to connect to server!\n\nPlease check C++ backend is running.');
    }

    btn.disabled = false;
    btn.textContent = '🎫 Book Ticket';
});

// Handle Route Form 
document.getElementById('routeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('routeBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Searching...';

    const from = document.getElementById('routeFrom').value;
    const to = document.getElementById('routeTo').value;

    if (!from || !to || from === to) {
        alert('⚠️ Please select valid and different departure/destination stations!');
        btn.disabled = false;
        btn.textContent = '🚀 Find Routes';
        return;
    }

    try {
        const response = await fetch(`${API_URL}/findRoute?from=${from}&to=${to}`);
        const data = await response.json();

        const resultDiv = document.getElementById('routeResult');
        resultDiv.innerHTML = `
            <div id="fastestResult" class="route-result" onclick="animatePath(${JSON.stringify(data.fastestPath)}, '#2196f3')" style="cursor: pointer;">
                <strong>⚡ Fastest Route (Click to See on Map)</strong>
                <div class="route-path">${data.fastestPath.map(id => stations[id].name).join(' → ')}</div>
                <div style="font-size: 1.1em; color: #1976d2;">⏱️ Total Time: ${data.fastestTime} minutes</div>
            </div>
            <div id="cheapestResult" class="route-result" style="background: linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%); border-left-color: #ff9800; cursor: pointer;" onclick="animatePath(${JSON.stringify(data.cheapestPath)}, '#ff9800')">
                <strong>💰 Cheapest Route (Click to See on Map)</strong>
                <div class="route-path" style="color: #e65100;">${data.cheapestPath.map(id => stations[id].name).join(' → ')}</div>
                <div style="font-size: 1.1em; color: #e65100;">💵 Total Cost: ₹${data.cheapestCost}</div>
            </div>
        `;
        
        animatePath(data.fastestPath, '#2196f3');
        
    } catch (error) {
        document.getElementById('routeResult').innerHTML = `
            <div class="error-message">
                ❌ Error: Unable to connect to server!<br>
                Please ensure the C++ backend is running.
            </div>
        `;
    }

    btn.disabled = false;
    btn.textContent = '🚀 Find Routes';
});


// Refresh Bookings
async function refreshBookings() {
    const isConnected = await checkServer();
    if (!isConnected) return; 

    // Fetch all bookings
    let pending = [];
    let completed = [];
    try {
        const [pendingRes, completedRes] = await Promise.all([
            fetch(`${API_URL}/pendingBookings`),
            fetch(`${API_URL}/completedBookings`)
        ]);
        pending = await pendingRes.json();
        completed = await completedRes.json();
    } catch (error) {
         console.error("Error fetching booking data:", error);
    }
    
    updateStats(pending, completed); 

    if (USER_ROLE === 'passenger') {
        const list = document.getElementById('passengerCompletedList');
        list.innerHTML = '<h3>✅ Confirmed Tickets</h3>'; 

        if (completed.length === 0) {
            list.innerHTML += '<p style="text-align: center; padding: 20px; color: #999;">No confirmed tickets found in memory.</p>';
            return;
        }
        
        // --- Display Confirmed Tickets for Passenger ---
        completed.forEach(booking => {
            const div = document.createElement('div');
            div.className = 'booking-item completed'; 
            
            div.innerHTML = `
                <div class="booking-info">
                    <strong>✅ Ticket Confirmed! ID: ${booking.id}</strong><br>
                    <span style="font-size: 1.1em;">👤 Passenger: ${booking.name}</span><br>
                    <span style="color: #666;">📍 ${stations[booking.from].name} → ${stations[booking.to].name}</span>
                </div>
            `;
            list.appendChild(div);
        });

        return; // Exit if passenger
    } 
    
    // --- Admin Role Logic ---
    
    const list = document.getElementById('bookingsList');
    list.innerHTML = '';

    if (pending.length === 0 && completed.length === 0) {
        list.innerHTML = '<p style="text-align: center; padding: 40px; color: #999; font-size: 1.2em;">📭 No bookings yet. Create your first booking!</p>';
        return;
    }

    // Pending Bookings (Admin Actionable)
    if (pending.length > 0) {
        const pendingHeader = document.createElement('h3');
        pendingHeader.textContent = `⏳ Pending Bookings (${pending.length} in queue)`;
        pendingHeader.style.color = '#667eea';
        pendingHeader.style.marginBottom = '15px';
        pendingHeader.style.marginTop = '10px';
        list.appendChild(pendingHeader);
    }

    pending.forEach(booking => {
        const div = document.createElement('div');
        div.className = 'booking-item';
        div.innerHTML = `
            <div class="booking-info">
                <strong>🎫 Booking ID: ${booking.id}</strong><br>
                <span style="font-size: 1.1em;">👤 ${booking.name}</span><br>
                <span style="color: #666;">📍 ${stations[booking.from].name} → ${stations[booking.to].name}</span>
            </div>
            <button onclick="processBooking()" class="btn-process">✅ Process Now</button>
        `;
        list.appendChild(div);
    });

    // Completed Bookings (Admin View)
    if (completed.length > 0) {
        const completedHeader = document.createElement('h3');
        completedHeader.textContent = `✅ Confirmed Bookings (${completed.length} processed)`;
        completedHeader.style.color = '#4caf50';
        completedHeader.style.marginBottom = '15px';
        completedHeader.style.marginTop = '25px';
        list.appendChild(completedHeader);
    }

    completed.forEach(booking => {
        const div = document.createElement('div');
        div.className = 'booking-item completed';
        div.innerHTML = `
            <div class="booking-info">
                <strong>✅ Booking ID: ${booking.id}</strong><br>
                <span style="font-size: 1.1em;">👤 ${booking.name}</span><br>
                <span style="color: #666;">📍 ${stations[booking.from].name} → ${stations[booking.to].name}</span><br>
                <span style="color: #4caf50; font-weight: 600;">Status: Confirmed ✓</span>
            </div>
        `;
        list.appendChild(div);
    });
}

// Process Booking (Admin-only function)
async function processBooking() {
    if (USER_ROLE !== 'admin') return; 

    try {
        const response = await fetch(`${API_URL}/processBooking`, { method: 'POST' });
        const data = await response.json();

        if (data.error) {
            alert('⚠️ ' + data.error);
            return;
        }

        const fastestPath = data.fastestPath.map(id => stations[id].name).join(' → ');
        const cheapestPath = data.cheapestPath.map(id => stations[id].name).join(' → ');

        alert(`✅ Booking CONFIRMED by Admin!\n\n🎫 Booking ID: ${data.id}\n👤 Passenger: ${data.name}\n\n⚡ FASTEST ROUTE (${data.fastestTime} min):\n${fastestPath}\n\n💰 CHEAPEST ROUTE (₹${data.cheapestCost}):\n${cheapestPath}`);
        
        refreshBookings();
    } catch (error) {
        alert('❌ Error confirming booking!\n\nPlease check if the server is running.');
    }
}
window.processBooking = processBooking;


// Initialize
drawNetwork();
checkServer().then(connected => {
    if (connected) {
        refreshBookings();
    }
});

// Auto-refresh logic remains, but only performs full refresh for admin
setInterval(() => {
    checkServer().then(connected => {
        if (connected) refreshBookings();
    });
}, 5000);

console.log('%c🚂 Railway Reservation System', 'color: #667eea; font-size: 20px; font-weight: bold;');
console.log('%cUser Role: ' + USER_ROLE.toUpperCase(), 'color: #4caf50; font-size: 14px;');
console.log('%cMade with ❤️ using C++ & JavaScript', 'color: #666; font-size: 12px;');