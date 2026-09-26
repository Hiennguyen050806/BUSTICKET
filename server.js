const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// =======================================================================
// CẤU HÌNH KẾT NỐI MS SQL SERVER (Tùy chọn)
// =======================================================================
const dbConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'BusTicketDB',
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433'),
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 2000
    }
};

let sql = null;
let mssqlPool = null;
let useMSSQL = false;

try {
    sql = require('mssql');
} catch (e) {
    console.log('[Info] Module mssql chưa được nạp, sử dụng Embedded Data Engine.');
}

async function initMSSQL() {
    if (!sql) return false;
    try {
        mssqlPool = await new sql.ConnectionPool(dbConfig).connect();
        useMSSQL = true;
        console.log('✅ Đã kết nối thành công tới Microsoft SQL Server (BusTicketDB)!');
        return true;
    } catch (err) {
        useMSSQL = false;
        console.log('ℹ️ Sử dụng Embedded Data Engine độc lập (YOLO Bus Lines):', err.message);
        return false;
    }
}

// =======================================================================
// EMBEDDED DATA ENGINE (Bộ lưu trữ dữ liệu tự động & độc lập)
// =======================================================================
const DATA_FILE = path.join(__dirname, 'busticket_data.json');

// Danh sách bến xe / trạm đón trả chuẩn (Trụ sở chính duy nhất tại 1 Võ Văn Ngân, Thủ Đức)
const INITIAL_STATIONS = [
    { city: 'Sài Gòn', name: 'Trụ sở chính: 1 Võ Văn Ngân, TP. Thủ Đức', address: '1 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP.HCM' },
    { city: 'Sài Gòn', name: 'Bến xe Miền Tây', address: '395 Kinh Dương Vương, An Lạc, Bình Tân, TP.HCM' },
    { city: 'Sài Gòn', name: 'Bến xe Miền Đông Mới', address: '501 Hoàng Hữu Nam, Long Bình, TP. Thủ Đức, TP.HCM' },
    { city: 'Đà Lạt', name: 'Bến xe Liên tỉnh Đà Lạt', address: 'Số 01 Tô Hiến Thành, Phường 3, TP. Đà Lạt' },
    { city: 'Đà Lạt', name: 'Trung chuyển nội thành Đà Lạt', address: 'Bán kính 5km trung tâm TP. Đà Lạt' },
    { city: 'Cần Thơ', name: 'Bến xe Trung tâm Cần Thơ', address: 'Đường dẫn cầu Cần Thơ, Hưng Thạnh, Cái Răng, Cần Thơ' },
    { city: 'Nha Trang', name: 'Bến xe Phía Nam Nha Trang', address: 'Km 6 đường 23/10, Vĩnh Trung, TP. Nha Trang' },
    { city: 'Vũng Tàu', name: 'Bến xe Vũng Tàu', address: '192 Nam Kỳ Khởi Nghĩa, Phường Thắng Tam, TP. Vũng Tàu' },
    { city: 'Phan Thiết', name: 'Bến xe Phan Thiết', address: '01 Từ Văn Tư, Phú Trinh, TP. Phan Thiết' },
    { city: 'Đà Nẵng', name: 'Bến xe Trung tâm Đà Nẵng', address: '185 Tôn Đức Thắng, Hòa Minh, Liên Chiểu, Đà Nẵng' },
    { city: 'Biên Hòa', name: 'Bến xe Biên Hòa', address: 'Số 04 Nguyễn Ái Quốc, Quang Vinh, TP. Biên Hòa' }
];

function generateInitialTrips() {
    const today = new Date();
    const trips = [];
    const busTypes = [
        { type: 'Giường nằm 40 chỗ', seats: 40, basePrice: 290000 },
        { type: 'Limousine VIP 34 phòng', seats: 34, basePrice: 320000 },
        { type: 'Cabin 22 phòng VIP', seats: 22, basePrice: 420000 }
    ];

    const routes = [
        { dep: 'Sài Gòn', des: 'Đà Lạt', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Liên tỉnh Đà Lạt', durationHours: 7, base: 290000 },
        { dep: 'Đà Lạt', des: 'Sài Gòn', depStation: 'Bến xe Liên tỉnh Đà Lạt', desStation: '1 Võ Văn Ngân, Thủ Đức', durationHours: 7, base: 290000 },
        { dep: 'Sài Gòn', des: 'Cần Thơ', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Trung tâm Cần Thơ', durationHours: 3.5, base: 165000 },
        { dep: 'Cần Thơ', des: 'Sài Gòn', depStation: 'Bến xe Trung tâm Cần Thơ', desStation: '1 Võ Văn Ngân, Thủ Đức', durationHours: 3.5, base: 165000 },
        { dep: 'Sài Gòn', des: 'Nha Trang', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Phía Nam Nha Trang', durationHours: 8, base: 310000 },
        { dep: 'Nha Trang', des: 'Sài Gòn', depStation: 'Bến xe Phía Nam Nha Trang', desStation: '1 Võ Văn Ngân, Thủ Đức', durationHours: 8, base: 310000 },
        { dep: 'Sài Gòn', des: 'Vũng Tàu', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Vũng Tàu', durationHours: 2.5, base: 140000 },
        { dep: 'Vũng Tàu', des: 'Sài Gòn', depStation: 'Bến xe Vũng Tàu', desStation: '1 Võ Văn Ngân, Thủ Đức', durationHours: 2.5, base: 140000 },
        { dep: 'Sài Gòn', des: 'Phan Thiết', depStation: '1 Võ Văn Ngân, Thủ Đức', desStation: 'Bến xe Phan Thiết', durationHours: 4, base: 180000 },
        { dep: 'Phan Thiết', des: 'Sài Gòn', depStation: 'Bến xe Phan Thiết', desStation: '1 Võ Văn Ngân, Thủ Đức', durationHours: 4, base: 180000 },
        { dep: 'Biên Hòa', des: 'Đà Lạt', depStation: 'Bến xe Biên Hòa', desStation: 'Bến xe Liên tỉnh Đà Lạt', durationHours: 6.5, base: 290000 },
        { dep: 'Đà Lạt', des: 'Đà Nẵng', depStation: 'Bến xe Liên tỉnh Đà Lạt', desStation: 'Bến xe Trung tâm Đà Nẵng', durationHours: 14, base: 390000 }
    ];

    const departureHours = [
        '06:00', '07:30', '09:00', '11:15', '13:00', '15:30', '17:00', '19:30', '21:00', '22:30', '23:45'
    ];

    let tripCounter = 100;

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + dayOffset);
        const dateStr = currentDate.toISOString().split('T')[0];

        routes.forEach(route => {
            departureHours.forEach((timeStr, idx) => {
                if (route.dep !== 'Sài Gòn' && route.des !== 'Sài Gòn' && idx > 4) return;

                tripCounter++;
                const bus = busTypes[idx % busTypes.length];
                const [h, m] = timeStr.split(':').map(Number);
                const depTime = new Date(currentDate);
                depTime.setHours(h, m, 0, 0);

                const arrTime = new Date(depTime);
                arrTime.setMinutes(arrTime.getMinutes() + Math.round(route.durationHours * 60));

                let price = route.base;
                if (bus.type.includes('Limousine')) price = Math.round(route.base * 1.15 / 10000) * 10000;
                if (bus.type.includes('Cabin')) price = Math.round(route.base * 1.45 / 10000) * 10000;

                const tripId = `YOLO-${dateStr.replace(/-/g, '').slice(4)}-${tripCounter}`;

                trips.push({
                    tripId,
                    departurePoint: route.dep,
                    destinationPoint: route.des,
                    departureStation: route.depStation,
                    destinationStation: route.desStation,
                    departureDate: dateStr,
                    departureTime: depTime.toISOString(),
                    arrivalTime: arrTime.toISOString(),
                    busType: bus.type,
                    totalSeats: bus.seats,
                    price: price,
                    bookedSeats: dayOffset === 0 && idx === 0 ? ['A01', 'A02'] : []
                });
            });
        });
    }

    return trips;
}

let dbData = {
    info: {
        brandName: 'YOLO Bus Lines',
        hotline: '0963076842',
        email: 'hien05082006@gmail.com',
        headquarters: '1 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP. Hồ Chí Minh'
    },
    customers: [
        { customerId: 1, fullName: 'Nguyễn Văn An', phone: '0901234567', password: '123456', email: 'an.nguyen@gmail.com' },
        { customerId: 2, fullName: 'Trần Thị Bích', phone: '0912345678', password: '123456', email: 'bich.tran@gmail.com' }
    ],
    stations: INITIAL_STATIONS,
    trips: generateInitialTrips(),
    bookings: [
        {
            bookingCode: 'YOLO-101884',
            customerId: 1,
            customerName: 'Nguyễn Văn An',
            customerPhone: '0901234567',
            customerEmail: 'an.nguyen@gmail.com',
            tripId: 'YOLO-0912-822',
            departurePoint: 'Sài Gòn',
            destinationPoint: 'Đà Lạt',
            departureStation: '1 Võ Văn Ngân, Thủ Đức',
            destinationStation: 'Bến xe Liên tỉnh Đà Lạt',
            departureTime: new Date().toISOString(),
            seats: ['A01', 'A02'],
            seatCount: 2,
            unitPrice: 290000,
            pickupPoint: 'Trụ sở chính: 1 Võ Văn Ngân, TP. Thủ Đức',
            dropoffPoint: 'Bến xe Liên tỉnh Đà Lạt',
            totalAmount: 580000,
            paymentMethod: 'VNPAY-QR',
            paymentStatus: 'Đã thanh toán',
            createdAt: new Date().toISOString()
        }
    ]
};

function loadDatabase() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed.trips && parsed.trips.length > 0) {
                dbData.customers = parsed.customers || dbData.customers;
                dbData.bookings = parsed.bookings || dbData.bookings;
                // Cập nhật bến xe mới nhất
                dbData.stations = INITIAL_STATIONS;
                // Cập nhật lại trip id sang YOLO
                dbData.trips = parsed.trips.map(t => ({
                    ...t,
                    tripId: t.tripId ? t.tripId.replace('FUTA', 'YOLO') : t.tripId,
                    departureStation: t.departureStation ? t.departureStation.replace('Bến xe Miền Tây', '1 Võ Văn Ngân, Thủ Đức') : t.departureStation
                }));
                console.log(`📂 Đã nạp ${dbData.trips.length} chuyến xe YOLO Bus Lines từ bộ nhớ lưu trữ.`);
                return;
            }
        }
    } catch (err) {
        console.error('Không thể đọc file lưu trữ, tạo bộ dữ liệu mới:', err.message);
    }
    saveDatabase();
}

function saveDatabase() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(dbData, null, 2), 'utf8');
    } catch (err) {
        console.error('Lỗi khi lưu database:', err.message);
    }
}

// =======================================================================
// RESTful API ENDPOINTS
// =======================================================================

// 0. API Kiểm tra trạng thái hệ thống
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        brand: 'YOLO Bus Lines',
        hotline: '0963076842',
        email: 'hien05082006@gmail.com',
        headquarters: '1 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP. Hồ Chí Minh',
        serverTime: new Date().toISOString(),
        databaseMode: useMSSQL ? 'Microsoft SQL Server' : 'Embedded Data Engine',
        totalTrips: dbData.trips.length,
        totalBookings: dbData.bookings.length
    });
});

// 1. API Lấy danh sách Địa điểm & Bến xe
app.get('/api/locations', (req, res) => {
    const departures = Array.from(new Set(dbData.stations.map(s => s.city)));
    const popularRoutes = [
        { from: 'Sài Gòn', to: 'Đà Lạt', price: 290000, duration: '7h' },
        { from: 'Sài Gòn', to: 'Cần Thơ', price: 165000, duration: '3.5h' },
        { from: 'Sài Gòn', to: 'Nha Trang', price: 310000, duration: '8h' },
        { from: 'Sài Gòn', to: 'Vũng Tàu', price: 140000, duration: '2.5h' },
        { from: 'Sài Gòn', to: 'Phan Thiết', price: 180000, duration: '4h' },
        { from: 'Đà Lạt', to: 'Sài Gòn', price: 290000, duration: '7h' }
    ];
    res.json({ departures, popularRoutes, stations: dbData.stations });
});

// 2. API Lấy danh sách Bến xe đón/trả theo thành phố
app.get('/api/stations', (req, res) => {
    const { city } = req.query;
    if (!city) return res.json(dbData.stations);
    const filtered = dbData.stations.filter(s => s.city.toLowerCase() === city.toLowerCase());
    res.json(filtered.length ? filtered : [
        { city, name: `Bến xe Trung tâm ${city}`, address: `Trung tâm TP. ${city}` },
        { city, name: `Trung chuyển nội thành ${city}`, address: `Đón/trả tận nơi nội ô ${city}` }
    ]);
});

// 3. API Tìm kiếm Chuyến xe
app.get('/api/trips', async (req, res) => {
    const { departure, destination, date, busType, timeSlot, sortBy } = req.query;

    try {
        let trips = dbData.trips;

        if (departure) {
            trips = trips.filter(t => t.departurePoint.toLowerCase() === departure.toLowerCase());
        }

        if (destination) {
            trips = trips.filter(t => t.destinationPoint.toLowerCase() === destination.toLowerCase());
        }

        if (date) {
            trips = trips.filter(t => {
                const tripDate = t.departureDate || t.departureTime.split('T')[0];
                return tripDate === date;
            });
        }

        if (busType && busType !== 'all') {
            trips = trips.filter(t => t.busType.toLowerCase().includes(busType.toLowerCase()));
        }

        if (timeSlot && timeSlot !== 'all') {
            trips = trips.filter(t => {
                const d = new Date(t.departureTime);
                const hour = d.getHours();
                if (timeSlot === 'early') return hour >= 0 && hour < 6;
                if (timeSlot === 'morning') return hour >= 6 && hour < 12;
                if (timeSlot === 'afternoon') return hour >= 12 && hour < 18;
                if (timeSlot === 'evening') return hour >= 18 && hour < 24;
                return true;
            });
        }

        const results = trips.map(t => {
            const bookedCount = (t.bookedSeats || []).length;
            const availableSeats = Math.max(0, t.totalSeats - bookedCount);
            return {
                ...t,
                availableSeats,
                TripID: t.tripId,
                DeparturePoint: t.departurePoint,
                DestinationPoint: t.destinationPoint,
                DepartureStation: t.departureStation,
                DestinationStation: t.destinationStation,
                DepartureTime: t.departureTime,
                ArrivalTime: t.arrivalTime,
                BusType: t.busType,
                TotalSeats: t.totalSeats,
                Price: t.price
            };
        });

        if (sortBy === 'price-asc') {
            results.sort((a, b) => a.price - b.price);
        } else if (sortBy === 'price-desc') {
            results.sort((a, b) => b.price - a.price);
        } else if (sortBy === 'time-asc') {
            results.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));
        } else if (sortBy === 'time-desc') {
            results.sort((a, b) => new Date(b.departureTime) - new Date(a.departureTime));
        } else {
            results.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));
        }

        res.json(results);
    } catch (err) {
        console.error('Lỗi Get Trips:', err);
        res.status(500).json({ success: false, message: 'Lỗi lấy dữ liệu chuyến xe!' });
    }
});

// 4. API Lấy thông tin & Sơ đồ Ghế
app.get('/api/trips/:id/seats', (req, res) => {
    const { id } = req.params;
    const trip = dbData.trips.find(t => t.tripId === id);

    if (!trip) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến xe!' });
    }

    const total = trip.totalSeats || 40;
    const half = Math.ceil(total / 2);

    const seats = [];
    for (let i = 1; i <= half; i++) {
        const numStr = i < 10 ? '0' + i : '' + i;
        const seatCode = 'A' + numStr;
        seats.push({
            seatNumber: seatCode,
            deck: 1,
            label: `Tầng dưới - ${seatCode}`,
            price: trip.price,
            isBooked: (trip.bookedSeats || []).includes(seatCode)
        });
    }

    for (let i = 1; i <= (total - half); i++) {
        const numStr = i < 10 ? '0' + i : '' + i;
        const seatCode = 'B' + numStr;
        seats.push({
            seatNumber: seatCode,
            deck: 2,
            label: `Tầng trên - ${seatCode}`,
            price: trip.price,
            isBooked: (trip.bookedSeats || []).includes(seatCode)
        });
    }

    res.json({
        tripId: trip.tripId,
        busType: trip.busType,
        totalSeats: trip.totalSeats,
        price: trip.price,
        departurePoint: trip.departurePoint,
        destinationPoint: trip.destinationPoint,
        departureTime: trip.departureTime,
        seats
    });
});

// 5. API Đăng Ký Tài Khoản
app.post('/api/register', async (req, res) => {
    const { fullname, phone, password, email } = req.body;
    if (!phone || !password || !fullname) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ họ tên, số điện thoại và mật khẩu!' });
    }

    const cleanPhone = String(phone).trim();
    const cleanPass = String(password);

    // 1. Kiểm tra Số điện thoại: bắt đầu từ 0, độ dài lớn hơn 9 và nhỏ hơn 12 (10 hoặc 11 số)
    if (!cleanPhone.startsWith('0')) {
        return res.status(400).json({ success: false, message: 'Số điện thoại phải bắt đầu bằng số 0!' });
    }
    if (cleanPhone.length <= 9 || cleanPhone.length >= 12) {
        return res.status(400).json({ success: false, message: 'Số điện thoại phải có độ dài lớn hơn 9 và nhỏ hơn 12 chữ số (từ 10 đến 11 số)!' });
    }
    if (!/^\d+$/.test(cleanPhone)) {
        return res.status(400).json({ success: false, message: 'Số điện thoại chỉ được chứa các chữ số!' });
    }

    // 2. Kiểm tra Mật khẩu: phải có chữ, số và có chữ viết hoa
    const hasUpper = /[A-Z]/.test(cleanPass);
    const hasNumber = /[0-9]/.test(cleanPass);
    const hasLetter = /[a-zA-Z]/.test(cleanPass);

    if (!hasUpper) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải chứa ít nhất một chữ cái viết hoa (A-Z)!' });
    }
    if (!hasNumber) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải chứa ít nhất một chữ số (0-9)!' });
    }
    if (!hasLetter) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải chứa các chữ cái!' });
    }
    if (cleanPass.length < 6) {
        return res.status(400).json({ success: false, message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự!' });
    }

    const exists = dbData.customers.some(c => c.phone === cleanPhone);
    if (exists) {
        return res.status(400).json({ success: false, message: 'Số điện thoại này đã được đăng ký!' });
    }

    const newCustomer = {
        customerId: dbData.customers.length + 1,
        fullName: fullname,
        phone: cleanPhone,
        password: cleanPass,
        email: email || '',
        createdAt: new Date().toISOString()
    };
    dbData.customers.push(newCustomer);
    saveDatabase();

    res.json({ success: true, message: 'Đăng ký tài khoản YOLO thành công!' });
});

// 6. API Đăng Nhập
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;

    const user = dbData.customers.find(c => c.phone === phone && c.password === password);
    if (user) {
        return res.json({
            success: true,
            user: {
                CustomerID: user.customerId,
                FullName: user.fullName,
                PhoneNumber: user.phone,
                Email: user.email
            }
        });
    }

    res.status(401).json({ success: false, message: 'Số điện thoại hoặc mật khẩu không chính xác!' });
});

// 7. API Đặt Vé Mới
app.post('/api/bookings', async (req, res) => {
    const {
        tripId,
        customerName,
        customerPhone,
        customerEmail,
        seats,
        pickupPoint,
        dropoffPoint,
        paymentMethod
    } = req.body;

    if (!tripId || !customerName || !customerPhone || !seats || !seats.length) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin chuyến xe, khách hàng hoặc vị trí ghế!' });
    }

    const trip = dbData.trips.find(t => t.tripId === tripId);
    if (!trip) {
        return res.status(404).json({ success: false, message: 'Chuyến xe không tồn tại!' });
    }

    const alreadyBooked = seats.filter(s => (trip.bookedSeats || []).includes(s));
    if (alreadyBooked.length > 0) {
        return res.status(400).json({
            success: false,
            message: `Rất tiếc! Ghế ${alreadyBooked.join(', ')} vừa có người khác đặt. Vui lòng chọn ghế khác.`
        });
    }

    if (!trip.bookedSeats) trip.bookedSeats = [];
    trip.bookedSeats.push(...seats);

    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const bookingCode = `YOLO-${randomSuffix}`;
    const totalAmount = seats.length * trip.price;

    const newBooking = {
        bookingCode,
        tripId: trip.tripId,
        departurePoint: trip.departurePoint,
        destinationPoint: trip.destinationPoint,
        departureStation: trip.departureStation,
        destinationStation: trip.destinationStation,
        departureTime: trip.departureTime,
        busType: trip.busType,
        customerName,
        customerPhone,
        customerEmail: customerEmail || '',
        seats,
        seatCount: seats.length,
        unitPrice: trip.price,
        totalAmount,
        pickupPoint: pickupPoint || trip.departureStation,
        dropoffPoint: dropoffPoint || trip.destinationStation,
        paymentMethod: paymentMethod || 'VNPAY-QR',
        paymentStatus: 'Đã thanh toán',
        createdAt: new Date().toISOString()
    };

    dbData.bookings.unshift(newBooking);
    saveDatabase();

    res.json({
        success: true,
        message: 'Đặt vé YOLO thành công!',
        booking: newBooking
    });
});

// 8. API Tra cứu vé
app.get('/api/bookings/lookup', (req, res) => {
    const { code, phone } = req.query;
    if (!code && !phone) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập Mã vé hoặc Số điện thoại để tra cứu!' });
    }

    const booking = dbData.bookings.find(b => {
        const matchCode = code ? b.bookingCode.toUpperCase() === code.trim().toUpperCase() : true;
        const matchPhone = phone ? b.customerPhone.trim() === phone.trim() : true;
        return matchCode && matchPhone;
    });

    if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin vé phù hợp!' });
    }

    res.json({ success: true, booking });
});

// 9. API Lịch sử vé theo Số điện thoại
app.get('/api/bookings/user/:phone', (req, res) => {
    const { phone } = req.params;
    const list = dbData.bookings.filter(b => b.customerPhone === phone);
    res.json({ success: true, count: list.length, bookings: list });
});

// 10. API Hủy Vé
app.post('/api/bookings/:code/cancel', (req, res) => {
    const { code } = req.params;
    const booking = dbData.bookings.find(b => b.bookingCode.toUpperCase() === code.toUpperCase());

    if (!booking) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy vé cần hủy!' });
    }

    if (booking.paymentStatus === 'Đã hủy') {
        return res.status(400).json({ success: false, message: 'Vé này đã được hủy trước đó!' });
    }

    const trip = dbData.trips.find(t => t.tripId === booking.tripId);
    if (trip && trip.bookedSeats) {
        trip.bookedSeats = trip.bookedSeats.filter(s => !booking.seats.includes(s));
    }

    booking.paymentStatus = 'Đã hủy';
    saveDatabase();

    res.json({ success: true, message: `Đã hủy vé ${booking.bookingCode} thành công. Các ghế đã được mở lại.` });
});

// 11. API Lấy Bảng Lịch Trình
app.get('/api/schedules', (req, res) => {
    const schedules = [
        { route: 'TP. Hồ Chí Minh (Thủ Đức) ⇄ Đà Lạt', distance: '310 km', duration: '7 - 8 giờ', price: '290.000đ - 420.000đ', type: 'Giường nằm, Limousine VIP, Cabin', frequency: '30 phút / chuyến' },
        { route: 'TP. Hồ Chí Minh (Thủ Đức) ⇄ Cần Thơ', distance: '170 km', duration: '3.5 giờ', price: '165.000đ - 190.000đ', type: 'Giường nằm 40 chỗ, Limousine', frequency: '30 phút / chuyến' },
        { route: 'TP. Hồ Chí Minh (Thủ Đức) ⇄ Nha Trang', distance: '440 km', duration: '8 - 9 giờ', price: '310.000đ - 440.000đ', type: 'Limousine 34 phòng, Cabin VIP', frequency: '1 giờ / chuyến' },
        { route: 'TP. Hồ Chí Minh (Thủ Đức) ⇄ Vũng Tàu', distance: '105 km', duration: '2.5 giờ', price: '140.000đ - 160.000đ', type: 'Ghế ngồi cao cấp, Limousine', frequency: '15 phút / chuyến' },
        { route: 'TP. Hồ Chí Minh (Thủ Đức) ⇄ Phan Thiết', distance: '210 km', duration: '4 - 5 giờ', price: '180.000đ - 220.000đ', type: 'Giường nằm 40 chỗ', frequency: '1 giờ / chuyến' },
        { route: 'Đà Lạt ⇄ Đà Nẵng', distance: '660 km', duration: '14 giờ', price: '390.000đ - 450.000đ', type: 'Limousine VIP', frequency: '2 chuyến / ngày' },
        { route: 'Biên Hòa ⇄ Đà Lạt', distance: '280 km', duration: '6.5 giờ', price: '290.000đ - 320.000đ', type: 'Giường nằm, Limousine VIP', frequency: '2 giờ / chuyến' }
    ];
    res.json(schedules);
});

// Khởi động server
loadDatabase();
initMSSQL().then(() => {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🚀 HỆ THỐNG ĐẶT VÉ XE KHÁCH YOLO BUS LINES`);
        console.log(`📡 Server đang chạy tại: http://localhost:${PORT}`);
        console.log(`🏢 Trụ sở chính: 1 Võ Văn Ngân, TP. Thủ Đức, TP.HCM`);
        console.log(`📞 Hotline CSKH: 0963076842 | ✉️ Email: hien05082006@gmail.com`);
        console.log(`💾 Trạng thái Database: ${useMSSQL ? 'SQL Server (BusTicketDB)' : 'Embedded Data Engine (Sẵn sàng 100%)'}`);
        console.log(`=======================================================`);
    });
});