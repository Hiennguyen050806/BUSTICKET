const fs = require('fs');

let content = fs.readFileSync('admin.js', 'utf8');

const openTripModalOld = `async function openTripModal(tripId = '') {
    document.getElementById('trip-id').value = tripId;
    const form = document.getElementById('trip-form');
    form.reset();
    
    // Load options cho Tuyến và Xe
    await loadSelectOptions();

    if (tripId) {
        document.getElementById('trip-modal-title').innerText = 'Cập Nhật Chuyến Xe';
        try {
            const res = await fetch(\`http://localhost:3000/api/trips\`); 
            const data = await res.json();
            const trip = data.find(t => (t.TripID || t.tripId) === tripId);
            if (trip) {
                // Populate data
                if (trip.DepartureTime || trip.departureTime) {
                    const dt = new Date(trip.DepartureTime || trip.departureTime);
                    const year = dt.getFullYear();
                    const month = String(dt.getMonth() + 1).padStart(2, '0');
                    const day = String(dt.getDate()).padStart(2, '0');
                    document.getElementById('trip-date').value = \`\${year}-\${month}-\${day}\`;
                    const hours = String(dt.getHours()).padStart(2, '0');
                    const mins = String(dt.getMinutes()).padStart(2, '0');
                    document.getElementById('trip-time').value = \`\${hours}:\${mins}\`;
                }
                document.getElementById('trip-price').value = trip.Price || trip.price || 0;
            }
        } catch(e) {}
    } else {
        document.getElementById('trip-modal-title').innerText = 'Thêm Chuyến Xe Mới';
    }
    document.getElementById('trip-modal').style.display = 'flex';
}`;

const openTripModalNew = `async function openTripModal(tripId = '') {
    document.getElementById('trip-id').value = tripId;
    const form = document.getElementById('trip-form');
    form.reset();
    
    // Load options cho Tuyến và Xe
    await loadSelectOptions();

    if (tripId) {
        document.getElementById('trip-modal-title').innerText = 'Cập Nhật Chuyến Xe';
        try {
            const res = await fetch(\`\${API_BASE}/trips?limit=1000\`); 
            const data = await res.json();
            const trips = data.trips || data;
            const trip = trips.find(t => (t.TripID || t.tripId) === tripId);
            if (trip) {
                // Populate data
                if (trip.DepartureTime || trip.departureTime) {
                    const dt = new Date(trip.DepartureTime || trip.departureTime);
                    const year = dt.getFullYear();
                    const month = String(dt.getMonth() + 1).padStart(2, '0');
                    const day = String(dt.getDate()).padStart(2, '0');
                    document.getElementById('trip-date').value = \`\${year}-\${month}-\${day}\`;
                    const hours = String(dt.getHours()).padStart(2, '0');
                    const mins = String(dt.getMinutes()).padStart(2, '0');
                    document.getElementById('trip-time').value = \`\${hours}:\${mins}\`;
                }
                document.getElementById('trip-price').value = trip.Price || trip.price || 0;
                
                const dep = trip.DeparturePoint || trip.departurePoint;
                const des = trip.DestinationPoint || trip.destinationPoint;
                const selRoute = document.getElementById('trip-route');
                for (let i = 0; i < selRoute.options.length; i++) {
                    if (selRoute.options[i].value.startsWith(dep + '|' + des)) {
                        selRoute.selectedIndex = i;
                        break;
                    }
                }
                
                const busId = trip.BusID || trip.busId;
                if (busId) {
                    const selBus = document.getElementById('trip-bus');
                    for (let i = 0; i < selBus.options.length; i++) {
                        if (selBus.options[i].value == busId) {
                            selBus.selectedIndex = i;
                            break;
                        }
                    }
                }
            }
        } catch(e) {}
    } else {
        document.getElementById('trip-modal-title').innerText = 'Thêm Chuyến Xe Mới';
    }
    document.getElementById('trip-modal').style.display = 'flex';
}`;

content = content.replace(openTripModalOld, openTripModalNew);
content = content.replace(openTripModalOld.replace(/\r\n/g, '\n'), openTripModalNew);

fs.writeFileSync('admin.js', content, 'utf8');
console.log('Patched openTripModal successfully');
