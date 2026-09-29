const fs = require('fs');

let content = fs.readFileSync('admin.js', 'utf8');

const loadSelectOptionsOld = `async function loadSelectOptions() {
    try {
        const res = await fetch(\`\${API_BASE}/buses\`);
        const data = await res.json();
        if (data.success) {
            const selBus = document.getElementById('trip-bus');
            selBus.innerHTML = data.buses.map(b => \`<option value="\${b.BusID || b.busId || b.PlateNumber || b.plateNumber}">\${b.PlateNumber || b.plateNumber} (\${b.BusType || b.busType})</option>\`).join('');
        }
    } catch(e){}
    // Tạm fake options tuyến
    document.getElementById('trip-route').innerHTML = \`<option value="1">Sài Gòn - Đà Lạt</option><option value="2">Đà Lạt - Sài Gòn</option><option value="3">Sài Gòn - Vũng Tàu</option>\`;
}`;

const loadSelectOptionsNew = `async function loadSelectOptions() {
    try {
        const res = await fetch(\`\${API_BASE}/buses\`);
        const data = await res.json();
        if (data.success) {
            const selBus = document.getElementById('trip-bus');
            selBus.innerHTML = data.buses.map(b => \`<option value="\${b.BusID || b.busId || b.PlateNumber || b.plateNumber}">\${b.PlateNumber || b.plateNumber} (\${b.BusType || b.busType})</option>\`).join('');
        }
    } catch(e){}
    
    const routes = [
        { dep: 'Sài Gòn', des: 'Đà Lạt', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Liên tỉnh Đà Lạt' },
        { dep: 'Đà Lạt', des: 'Sài Gòn', depStation: 'Bến xe Liên tỉnh Đà Lạt', desStation: '1 Võ Văn Ngân, Thủ Đức' },
        { dep: 'Sài Gòn', des: 'Cần Thơ', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Trung tâm Cần Thơ' },
        { dep: 'Cần Thơ', des: 'Sài Gòn', depStation: 'Bến xe Trung tâm Cần Thơ', desStation: '1 Võ Văn Ngân, Thủ Đức' },
        { dep: 'Sài Gòn', des: 'Nha Trang', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Phía Nam Nha Trang' },
        { dep: 'Nha Trang', des: 'Sài Gòn', depStation: 'Bến xe Phía Nam Nha Trang', desStation: '1 Võ Văn Ngân, Thủ Đức' },
        { dep: 'Sài Gòn', des: 'Vũng Tàu', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Vũng Tàu' },
        { dep: 'Vũng Tàu', des: 'Sài Gòn', depStation: 'Bến xe Vũng Tàu', desStation: '1 Võ Văn Ngân, Thủ Đức' },
        { dep: 'Sài Gòn', des: 'Phan Thiết', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Phan Thiết' },
        { dep: 'Phan Thiết', des: 'Sài Gòn', depStation: 'Bến xe Phan Thiết', desStation: '1 Võ Văn Ngân, Thủ Đức' }
    ];
    document.getElementById('trip-route').innerHTML = routes.map(r => 
        \`<option value="\${r.dep}|\${r.des}|\${r.depStation}|\${r.desStation}">\${r.dep} ➔ \${r.des}</option>\`
    ).join('');
}`;

const saveTripOld = `async function saveTrip(e) {
    e.preventDefault();
    const id = document.getElementById('trip-id').value;
    const isEdit = !!id;
    // Tạm thời giả lập gọi API
    showLoading();
    setTimeout(() => {
        hideLoading();
        closeTripModal();
        alert(isEdit ? 'Đã cập nhật chuyến xe thành công!' : 'Đã thêm chuyến xe mới thành công!');
        loadTrips();
    }, 500);
}`;

const saveTripNew = `async function saveTrip(e) {
    e.preventDefault();
    const id = document.getElementById('trip-id').value;
    const isEdit = !!id;
    
    const dateStr = document.getElementById('trip-date').value;
    const timeStr = document.getElementById('trip-time').value;
    const depTime = new Date(\`\${dateStr}T\${timeStr}\`);
    const price = document.getElementById('trip-price').value;
    const route = document.getElementById('trip-route').value;
    const busId = document.getElementById('trip-bus').value;
    
    const routeParts = route.split('|');
    const departurePoint = routeParts[0] || 'Sài Gòn';
    const destinationPoint = routeParts[1] || 'Đà Lạt';
    const departureStation = routeParts[2] || '';
    const destinationStation = routeParts[3] || '';
    
    const payload = {
        busId,
        departureTime: depTime.toISOString(),
        price,
        departurePoint,
        destinationPoint,
        departureStation,
        destinationStation
    };

    if (!isEdit) {
        payload.tripId = \`YOLO-\${dateStr.replace(/-/g, '').substring(4)}-\${Math.floor(Math.random() * 10000)}\`;
    }
    
    try {
        showLoading();
        const res = await fetch(\`\${API_BASE}/trips\${isEdit ? '/' + id : ''}\`, {
            method: isEdit ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        hideLoading();
        if (data.success) {
            closeTripModal();
            alert(data.message);
            loadTrips();
        } else {
            alert('Lỗi: ' + data.message);
        }
    } catch(err) {
        hideLoading();
        alert('Lỗi kết nối máy chủ');
    }
}`;


const saveCustomerOld = `async function saveCustomer(e) {
    e.preventDefault();
    const id = document.getElementById('customer-id').value;
    const name = document.getElementById('customer-name').value;
    const phone = document.getElementById('customer-phone').value;
    const email = document.getElementById('customer-email').value;

    try {
        showLoading();
        const res = await fetch(\`\${API_BASE}/customers/\${id}\`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ FullName: name, PhoneNumber: phone, Email: email })
        });
        const data = await res.json();
        hideLoading();
        if (data.success) {
            closeCustomerModal();
            loadCustomers();
        } else {
            alert('Cập nhật thất bại: ' + (data.message || 'Lỗi hệ thống'));
        }
    } catch(err) {
        hideLoading();
        console.error(err);
        alert('Lỗi kết nối máy chủ');
    }
}`;

const saveCustomerNew = `async function saveCustomer(e) {
    e.preventDefault();
    const id = document.getElementById('customer-id').value;
    const name = document.getElementById('customer-name').value;
    const phone = document.getElementById('customer-phone').value;
    const email = document.getElementById('customer-email').value;

    const isEdit = !!id;
    const method = isEdit ? 'PUT' : 'POST';
    const url = isEdit ? \`\${API_BASE}/customers/\${id}\` : \`\${API_BASE}/customers\`;

    try {
        showLoading();
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName: name, phone: phone, email: email })
        });
        const data = await res.json();
        hideLoading();
        if (data.success) {
            closeCustomerModal();
            loadCustomers();
        } else {
            alert((isEdit ? 'Cập nhật' : 'Thêm mới') + ' thất bại: ' + (data.message || 'Lỗi hệ thống'));
        }
    } catch(err) {
        hideLoading();
        console.error(err);
        alert('Lỗi kết nối máy chủ');
    }
}`;

content = content.replace(loadSelectOptionsOld, loadSelectOptionsNew);
content = content.replace(loadSelectOptionsOld.replace(/\r\n/g, '\n'), loadSelectOptionsNew);

content = content.replace(saveTripOld, saveTripNew);
content = content.replace(saveTripOld.replace(/\r\n/g, '\n'), saveTripNew);

content = content.replace(saveCustomerOld, saveCustomerNew);
content = content.replace(saveCustomerOld.replace(/\r\n/g, '\n'), saveCustomerNew);

fs.writeFileSync('admin.js', content, 'utf8');
console.log('Patched admin.js part 2 successfully');
