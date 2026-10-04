require('dotenv').config();
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
// CẤU HÌNH KẾT NỐI MS SQL SERVER
// =======================================================================
// Hỗ trợ Windows Authentication (Trusted Connection) HOẶC SQL Server Auth
const useTrustedConnection = process.env.DB_TRUSTED === 'true' || !process.env.DB_USER;
const dbConfig = {
    database: process.env.DB_NAME || 'BusTicketDB',
    server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 10000,
        trustedConnection: useTrustedConnection,
        // Dùng Windows Auth khi không có user/password hoặc DB_TRUSTED=true
    }
};
if (!useTrustedConnection) {
    dbConfig.user = process.env.DB_USER;
    dbConfig.password = process.env.DB_PASSWORD;
    if (process.env.DB_PORT) dbConfig.port = parseInt(process.env.DB_PORT);
}

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
// HELPER: Map SQL Trip row sang format frontend
// =======================================================================
function mapTripFromSQL(row) {
    const bookedSeats = row.BookedSeatsList ? row.BookedSeatsList.split(',').filter(Boolean) : [];
    return {
        tripId: row.TripID,
        departurePoint: row.DeparturePoint,
        destinationPoint: row.DestinationPoint,
        departureStation: row.DepartureStation,
        destinationStation: row.DestinationStation,
        departureDate: row.DepartureTime ? new Date(row.DepartureTime).toISOString().split('T')[0] : '',
        departureTime: row.DepartureTime,
        arrivalTime: row.ArrivalTime,
        busType: row.BusType,
        totalSeats: row.TotalSeats,
        price: Number(row.Price),
        bookedSeats: bookedSeats,
        availableSeats: row.TotalSeats - bookedSeats.length,
        // PascalCase aliases cho frontend
        TripID: row.TripID,
        DeparturePoint: row.DeparturePoint,
        DestinationPoint: row.DestinationPoint,
        DepartureStation: row.DepartureStation,
        DestinationStation: row.DestinationStation,
        DepartureTime: row.DepartureTime,
        ArrivalTime: row.ArrivalTime,
        BusType: row.BusType,
        TotalSeats: row.TotalSeats,
        Price: Number(row.Price)
    };
}

// =======================================================================
// EMBEDDED DATA ENGINE (Bộ lưu trữ dữ liệu dự phòng)
// =======================================================================
const DATA_FILE = path.join(__dirname, 'busticket_data.json');

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

const INITIAL_BUSES = [
    { busId: 1, plateNumber: '51B-123.45', busType: 'Giường nằm 40 chỗ', totalSeats: 40, deckCount: 2 },
    { busId: 2, plateNumber: '51B-678.90', busType: 'Limousine VIP 34 phòng', totalSeats: 34, deckCount: 2 },
    { busId: 3, plateNumber: '51B-999.88', busType: 'Cabin 22 phòng VIP', totalSeats: 22, deckCount: 2 },
    { busId: 4, plateNumber: '49B-012.34', busType: 'Giường nằm 40 chỗ', totalSeats: 40, deckCount: 2 },
    { busId: 5, plateNumber: '79B-555.66', busType: 'Limousine VIP 34 phòng', totalSeats: 34, deckCount: 2 },
    { busId: 6, plateNumber: '72B-888.99', busType: 'Giường nằm 40 chỗ', totalSeats: 40, deckCount: 2 },
    { busId: 7, plateNumber: '51B-111.22', busType: 'Cabin 22 phòng VIP', totalSeats: 22, deckCount: 2 },
    { busId: 8, plateNumber: '49B-333.44', busType: 'Limousine VIP 34 phòng', totalSeats: 34, deckCount: 2 }
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

    const departureHours = ['06:00', '08:00', '10:30', '13:00', '15:30', '18:00', '21:00'];
    let tripCounter = 10000;

    // Sinh chuyến xe từ -30 ngày đến +7 ngày
    for (let dayOffset = -30; dayOffset < 7; dayOffset++) {
        const currentDate = new Date(today);
        currentDate.setDate(today.getDate() + dayOffset);
        const dateStr = currentDate.toISOString().split('T')[0];

        routes.forEach((route, rIdx) => {
            const maxTimes = (rIdx < 10) ? departureHours.length : 3;
            for (let idx = 0; idx < maxTimes; idx++) {
                tripCounter++;
                const bus = busTypes[idx % busTypes.length];
                const [h, m] = departureHours[idx].split(':').map(Number);
                const depTime = new Date(currentDate);
                depTime.setHours(h, m, 0, 0);

                const arrTime = new Date(depTime);
                arrTime.setMinutes(arrTime.getMinutes() + Math.round(route.durationHours * 60));

                let price = route.base;
                if (bus.type.includes('Limousine')) price = Math.round(route.base * 1.15 / 10000) * 10000;
                if (bus.type.includes('Cabin')) price = Math.round(route.base * 1.45 / 10000) * 10000;

                const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
                const dd = String(currentDate.getDate()).padStart(2, '0');
                const tripId = `YOLO-${mm}${dd}-${tripCounter}`;

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
                    bookedSeats: []
                });
            }
        });
    }
    return trips;
}

// Sinh dữ liệu vé đặt mẫu cho chuyến xe quá khứ
function generateSeedBookings() {
    const now = new Date();
    const pastTrips = dbData.trips.filter(t => new Date(t.departureTime) < now);
    const bookings = [];
    const customers = [
        { name: 'Nguyễn Văn An', phone: '0901234567', email: 'an.nguyen@gmail.com' },
        { name: 'Trần Thị Bích', phone: '0912345678', email: 'bich.tran@gmail.com' },
        { name: 'Lê Hoàng Minh', phone: '0988776655', email: 'minh.le@gmail.com' },
        { name: 'Phạm Thị Hương', phone: '0977665544', email: 'huong.pham@gmail.com' },
        { name: 'Võ Đình Khoa', phone: '0966554433', email: 'khoa.vo@gmail.com' },
        { name: 'Nguyễn Thị Lan', phone: '0955443322', email: 'lan.nguyen@gmail.com' },
        { name: 'Đặng Văn Phúc', phone: '0944332211', email: 'phuc.dang@gmail.com' },
        { name: 'Huỳnh Thị Mai', phone: '0933221100', email: 'mai.huynh@gmail.com' },
        { name: 'Trương Quốc Bảo', phone: '0922110099', email: 'bao.truong@gmail.com' },
        { name: 'Lý Thị Kim Ngân', phone: '0911009988', email: 'ngan.ly@gmail.com' }
    ];
    const payMethods = ['VNPAY-QR', 'BANKING', 'CASH'];

    // Chọn ngẫu nhiên 150 chuyến quá khứ
    const shuffled = pastTrips.sort(() => 0.5 - Math.random()).slice(0, 150);

    shuffled.forEach((trip, i) => {
        const cust = customers[i % customers.length];
        const seatCount = (i % 3) + 1;
        const seats = [];
        for (let s = 0; s < seatCount; s++) {
            const seatNum = ((i * 3 + s) % 18) + 1;
            const deck = s < 2 ? 'A' : 'B';
            seats.push(deck + String(seatNum).padStart(2, '0'));
        }

        // Đánh dấu ghế đã đặt trên chuyến xe
        if (!trip.bookedSeats) trip.bookedSeats = [];
        trip.bookedSeats.push(...seats);

        const createdAt = new Date(new Date(trip.departureTime).getTime() - (i % 48 + 1) * 3600000);

        bookings.push({
            bookingCode: `YOLO-${100000 + i}`,
            customerName: cust.name,
            customerPhone: cust.phone,
            customerEmail: cust.email,
            tripId: trip.tripId,
            departurePoint: trip.departurePoint,
            destinationPoint: trip.destinationPoint,
            departureStation: trip.departureStation,
            destinationStation: trip.destinationStation,
            departureTime: trip.departureTime,
            busType: trip.busType,
            seats: seats,
            seatCount: seatCount,
            unitPrice: trip.price,
            totalAmount: trip.price * seatCount,
            pickupPoint: trip.departureStation,
            dropoffPoint: trip.destinationStation,
            paymentMethod: payMethods[i % 3],
            paymentStatus: i % 12 === 0 ? 'Đã hủy' : 'Đã thanh toán',
            createdAt: createdAt.toISOString()
        });
    });

    return bookings;
}

let dbData = {
    info: {
        brandName: 'YOLO Bus Lines',
        hotline: '0963076842',
        email: 'hien05082006@gmail.com',
        headquarters: '1 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP. Hồ Chí Minh'
    },
    customers: [
        { customerId: 1, fullName: 'Admin YOLO', phone: '0963076842', password: 'Admin123', email: 'hien05082006@gmail.com', isAdmin: true },
        { customerId: 2, fullName: 'Nguyễn Văn An', phone: '0901234567', password: 'Pass123A', email: 'an.nguyen@gmail.com' },
        { customerId: 3, fullName: 'Trần Thị Bích', phone: '0912345678', password: 'Pass123B', email: 'bich.tran@gmail.com' }
    ],
    stations: INITIAL_STATIONS,
    buses: [...INITIAL_BUSES],
    trips: [],
    bookings: []
};

function loadDatabase() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed.trips && parsed.trips.length > 0) {
                dbData.customers = parsed.customers || dbData.customers;
                dbData.buses = parsed.buses || INITIAL_BUSES;
                dbData.stations = INITIAL_STATIONS;
                dbData.trips = parsed.trips;
                dbData.bookings = parsed.bookings || [];
                console.log(`📂 Đã nạp ${dbData.trips.length} chuyến xe, ${dbData.bookings.length} vé từ bộ nhớ lưu trữ.`);
                return;
            }
        }
    } catch (err) {
        console.error('Không thể đọc file lưu trữ, tạo bộ dữ liệu mới:', err.message);
    }
    // Lần chạy đầu: sinh mới toàn bộ dữ liệu
    dbData.trips = generateInitialTrips();
    dbData.bookings = generateSeedBookings();
    saveDatabase();
    console.log(`🆕 Đã sinh ${dbData.trips.length} chuyến xe, ${dbData.bookings.length} vé mẫu.`);
}

function saveDatabase() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(dbData, null, 2), 'utf8');
    } catch (err) {
        console.error('Lỗi khi lưu database:', err.message);
    }
}

// =======================================================================
// RESTful API ENDPOINTS (User-facing)
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
        totalTrips: useMSSQL ? '(SQL Server)' : dbData.trips.length,
        totalBookings: useMSSQL ? '(SQL Server)' : dbData.bookings.length
    });
});

// 1. API Lấy danh sách Địa điểm & Bến xe
app.get('/api/locations', async (req, res) => {
    try {
        let stations = INITIAL_STATIONS;
        if (useMSSQL) {
            const result = await mssqlPool.request().query('SELECT CityName AS city, StationName AS name, Address AS address FROM Station');
            stations = result.recordset;
        }
        const departures = Array.from(new Set(stations.map(s => s.city)));
        const popularRoutes = [
            { from: 'Sài Gòn', to: 'Đà Lạt', price: 290000, duration: '7h' },
            { from: 'Sài Gòn', to: 'Cần Thơ', price: 165000, duration: '3.5h' },
            { from: 'Sài Gòn', to: 'Nha Trang', price: 310000, duration: '8h' },
            { from: 'Sài Gòn', to: 'Vũng Tàu', price: 140000, duration: '2.5h' },
            { from: 'Sài Gòn', to: 'Phan Thiết', price: 180000, duration: '4h' },
            { from: 'Đà Lạt', to: 'Sài Gòn', price: 290000, duration: '7h' }
        ];
        res.json({ departures, popularRoutes, stations });
    } catch (err) {
        console.error('Lỗi GET /api/locations:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// 2. API Lấy danh sách Bến xe theo thành phố
app.get('/api/stations', async (req, res) => {
    try {
        const { city } = req.query;
        if (useMSSQL) {
            if (!city) {
                const result = await mssqlPool.request().query('SELECT CityName AS city, StationName AS name, Address AS address FROM Station');
                return res.json(result.recordset);
            }
            const result = await mssqlPool.request()
                .input('city', sql.NVarChar, city)
                .query('SELECT CityName AS city, StationName AS name, Address AS address FROM Station WHERE CityName = @city');
            return res.json(result.recordset.length ? result.recordset : [
                { city, name: `Bến xe Trung tâm ${city}`, address: `Trung tâm TP. ${city}` }
            ]);
        }
        // Embedded mode
        if (!city) return res.json(dbData.stations);
        const filtered = dbData.stations.filter(s => s.city.toLowerCase() === city.toLowerCase());
        res.json(filtered.length ? filtered : [
            { city, name: `Bến xe Trung tâm ${city}`, address: `Trung tâm TP. ${city}` }
        ]);
    } catch (err) {
        console.error('Lỗi GET /api/stations:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// 3. API Tìm kiếm Chuyến xe
app.get('/api/trips', async (req, res) => {
    const { departure, destination, date, busType, timeSlot, sortBy } = req.query;
    try {
        if (useMSSQL) {
            // === SQL SERVER MODE ===
            let whereClause = ' WHERE t.DepartureTime >= DATEADD(hour, 1, GETDATE())';
            const request = mssqlPool.request();

            if (departure) {
                whereClause += ' AND t.DeparturePoint = @dep';
                request.input('dep', sql.NVarChar, departure);
            }
            if (destination) {
                whereClause += ' AND t.DestinationPoint = @des';
                request.input('des', sql.NVarChar, destination);
            }
            if (date) {
                whereClause += ' AND CAST(t.DepartureTime AS DATE) = @date';
                request.input('date', sql.VarChar, date);
            }
            if (busType && busType !== 'all') {
                whereClause += ' AND b.BusType LIKE @busType';
                request.input('busType', sql.NVarChar, '%' + busType + '%');
            }
            if (timeSlot && timeSlot !== 'all') {
                if (timeSlot === 'early') whereClause += ' AND DATEPART(HOUR, t.DepartureTime) >= 0 AND DATEPART(HOUR, t.DepartureTime) < 6';
                else if (timeSlot === 'morning') whereClause += ' AND DATEPART(HOUR, t.DepartureTime) >= 6 AND DATEPART(HOUR, t.DepartureTime) < 12';
                else if (timeSlot === 'afternoon') whereClause += ' AND DATEPART(HOUR, t.DepartureTime) >= 12 AND DATEPART(HOUR, t.DepartureTime) < 18';
                else if (timeSlot === 'evening') whereClause += ' AND DATEPART(HOUR, t.DepartureTime) >= 18 AND DATEPART(HOUR, t.DepartureTime) < 24';
            }

            let orderClause = ' ORDER BY t.DepartureTime ASC';
            if (sortBy === 'price-asc') orderClause = ' ORDER BY t.Price ASC';
            else if (sortBy === 'price-desc') orderClause = ' ORDER BY t.Price DESC';
            else if (sortBy === 'time-desc') orderClause = ' ORDER BY t.DepartureTime DESC';

            const result = await request.query(`
                SELECT t.TripID, t.DeparturePoint, t.DestinationPoint,
                       t.DepartureStation, t.DestinationStation,
                       t.DepartureTime, t.ArrivalTime, t.Price, t.Status,
                       b.BusType, b.TotalSeats,
                       ISNULL(STUFF((SELECT ',' + bd.SeatNumber
                              FROM BookingDetail bd
                              JOIN Booking bk ON bd.BookingID = bk.BookingID
                              WHERE bk.TripID = t.TripID AND bk.PaymentStatus != N'Đã hủy'
                              FOR XML PATH('')), 1, 1, ''), '') AS BookedSeatsList
                FROM Trip t
                JOIN Bus b ON t.BusID = b.BusID
                ${whereClause}
                ${orderClause}
            `);

            return res.json(result.recordset.map(mapTripFromSQL));
        }

        // === EMBEDDED MODE ===
        let trips = dbData.trips.filter(t => new Date(t.departureTime).getTime() >= Date.now() + 60 * 60 * 1000);
        if (departure) trips = trips.filter(t => t.departurePoint.toLowerCase() === departure.toLowerCase());
        if (destination) trips = trips.filter(t => t.destinationPoint.toLowerCase() === destination.toLowerCase());
        if (date) {
            const [y, m, d] = date.split('-');
            trips = trips.filter(t => {
                const tripDate = new Date(t.departureTime);
                return tripDate.getFullYear() == y && (tripDate.getMonth() + 1) == m && tripDate.getDate() == d;
            });
        }
        if (busType && busType !== 'all') {
            trips = trips.filter(t => t.busType.toLowerCase().includes(busType.toLowerCase()));
        }
        if (timeSlot && timeSlot !== 'all') {
            trips = trips.filter(t => {
                const hour = new Date(t.departureTime).getHours();
                if (timeSlot === 'early') return hour >= 0 && hour < 6;
                if (timeSlot === 'morning') return hour >= 6 && hour < 12;
                if (timeSlot === 'afternoon') return hour >= 12 && hour < 18;
                if (timeSlot === 'evening') return hour >= 18 && hour < 24;
                return true;
            });
        }

        const results = trips.map(t => {
            const bookedCount = (t.bookedSeats || []).length;
            return {
                ...t,
                availableSeats: Math.max(0, t.totalSeats - bookedCount),
                TripID: t.tripId, DeparturePoint: t.departurePoint,
                DestinationPoint: t.destinationPoint, DepartureStation: t.departureStation,
                DestinationStation: t.destinationStation, DepartureTime: t.departureTime,
                ArrivalTime: t.arrivalTime, BusType: t.busType,
                TotalSeats: t.totalSeats, Price: t.price
            };
        });

        if (sortBy === 'price-asc') results.sort((a, b) => a.price - b.price);
        else if (sortBy === 'price-desc') results.sort((a, b) => b.price - a.price);
        else if (sortBy === 'time-desc') results.sort((a, b) => new Date(b.departureTime) - new Date(a.departureTime));
        else results.sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));

        res.json(results);
    } catch (err) {
        console.error('Lỗi GET /api/trips:', err);
        res.status(500).json({ success: false, message: 'Lỗi lấy dữ liệu chuyến xe!' });
    }
});

// 4. API Lấy Sơ đồ Ghế
app.get('/api/trips/:id/seats', async (req, res) => {
    const { id } = req.params;
    try {
        if (useMSSQL) {
            const tripResult = await mssqlPool.request()
                .input('id', sql.VarChar, id)
                .query(`SELECT t.*, b.BusType, b.TotalSeats
                        FROM Trip t JOIN Bus b ON t.BusID = b.BusID
                        WHERE t.TripID = @id`);
            if (!tripResult.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến xe!' });

            const trip = tripResult.recordset[0];
            const bookedResult = await mssqlPool.request()
                .input('tripId', sql.VarChar, id)
                .query(`SELECT bd.SeatNumber FROM BookingDetail bd
                        JOIN Booking bk ON bd.BookingID = bk.BookingID
                        WHERE bk.TripID = @tripId AND bk.PaymentStatus != N'Đã hủy'`);
            const bookedSeats = bookedResult.recordset.map(r => r.SeatNumber);

            const total = trip.TotalSeats;
            const half = Math.ceil(total / 2);
            const seats = [];
            for (let i = 1; i <= half; i++) {
                const seatCode = 'A' + String(i).padStart(2, '0');
                seats.push({ seatNumber: seatCode, deck: 1, label: `Tầng dưới - ${seatCode}`, price: Number(trip.Price), isBooked: bookedSeats.includes(seatCode) });
            }
            for (let i = 1; i <= (total - half); i++) {
                const seatCode = 'B' + String(i).padStart(2, '0');
                seats.push({ seatNumber: seatCode, deck: 2, label: `Tầng trên - ${seatCode}`, price: Number(trip.Price), isBooked: bookedSeats.includes(seatCode) });
            }
            return res.json({ tripId: trip.TripID, busType: trip.BusType, totalSeats: total, price: Number(trip.Price), departurePoint: trip.DeparturePoint, destinationPoint: trip.DestinationPoint, departureTime: trip.DepartureTime, seats });
        }

        // Embedded mode
        const trip = dbData.trips.find(t => t.tripId === id);
        if (!trip) return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến xe!' });

        const total = trip.totalSeats || 40;
        const half = Math.ceil(total / 2);
        const seats = [];
        for (let i = 1; i <= half; i++) {
            const seatCode = 'A' + String(i).padStart(2, '0');
            seats.push({ seatNumber: seatCode, deck: 1, label: `Tầng dưới - ${seatCode}`, price: trip.price, isBooked: (trip.bookedSeats || []).includes(seatCode) });
        }
        for (let i = 1; i <= (total - half); i++) {
            const seatCode = 'B' + String(i).padStart(2, '0');
            seats.push({ seatNumber: seatCode, deck: 2, label: `Tầng trên - ${seatCode}`, price: trip.price, isBooked: (trip.bookedSeats || []).includes(seatCode) });
        }
        res.json({ tripId: trip.tripId, busType: trip.busType, totalSeats: trip.totalSeats, price: trip.price, departurePoint: trip.departurePoint, destinationPoint: trip.destinationPoint, departureTime: trip.departureTime, seats });
    } catch (err) {
        console.error('Lỗi GET /api/trips/:id/seats:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// 5. API Đăng Ký Tài Khoản
app.post('/api/register', async (req, res) => {
    const { fullname, phone, password, email } = req.body;
    if (!phone || !password || !fullname) {
        return res.status(400).json({ success: false, message: 'Vui lòng nhập đầy đủ họ tên, số điện thoại và mật khẩu!' });
    }

    const cleanPhone = String(phone).trim();
    const cleanPass = String(password);

    if (!cleanPhone.startsWith('0')) return res.status(400).json({ success: false, message: 'Số điện thoại phải bắt đầu bằng số 0!' });
    if (cleanPhone.length <= 9 || cleanPhone.length >= 12) return res.status(400).json({ success: false, message: 'Số điện thoại phải có độ dài từ 10 đến 11 chữ số!' });
    if (!/^\d+$/.test(cleanPhone)) return res.status(400).json({ success: false, message: 'Số điện thoại chỉ được chứa các chữ số!' });

    if (!/[A-Z]/.test(cleanPass)) return res.status(400).json({ success: false, message: 'Mật khẩu phải chứa ít nhất một chữ cái viết hoa (A-Z)!' });
    if (!/[0-9]/.test(cleanPass)) return res.status(400).json({ success: false, message: 'Mật khẩu phải chứa ít nhất một chữ số (0-9)!' });
    if (!/[a-zA-Z]/.test(cleanPass)) return res.status(400).json({ success: false, message: 'Mật khẩu phải chứa các chữ cái!' });
    if (cleanPass.length < 6) return res.status(400).json({ success: false, message: 'Mật khẩu phải có độ dài tối thiểu 6 ký tự!' });

    try {
        if (useMSSQL) {
            const check = await mssqlPool.request().input('phone', sql.VarChar, cleanPhone)
                .query('SELECT CustomerID FROM Customer WHERE PhoneNumber = @phone');
            if (check.recordset.length) return res.status(400).json({ success: false, message: 'Số điện thoại này đã được đăng ký!' });

            await mssqlPool.request()
                .input('name', sql.NVarChar, fullname)
                .input('phone', sql.VarChar, cleanPhone)
                .input('pass', sql.VarChar, cleanPass)
                .input('email', sql.VarChar, email || '')
                .query('INSERT INTO Customer (FullName, PhoneNumber, Password, Email) VALUES (@name, @phone, @pass, @email)');
            return res.json({ success: true, message: 'Đăng ký tài khoản YOLO thành công!' });
        }

        // Embedded mode
        const exists = dbData.customers.some(c => c.phone === cleanPhone);
        if (exists) return res.status(400).json({ success: false, message: 'Số điện thoại này đã được đăng ký!' });

        dbData.customers.push({
            customerId: dbData.customers.length + 1,
            fullName: fullname, phone: cleanPhone, password: cleanPass,
            email: email || '', createdAt: new Date().toISOString()
        });
        saveDatabase();
        res.json({ success: true, message: 'Đăng ký tài khoản YOLO thành công!' });
    } catch (err) {
        console.error('Lỗi POST /api/register:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// 6. API Đăng Nhập
app.post('/api/login', async (req, res) => {
    const { phone, password } = req.body;
    try {
        if (useMSSQL) {
            const result = await mssqlPool.request()
                .input('phone', sql.VarChar, phone)
                .input('pass', sql.VarChar, password)
                .query('SELECT CustomerID, FullName, PhoneNumber, Email, IsAdmin FROM Customer WHERE PhoneNumber = @phone AND Password = @pass');
            if (result.recordset.length) {
                const u = result.recordset[0];
                return res.json({ success: true, user: { CustomerID: u.CustomerID, FullName: u.FullName, PhoneNumber: u.PhoneNumber, Email: u.Email, IsAdmin: u.IsAdmin } });
            }
            return res.status(401).json({ success: false, message: 'Số điện thoại hoặc mật khẩu không chính xác!' });
        }

        // Embedded mode
        const user = dbData.customers.find(c => c.phone === phone && c.password === password);
        if (user) {
            return res.json({ success: true, user: { CustomerID: user.customerId, FullName: user.fullName, PhoneNumber: user.phone, Email: user.email, IsAdmin: user.isAdmin || false } });
        }
        res.status(401).json({ success: false, message: 'Số điện thoại hoặc mật khẩu không chính xác!' });
    } catch (err) {
        console.error('Lỗi POST /api/login:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// 7. API Đặt Vé Mới
app.post('/api/bookings', async (req, res) => {
    const { tripId, customerName, customerPhone, customerEmail, seats, pickupPoint, dropoffPoint, paymentMethod } = req.body;
    if (!tripId || !customerName || !customerPhone || !seats || !seats.length) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin chuyến xe, khách hàng hoặc vị trí ghế!' });
    }

    try {
        if (useMSSQL) {
            // Kiểm tra chuyến xe tồn tại
            const tripResult = await mssqlPool.request().input('tripId', sql.VarChar, tripId)
                .query('SELECT t.*, b.BusType, b.TotalSeats FROM Trip t JOIN Bus b ON t.BusID = b.BusID WHERE t.TripID = @tripId');
            if (!tripResult.recordset.length) return res.status(404).json({ success: false, message: 'Chuyến xe không tồn tại!' });
            const trip = tripResult.recordset[0];

            // Kiểm tra ghế đã đặt
            const bookedResult = await mssqlPool.request().input('tripId', sql.VarChar, tripId)
                .query(`SELECT bd.SeatNumber FROM BookingDetail bd JOIN Booking bk ON bd.BookingID = bk.BookingID
                        WHERE bk.TripID = @tripId AND bk.PaymentStatus != N'Đã hủy'`);
            const bookedSeats = bookedResult.recordset.map(r => r.SeatNumber);
            const alreadyBooked = seats.filter(s => bookedSeats.includes(s));
            if (alreadyBooked.length > 0) {
                return res.status(400).json({ success: false, message: `Rất tiếc! Ghế ${alreadyBooked.join(', ')} vừa có người khác đặt.` });
            }

            // Tạo booking
            const randomSuffix = Math.floor(100000 + Math.random() * 900000);
            const bookingCode = `YOLO-${randomSuffix}`;
            const totalAmount = seats.length * Number(trip.Price);

            const insertResult = await mssqlPool.request()
                .input('code', sql.VarChar, bookingCode)
                .input('name', sql.NVarChar, customerName)
                .input('phone', sql.VarChar, customerPhone)
                .input('email', sql.VarChar, customerEmail || '')
                .input('tripId', sql.VarChar, tripId)
                .input('pickup', sql.NVarChar, pickupPoint || trip.DepartureStation)
                .input('dropoff', sql.NVarChar, dropoffPoint || trip.DestinationStation)
                .input('total', sql.Decimal, totalAmount)
                .input('payMethod', sql.NVarChar, paymentMethod || 'VNPAY-QR')
                .query(`INSERT INTO Booking (BookingCode, CustomerName, CustomerPhone, CustomerEmail, TripID, PickupPoint, DropoffPoint, TotalAmount, PaymentMethod, PaymentStatus)
                        OUTPUT INSERTED.BookingID
                        VALUES (@code, @name, @phone, @email, @tripId, @pickup, @dropoff, @total, @payMethod, N'Chờ thanh toán')`);
            const bookingId = insertResult.recordset[0].BookingID;

            // Tạo BookingDetail cho từng ghế
            for (const seat of seats) {
                const deck = seat.startsWith('A') ? 1 : 2;
                await mssqlPool.request()
                    .input('bid', sql.Int, bookingId)
                    .input('seat', sql.VarChar, seat)
                    .input('price', sql.Decimal, Number(trip.Price))
                    .input('deck', sql.Int, deck)
                    .query('INSERT INTO BookingDetail (BookingID, SeatNumber, Price, Deck) VALUES (@bid, @seat, @price, @deck)');
            }

            const bankAcc = process.env.BANK_ACCOUNT_NO || '';
            const bankName = process.env.BANK_NAME || '';
            const qrUrl = bankAcc ? `https://qr.sepay.vn/img?acc=${bankAcc}&bank=${bankName}&amount=${totalAmount}&des=${bookingCode}` : '';

            return res.json({
                success: true, message: 'Đặt chỗ thành công! Vui lòng thanh toán.',
                booking: { bookingCode, tripId, departurePoint: trip.DeparturePoint, destinationPoint: trip.DestinationPoint, departureStation: trip.DepartureStation, destinationStation: trip.DestinationStation, departureTime: trip.DepartureTime, busType: trip.BusType, customerName, customerPhone, customerEmail: customerEmail || '', seats, seatCount: seats.length, unitPrice: Number(trip.Price), totalAmount, pickupPoint: pickupPoint || trip.DepartureStation, dropoffPoint: dropoffPoint || trip.DestinationStation, paymentMethod: paymentMethod || 'VNPAY-QR', paymentStatus: 'Chờ thanh toán', createdAt: new Date().toISOString(), qrUrl }
            });
        }

        // === EMBEDDED MODE ===
        const trip = dbData.trips.find(t => t.tripId === tripId);
        if (!trip) return res.status(404).json({ success: false, message: 'Chuyến xe không tồn tại!' });

        const alreadyBooked = seats.filter(s => (trip.bookedSeats || []).includes(s));
        if (alreadyBooked.length > 0) {
            return res.status(400).json({ success: false, message: `Rất tiếc! Ghế ${alreadyBooked.join(', ')} vừa có người khác đặt.` });
        }

        if (!trip.bookedSeats) trip.bookedSeats = [];
        trip.bookedSeats.push(...seats);

        const randomSuffix = Math.floor(100000 + Math.random() * 900000);
        const bookingCode = `YOLO-${randomSuffix}`;
        const totalAmount = seats.length * trip.price;

        const bankAcc = process.env.BANK_ACCOUNT_NO || '';
        const bankName = process.env.BANK_NAME || '';
        const qrUrl = bankAcc ? `https://qr.sepay.vn/img?acc=${bankAcc}&bank=${bankName}&amount=${totalAmount}&des=${bookingCode}` : '';

        const newBooking = {
            bookingCode, tripId: trip.tripId,
            departurePoint: trip.departurePoint, destinationPoint: trip.destinationPoint,
            departureStation: trip.departureStation, destinationStation: trip.destinationStation,
            departureTime: trip.departureTime, busType: trip.busType,
            customerName, customerPhone, customerEmail: customerEmail || '',
            seats, seatCount: seats.length, unitPrice: trip.price, totalAmount,
            pickupPoint: pickupPoint || trip.departureStation,
            dropoffPoint: dropoffPoint || trip.destinationStation,
            paymentMethod: paymentMethod || 'VNPAY-QR', paymentStatus: 'Chờ thanh toán',
            createdAt: new Date().toISOString(), qrUrl
        };
        dbData.bookings.unshift(newBooking);
        saveDatabase();
        res.json({ success: true, message: 'Đặt vé YOLO thành công!', booking: newBooking });
    } catch (err) {
        console.error('Lỗi POST /api/bookings:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// 8. API Tra cứu vé
app.get('/api/bookings/lookup', async (req, res) => {
    const { code, phone } = req.query;
    if (!code && !phone) return res.status(400).json({ success: false, message: 'Vui lòng nhập Mã vé hoặc Số điện thoại!' });

    try {
        if (useMSSQL) {
            let where = ' WHERE 1=1';
            const request = mssqlPool.request();
            if (code) { where += ' AND bk.BookingCode = @code'; request.input('code', sql.VarChar, code.trim().toUpperCase()); }
            if (phone) { where += ' AND bk.CustomerPhone = @phone'; request.input('phone', sql.VarChar, phone.trim()); }

            const result = await request.query(`
                SELECT bk.*, t.DeparturePoint, t.DestinationPoint, t.DepartureStation, t.DestinationStation,
                       t.DepartureTime, t.ArrivalTime, b.BusType,
                       ISNULL(STUFF((SELECT ',' + bd.SeatNumber FROM BookingDetail bd WHERE bd.BookingID = bk.BookingID FOR XML PATH('')), 1, 1, ''), '') AS SeatsList
                FROM Booking bk
                JOIN Trip t ON bk.TripID = t.TripID
                JOIN Bus b ON t.BusID = b.BusID
                ${where}
            `);
            if (!result.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin vé!' });

            const r = result.recordset[0];
            return res.json({
                success: true, booking: {
                    bookingCode: r.BookingCode, tripId: r.TripID,
                    departurePoint: r.DeparturePoint, destinationPoint: r.DestinationPoint,
                    departureStation: r.DepartureStation, destinationStation: r.DestinationStation,
                    departureTime: r.DepartureTime, busType: r.BusType,
                    customerName: r.CustomerName, customerPhone: r.CustomerPhone, customerEmail: r.CustomerEmail,
                    seats: r.SeatsList ? r.SeatsList.split(',') : [],
                    seatCount: r.SeatsList ? r.SeatsList.split(',').length : 0,
                    unitPrice: Number(r.TotalAmount) / Math.max(1, r.SeatsList ? r.SeatsList.split(',').length : 1),
                    totalAmount: Number(r.TotalAmount),
                    pickupPoint: r.PickupPoint, dropoffPoint: r.DropoffPoint,
                    paymentMethod: r.PaymentMethod, paymentStatus: r.PaymentStatus,
                    createdAt: r.CreatedAt
                }
            });
        }

        // Embedded mode
        const booking = dbData.bookings.find(b => {
            const matchCode = code ? b.bookingCode.toUpperCase() === code.trim().toUpperCase() : true;
            const matchPhone = phone ? b.customerPhone.trim() === phone.trim() : true;
            return matchCode && matchPhone;
        });
        if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin vé!' });
        res.json({ success: true, booking });
    } catch (err) {
        console.error('Lỗi GET /api/bookings/lookup:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// 9. API Lịch sử vé theo SĐT
app.get('/api/bookings/user/:phone', async (req, res) => {
    const { phone } = req.params;
    try {
        if (useMSSQL) {
            const result = await mssqlPool.request().input('phone', sql.VarChar, phone).query(`
                SELECT bk.*, t.DeparturePoint, t.DestinationPoint, t.DepartureStation, t.DestinationStation,
                       t.DepartureTime, t.ArrivalTime, b.BusType,
                       ISNULL(STUFF((SELECT ',' + bd.SeatNumber FROM BookingDetail bd WHERE bd.BookingID = bk.BookingID FOR XML PATH('')), 1, 1, ''), '') AS SeatsList
                FROM Booking bk JOIN Trip t ON bk.TripID = t.TripID JOIN Bus b ON t.BusID = b.BusID
                WHERE bk.CustomerPhone = @phone ORDER BY bk.CreatedAt DESC
            `);
            const bookings = result.recordset.map(r => ({
                bookingCode: r.BookingCode, tripId: r.TripID,
                departurePoint: r.DeparturePoint, destinationPoint: r.DestinationPoint,
                departureStation: r.DepartureStation, destinationStation: r.DestinationStation,
                departureTime: r.DepartureTime, busType: r.BusType,
                customerName: r.CustomerName, customerPhone: r.CustomerPhone, customerEmail: r.CustomerEmail,
                seats: r.SeatsList ? r.SeatsList.split(',') : [], seatCount: r.SeatsList ? r.SeatsList.split(',').length : 0,
                totalAmount: Number(r.TotalAmount), pickupPoint: r.PickupPoint, dropoffPoint: r.DropoffPoint,
                paymentMethod: r.PaymentMethod, paymentStatus: r.PaymentStatus, createdAt: r.CreatedAt
            }));
            return res.json({ success: true, count: bookings.length, bookings });
        }

        const list = dbData.bookings.filter(b => b.customerPhone === phone);
        res.json({ success: true, count: list.length, bookings: list });
    } catch (err) {
        console.error('Lỗi GET /api/bookings/user/:phone:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// 10. API Hủy Vé
app.post('/api/bookings/:code/cancel', async (req, res) => {
    const { code } = req.params;
    try {
        if (useMSSQL) {
            const check = await mssqlPool.request().input('code', sql.VarChar, code.toUpperCase())
                .query('SELECT BookingID, PaymentStatus FROM Booking WHERE BookingCode = @code');
            if (!check.recordset.length) return res.status(404).json({ success: false, message: 'Không tìm thấy vé cần hủy!' });
            if (check.recordset[0].PaymentStatus === 'Đã hủy') return res.status(400).json({ success: false, message: 'Vé này đã được hủy trước đó!' });

            await mssqlPool.request().input('code', sql.VarChar, code.toUpperCase())
                .query("UPDATE Booking SET PaymentStatus = N'Đã hủy' WHERE BookingCode = @code");
            return res.json({ success: true, message: `Đã hủy vé ${code.toUpperCase()} thành công.` });
        }

        // Embedded mode
        const booking = dbData.bookings.find(b => b.bookingCode.toUpperCase() === code.toUpperCase());
        if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy vé cần hủy!' });
        if (booking.paymentStatus === 'Đã hủy') return res.status(400).json({ success: false, message: 'Vé này đã được hủy trước đó!' });

        const trip = dbData.trips.find(t => t.tripId === booking.tripId);
        if (trip && trip.bookedSeats) {
            trip.bookedSeats = trip.bookedSeats.filter(s => !booking.seats.includes(s));
        }
        booking.paymentStatus = 'Đã hủy';
        saveDatabase();
        res.json({ success: true, message: `Đã hủy vé ${booking.bookingCode} thành công.` });
    } catch (err) {
        console.error('Lỗi POST /api/bookings/:code/cancel:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
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

// 12. API Kiểm tra thanh toán SePay
app.get('/api/payment/sepay/check/:code', async (req, res) => {
    const { code } = req.params;
    const apiKey = process.env.SEPAY_API_TOKEN;
    if (!apiKey) return res.json({ success: false, message: 'Chưa cấu hình SePay API Key' });

    try {
        // Lấy thông tin vé để biết số tiền
        let booking = null;
        if (useMSSQL) {
            const check = await mssqlPool.request().input('code', sql.VarChar, code.toUpperCase()).query('SELECT BookingID, TotalAmount, PaymentStatus, CreatedAt FROM Booking WHERE BookingCode = @code');
            if (check.recordset.length) booking = check.recordset[0];
        } else {
            booking = dbData.bookings.find(b => b.bookingCode.toUpperCase() === code.toUpperCase());
        }

        if (!booking) return res.status(404).json({ success: false, message: 'Không tìm thấy vé' });

        // Nếu đã thanh toán rồi thì trả về thành công luôn
        if ((booking.PaymentStatus || booking.paymentStatus) === 'Đã thanh toán') {
            return res.json({ success: true, message: 'Đã thanh toán thành công' });
        }

        const totalAmount = Number(booking.TotalAmount || booking.totalAmount || 0);
        const bookingTime = new Date(booking.CreatedAt || booking.createdAt || 0).getTime();

        // Chuẩn hóa mã vé (loại bỏ ký tự đặc biệt, viết hoa)
        const normCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '');
        const numCode = code.replace(/\D/g, ''); // Lấy riêng phần số (vd: 286095)

        // Gọi SePay API lấy danh sách giao dịch gần nhất
        const sepayRes = await fetch(`https://my.sepay.vn/userapi/transactions/list?limit=50`, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });
        const sepayData = await sepayRes.json();

        if (sepayData.status === 200 && Array.isArray(sepayData.transactions) && sepayData.transactions.length > 0) {
            // Kiểm tra giao dịch thỏa mãn:
            // 1. Số tiền vào (amount_in) >= số tiền cần thanh toán
            // 2. Nội dung chuyển khoản (transaction_content) phải chứa mã vé
            // 3. Thời gian giao dịch không được trước khi tạo vé
            // 4. Giao dịch chưa được sử dụng cho vé khác
            const validTx = sepayData.transactions.find(tx => {
                const amountIn = Number(tx.amount_in || 0);
                if (amountIn < totalAmount) return false;

                const normContent = (tx.transaction_content || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                const hasCode = normContent.includes(normCode) || (numCode.length >= 5 && normContent.includes(numCode));
                if (!hasCode) return false;

                if (bookingTime > 0 && tx.transaction_date) {
                    const txTime = new Date(tx.transaction_date.replace(' ', 'T')).getTime();
                    // Nới lỏng kiểm tra thời gian xuống 24h để tránh lỗi lệch múi giờ 7 tiếng giữa SQL Server và Node.js
                    if (!isNaN(txTime) && txTime < (bookingTime - 24 * 60 * 60 * 1000)) {
                        return false;
                    }
                }

                if (!useMSSQL && dbData && dbData.bookings) {
                    const alreadyClaimed = dbData.bookings.some(b => b.sepayTransactionId && String(b.sepayTransactionId) === String(tx.id) && b.bookingCode !== code);
                    if (alreadyClaimed) return false;
                }

                return true;
            });

            if (validTx) {
                // Cập nhật trạng thái vé thành "Đã thanh toán"
                if (useMSSQL) {
                    await mssqlPool.request().input('code', sql.VarChar, code.toUpperCase()).query("UPDATE Booking SET PaymentStatus = N'Đã thanh toán' WHERE BookingCode = @code");
                } else {
                    booking.paymentStatus = 'Đã thanh toán';
                    booking.sepayTransactionId = validTx.id;
                    booking.sepayReference = validTx.reference_number;
                    booking.paidAt = new Date().toISOString();
                    saveDatabase();
                }
                return res.json({ success: true, message: 'Thanh toán thành công qua SePay', transaction: validTx });
            }
        }
        return res.json({ success: false, message: 'Đang chờ khách hàng quét mã QR chuyển khoản' });
    } catch (err) {
        console.error('Lỗi check SePay:', err);
        res.status(500).json({ success: false, message: 'Lỗi khi kiểm tra thanh toán' });
    }
});

// 12b. Webhook SePay (Nhận thông báo tức thì khi có giao dịch chuyển khoản)
app.post('/api/payment/sepay/webhook', async (req, res) => {
    try {
        const { content, transferAmount, id, referenceCode } = req.body || {};
        if (!content || !transferAmount) {
            return res.json({ success: false, message: 'Dữ liệu webhook không hợp lệ' });
        }

        const normContent = String(content).toUpperCase().replace(/[^A-Z0-9]/g, '');
        const amount = Number(transferAmount);

        let targetBooking = null;
        if (useMSSQL) {
            const result = await mssqlPool.request().query("SELECT BookingID, BookingCode, TotalAmount, PaymentStatus FROM Booking WHERE PaymentStatus = N'Chờ thanh toán'");
            targetBooking = result.recordset.find(b => {
                const bCode = b.BookingCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
                return normContent.includes(bCode) && amount >= Number(b.TotalAmount);
            });
            if (targetBooking) {
                await mssqlPool.request().input('code', sql.VarChar, targetBooking.BookingCode).query("UPDATE Booking SET PaymentStatus = N'Đã thanh toán' WHERE BookingCode = @code");
                return res.json({ success: true, message: 'Webhook đã cập nhật vé thành công' });
            }
        } else {
            targetBooking = dbData.bookings.find(b => {
                if (b.paymentStatus !== 'Chờ thanh toán') return false;
                const bCode = b.bookingCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
                return normContent.includes(bCode) && amount >= Number(b.totalAmount);
            });
            if (targetBooking) {
                targetBooking.paymentStatus = 'Đã thanh toán';
                targetBooking.sepayTransactionId = id;
                targetBooking.sepayReference = referenceCode;
                targetBooking.paidAt = new Date().toISOString();
                saveDatabase();
                return res.json({ success: true, message: 'Webhook đã cập nhật vé thành công' });
            }
        }

        res.json({ success: false, message: 'Không tìm thấy vé khớp mã hoặc chưa đủ số tiền' });
    } catch (err) {
        console.error('Lỗi SePay Webhook:', err);
        res.status(500).json({ success: false, message: 'Lỗi server khi xử lý webhook' });
    }
});

// =======================================================================
// ADMIN API ENDPOINTS (Dashboard quản trị)
// =======================================================================

// Admin: Thống kê tổng quan
app.get('/api/admin/stats', async (req, res) => {
    try {
        if (useMSSQL) {
            const result = await mssqlPool.request().query(`
                SELECT
                    (SELECT COUNT(*) FROM Customer WHERE IsAdmin = 0) AS totalCustomers,
                    (SELECT COUNT(*) FROM Trip) AS totalTrips,
                    (SELECT COUNT(*) FROM Booking WHERE PaymentStatus = N'Đã thanh toán') AS totalBookings,
                    (SELECT ISNULL(SUM(TotalAmount), 0) FROM Booking WHERE PaymentStatus = N'Đã thanh toán') AS totalRevenue,
                    (SELECT COUNT(*) FROM Booking WHERE PaymentStatus = N'Đã hủy') AS cancelledBookings,
                    (SELECT COUNT(*) FROM Bus) AS totalBuses,
                    (SELECT COUNT(*) FROM Trip WHERE CAST(DepartureTime AS DATE) = CAST(GETDATE() AS DATE)) AS todayTrips,
                    (SELECT COUNT(*) FROM Booking WHERE CAST(CreatedAt AS DATE) = CAST(GETDATE() AS DATE) AND PaymentStatus = N'Đã thanh toán') AS todayBookings
            `);
            return res.json({ success: true, ...result.recordset[0] });
        }

        // Embedded mode
        const paidBookings = dbData.bookings.filter(b => b.paymentStatus === 'Đã thanh toán');
        const todayStr = new Date().toISOString().split('T')[0];
        res.json({
            success: true,
            totalCustomers: dbData.customers.filter(c => !c.isAdmin).length,
            totalTrips: dbData.trips.length,
            totalBookings: paidBookings.length,
            totalRevenue: paidBookings.reduce((s, b) => s + b.totalAmount, 0),
            cancelledBookings: dbData.bookings.filter(b => b.paymentStatus === 'Đã hủy').length,
            totalBuses: dbData.buses.length,
            todayTrips: dbData.trips.filter(t => t.departureDate === todayStr || (t.departureTime && t.departureTime.startsWith(todayStr))).length,
            todayBookings: paidBookings.filter(b => b.createdAt && b.createdAt.startsWith(todayStr)).length
        });
    } catch (err) {
        console.error('Lỗi GET /api/admin/stats:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// Admin: Dữ liệu biểu đồ doanh thu
app.get('/api/admin/revenue-chart', async (req, res) => {
    const { days = 30 } = req.query;
    try {
        if (useMSSQL) {
            const result = await mssqlPool.request().input('days', sql.Int, parseInt(days)).query(`
                SELECT CAST(CreatedAt AS DATE) AS date,
                       SUM(TotalAmount) AS revenue,
                       COUNT(*) AS bookingCount
                FROM Booking
                WHERE PaymentStatus = N'Đã thanh toán'
                  AND CreatedAt >= DATEADD(DAY, -@days, GETDATE())
                GROUP BY CAST(CreatedAt AS DATE)
                ORDER BY date
            `);
            return res.json({ success: true, data: result.recordset });
        }

        // Embedded mode
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - parseInt(days));
        const revenueMap = {};
        dbData.bookings
            .filter(b => b.paymentStatus === 'Đã thanh toán' && new Date(b.createdAt) >= cutoff)
            .forEach(b => {
                const date = b.createdAt.split('T')[0];
                if (!revenueMap[date]) revenueMap[date] = { date, revenue: 0, bookingCount: 0 };
                revenueMap[date].revenue += b.totalAmount;
                revenueMap[date].bookingCount++;
            });
        res.json({ success: true, data: Object.values(revenueMap).sort((a, b) => a.date.localeCompare(b.date)) });
    } catch (err) {
        console.error('Lỗi GET /api/admin/revenue-chart:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// Admin: Danh sách chuyến xe (có phân trang & lọc)
app.get('/api/admin/trips', async (req, res) => {
    const { page = 1, limit = 50, departure, destination, date, status } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
        if (useMSSQL) {
            let where = ' WHERE 1=1';
            const request = mssqlPool.request();
            if (departure) { where += ' AND t.DeparturePoint = @dep'; request.input('dep', sql.NVarChar, departure); }
            if (destination) { where += ' AND t.DestinationPoint = @des'; request.input('des', sql.NVarChar, destination); }
            if (date) { where += ' AND CAST(t.DepartureTime AS DATE) = @date'; request.input('date', sql.VarChar, date); }
            if (status) { where += ' AND t.Status = @status'; request.input('status', sql.NVarChar, status); }

            request.input('offset', sql.Int, offset).input('limit', sql.Int, parseInt(limit));
            const countResult = await mssqlPool.request().query(`SELECT COUNT(*) AS total FROM Trip t ${where}`);
            const result = await request.query(`
                SELECT t.TripID, t.DeparturePoint, t.DestinationPoint, t.DepartureStation, t.DestinationStation,
                       t.DepartureTime, t.ArrivalTime, t.Price, t.Status, t.BusID,
                       b.BusType, b.TotalSeats, b.PlateNumber
                FROM Trip t JOIN Bus b ON t.BusID = b.BusID
                ${where}
                ORDER BY t.DepartureTime DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `);
            return res.json({ success: true, total: countResult.recordset[0].total, page: parseInt(page), trips: result.recordset });
        }

        // Embedded mode
        let trips = [...dbData.trips];
        if (departure) trips = trips.filter(t => t.departurePoint === departure);
        if (destination) trips = trips.filter(t => t.destinationPoint === destination);
        if (date) {
            const [y, m, d] = date.split('-');
            trips = trips.filter(t => {
                const tripDate = new Date(t.departureTime);
                return tripDate.getFullYear() == y && (tripDate.getMonth() + 1) == m && tripDate.getDate() == d;
            });
        }
        trips.sort((a, b) => new Date(b.departureTime) - new Date(a.departureTime));
        const total = trips.length;
        trips = trips.slice(offset, offset + parseInt(limit));
        res.json({ success: true, total, page: parseInt(page), trips });
    } catch (err) {
        console.error('Lỗi GET /api/admin/trips:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// Admin: Tạo chuyến xe mới
app.post('/api/admin/trips', async (req, res) => {
    const { tripId, busId, departurePoint, destinationPoint, departureStation, destinationStation, departureTime, arrivalTime, price } = req.body;
    if (!tripId || !departurePoint || !destinationPoint || !departureTime || !price) {
        return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc!' });
    }
    try {
        if (useMSSQL) {
            await mssqlPool.request()
                .input('tripId', sql.VarChar, tripId)
                .input('busId', sql.Int, busId || 1)
                .input('dep', sql.NVarChar, departurePoint)
                .input('des', sql.NVarChar, destinationPoint)
                .input('depSt', sql.NVarChar, departureStation || '')
                .input('desSt', sql.NVarChar, destinationStation || '')
                .input('depTime', sql.DateTime, new Date(departureTime))
                .input('arrTime', sql.DateTime, new Date(arrivalTime || departureTime))
                .input('price', sql.Decimal, price)
                .query(`INSERT INTO Trip (TripID, BusID, DeparturePoint, DestinationPoint, DepartureStation, DestinationStation, DepartureTime, ArrivalTime, Price)
                        VALUES (@tripId, @busId, @dep, @des, @depSt, @desSt, @depTime, @arrTime, @price)`);
            return res.json({ success: true, message: 'Tạo chuyến xe thành công!' });
        }

        dbData.trips.push({ tripId, departurePoint, destinationPoint, departureStation: departureStation || '', destinationStation: destinationStation || '', departureDate: departureTime.split('T')[0], departureTime, arrivalTime: arrivalTime || departureTime, busType: 'Giường nằm 40 chỗ', totalSeats: 40, price, bookedSeats: [] });
        saveDatabase();
        res.json({ success: true, message: 'Tạo chuyến xe thành công!' });
    } catch (err) {
        console.error('Lỗi POST /api/admin/trips:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// Admin: Cập nhật chuyến xe
app.put('/api/admin/trips/:id', async (req, res) => {
    const { id } = req.params;
    const { price, departureTime, arrivalTime, status } = req.body;
    try {
        if (useMSSQL) {
            let setClause = [];
            const request = mssqlPool.request().input('id', sql.VarChar, id);
            if (price !== undefined) { setClause.push('Price = @price'); request.input('price', sql.Decimal, price); }
            if (departureTime) { setClause.push('DepartureTime = @depTime'); request.input('depTime', sql.DateTime, new Date(departureTime)); }
            if (arrivalTime) { setClause.push('ArrivalTime = @arrTime'); request.input('arrTime', sql.DateTime, new Date(arrivalTime)); }
            if (status) { setClause.push('Status = @status'); request.input('status', sql.NVarChar, status); }
            if (!setClause.length) return res.status(400).json({ success: false, message: 'Không có dữ liệu cập nhật!' });

            await request.query(`UPDATE Trip SET ${setClause.join(', ')} WHERE TripID = @id`);
            return res.json({ success: true, message: 'Cập nhật chuyến xe thành công!' });
        }

        const trip = dbData.trips.find(t => t.tripId === id);
        if (!trip) return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến xe!' });
        if (price !== undefined) trip.price = price;
        if (departureTime) trip.departureTime = departureTime;
        if (arrivalTime) trip.arrivalTime = arrivalTime;
        if (status) trip.status = status;
        saveDatabase();
        res.json({ success: true, message: 'Cập nhật chuyến xe thành công!' });
    } catch (err) {
        console.error('Lỗi PUT /api/admin/trips/:id:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// Admin: Xóa chuyến xe
app.delete('/api/admin/trips/:id', async (req, res) => {
    const { id } = req.params;
    try {
        if (useMSSQL) {
            // Kiểm tra có vé đặt không
            const check = await mssqlPool.request().input('id', sql.VarChar, id)
                .query("SELECT COUNT(*) AS cnt FROM Booking WHERE TripID = @id AND PaymentStatus = N'Đã thanh toán'");
            if (check.recordset[0].cnt > 0) return res.status(400).json({ success: false, message: 'Không thể xóa chuyến xe đã có vé đặt!' });

            await mssqlPool.request().input('id', sql.VarChar, id).query('DELETE FROM Trip WHERE TripID = @id');
            return res.json({ success: true, message: 'Đã xóa chuyến xe!' });
        }

        const idx = dbData.trips.findIndex(t => t.tripId === id);
        if (idx === -1) return res.status(404).json({ success: false, message: 'Không tìm thấy chuyến xe!' });
        const hasBooking = dbData.bookings.some(b => b.tripId === id && b.paymentStatus === 'Đã thanh toán');
        if (hasBooking) return res.status(400).json({ success: false, message: 'Không thể xóa chuyến xe đã có vé đặt!' });
        dbData.trips.splice(idx, 1);
        saveDatabase();
        res.json({ success: true, message: 'Đã xóa chuyến xe!' });
    } catch (err) {
        console.error('Lỗi DELETE /api/admin/trips/:id:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// Admin: Danh sách vé đặt
app.get('/api/admin/bookings', async (req, res) => {
    const { page = 1, limit = 50, status, phone } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
        if (useMSSQL) {
            let where = ' WHERE 1=1';
            const request = mssqlPool.request();
            if (status) { where += ' AND bk.PaymentStatus = @status'; request.input('status', sql.NVarChar, status); }
            if (phone) { where += ' AND bk.CustomerPhone = @phone'; request.input('phone', sql.VarChar, phone); }

            const countResult = await mssqlPool.request().query(`SELECT COUNT(*) AS total FROM Booking bk ${where}`);
            request.input('offset', sql.Int, offset).input('limit', sql.Int, parseInt(limit));
            const result = await request.query(`
                SELECT bk.BookingID, bk.BookingCode, bk.CustomerName, bk.CustomerPhone, bk.CustomerEmail,
                       bk.TripID, bk.PickupPoint, bk.DropoffPoint, bk.TotalAmount,
                       bk.PaymentMethod, bk.PaymentStatus, bk.CreatedAt,
                       t.DeparturePoint, t.DestinationPoint, t.DepartureTime, b.BusType,
                       ISNULL(STUFF((SELECT ',' + bd.SeatNumber FROM BookingDetail bd WHERE bd.BookingID = bk.BookingID FOR XML PATH('')), 1, 1, ''), '') AS SeatsList
                FROM Booking bk JOIN Trip t ON bk.TripID = t.TripID JOIN Bus b ON t.BusID = b.BusID
                ${where}
                ORDER BY bk.CreatedAt DESC
                OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
            `);
            return res.json({ success: true, total: countResult.recordset[0].total, page: parseInt(page), bookings: result.recordset });
        }

        // Embedded mode
        let bookings = [...dbData.bookings];
        if (status) bookings = bookings.filter(b => b.paymentStatus === status);
        if (phone) bookings = bookings.filter(b => b.customerPhone === phone);
        bookings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const total = bookings.length;
        bookings = bookings.slice(offset, offset + parseInt(limit));
        res.json({ success: true, total, page: parseInt(page), bookings });
    } catch (err) {
        console.error('Lỗi GET /api/admin/bookings:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// Admin: Danh sách khách hàng
app.get('/api/admin/customers', async (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    try {
        if (useMSSQL) {
            const countResult = await mssqlPool.request().query('SELECT COUNT(*) AS total FROM Customer WHERE IsAdmin = 0');
            const result = await mssqlPool.request()
                .input('offset', sql.Int, offset).input('limit', sql.Int, parseInt(limit))
                .query(`SELECT CustomerID, FullName, PhoneNumber, Email, CreatedAt,
                               (SELECT COUNT(*) FROM Booking WHERE CustomerPhone = c.PhoneNumber AND PaymentStatus = N'Đã thanh toán') AS totalBookings,
                               (SELECT ISNULL(SUM(TotalAmount), 0) FROM Booking WHERE CustomerPhone = c.PhoneNumber AND PaymentStatus = N'Đã thanh toán') AS totalSpent
                        FROM Customer c WHERE IsAdmin = 0 ORDER BY CustomerID
                        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`);
            return res.json({ success: true, total: countResult.recordset[0].total, customers: result.recordset });
        }

        // Embedded mode
        const customers = dbData.customers.filter(c => !c.isAdmin).map(c => {
            const bookings = dbData.bookings.filter(b => b.customerPhone === c.phone && b.paymentStatus === 'Đã thanh toán');
            return { ...c, totalBookings: bookings.length, totalSpent: bookings.reduce((s, b) => s + b.totalAmount, 0) };
        });
        const total = customers.length;
        res.json({ success: true, total, customers: customers.slice(offset, offset + parseInt(limit)) });
    } catch (err) {
        console.error('Lỗi GET /api/admin/customers:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// Admin: Danh sách xe khách
app.get('/api/admin/buses', async (req, res) => {
    try {
        if (useMSSQL) {
            const result = await mssqlPool.request().query(`
                SELECT b.BusID, b.PlateNumber, b.BusType, b.TotalSeats, b.DeckCount,
                       (SELECT COUNT(*) FROM Trip WHERE BusID = b.BusID) AS totalTrips
                FROM Bus b ORDER BY b.BusID
            `);
            return res.json({ success: true, buses: result.recordset });
        }
        res.json({ success: true, buses: dbData.buses });
    } catch (err) {
        console.error('Lỗi GET /api/admin/buses:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// Admin: Thêm xe khách mới
app.post('/api/admin/buses', async (req, res) => {
    const { plateNumber, busType, totalSeats, deckCount } = req.body;
    if (!plateNumber || !busType || !totalSeats) return res.status(400).json({ success: false, message: 'Thiếu thông tin!' });
    try {
        if (useMSSQL) {
            await mssqlPool.request()
                .input('plate', sql.VarChar, plateNumber)
                .input('type', sql.NVarChar, busType)
                .input('seats', sql.Int, totalSeats)
                .input('deck', sql.Int, deckCount || 2)
                .query('INSERT INTO Bus (PlateNumber, BusType, TotalSeats, DeckCount) VALUES (@plate, @type, @seats, @deck)');
            return res.json({ success: true, message: 'Thêm xe khách thành công!' });
        }

        dbData.buses.push({ busId: dbData.buses.length + 1, plateNumber, busType, totalSeats, deckCount: deckCount || 2 });
        saveDatabase();
        res.json({ success: true, message: 'Thêm xe khách thành công!' });
    } catch (err) {
        console.error('Lỗi POST /api/admin/buses:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// Admin: Cập nhật xe khách
app.put('/api/admin/buses/:id', async (req, res) => {
    const { id } = req.params;
    const { plateNumber, busType, totalSeats, deckCount } = req.body;
    try {
        if (useMSSQL) {
            let setClause = [];
            const request = mssqlPool.request().input('id', sql.Int, parseInt(id));
            if (plateNumber) { setClause.push('PlateNumber = @plate'); request.input('plate', sql.VarChar, plateNumber); }
            if (busType) { setClause.push('BusType = @type'); request.input('type', sql.NVarChar, busType); }
            if (totalSeats) { setClause.push('TotalSeats = @seats'); request.input('seats', sql.Int, totalSeats); }
            if (deckCount) { setClause.push('DeckCount = @deck'); request.input('deck', sql.Int, deckCount); }
            if (!setClause.length) return res.status(400).json({ success: false, message: 'Không có dữ liệu cập nhật!' });

            await request.query(`UPDATE Bus SET ${setClause.join(', ')} WHERE BusID = @id`);
            return res.json({ success: true, message: 'Cập nhật xe khách thành công!' });
        }

        const bus = dbData.buses.find(b => b.busId === parseInt(id));
        if (!bus) return res.status(404).json({ success: false, message: 'Không tìm thấy xe!' });
        if (plateNumber) bus.plateNumber = plateNumber;
        if (busType) bus.busType = busType;
        if (totalSeats) bus.totalSeats = totalSeats;
        if (deckCount) bus.deckCount = deckCount;
        saveDatabase();
        res.json({ success: true, message: 'Cập nhật xe khách thành công!' });
    } catch (err) {
        console.error('Lỗi PUT /api/admin/buses/:id:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// Admin: Xóa xe khách
app.delete('/api/admin/buses/:id', async (req, res) => {
    const { id } = req.params;
    try {
        if (useMSSQL) {
            const check = await mssqlPool.request().input('id', sql.Int, parseInt(id))
                .query('SELECT COUNT(*) AS cnt FROM Trip WHERE BusID = @id');
            if (check.recordset[0].cnt > 0) return res.status(400).json({ success: false, message: 'Không thể xóa xe đang có chuyến!' });

            await mssqlPool.request().input('id', sql.Int, parseInt(id)).query('DELETE FROM Bus WHERE BusID = @id');
            return res.json({ success: true, message: 'Đã xóa xe khách!' });
        }

        const idx = dbData.buses.findIndex(b => b.busId === parseInt(id));
        if (idx === -1) return res.status(404).json({ success: false, message: 'Không tìm thấy xe!' });
        dbData.buses.splice(idx, 1);
        saveDatabase();
        res.json({ success: true, message: 'Đã xóa xe khách!' });
    } catch (err) {
        console.error('Lỗi DELETE /api/admin/buses/:id:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// Admin: Cập nhật Khách Hàng

// Admin: Thêm khách hàng mới
app.post('/api/admin/customers', async (req, res) => {
    const { fullName, email, phone } = req.body;
    if (!fullName || !phone) return res.status(400).json({ success: false, message: 'Thiếu thông tin bắt buộc!' });
    try {
        if (useMSSQL) {
            await mssqlPool.request()
                .input('name', sql.NVarChar, fullName)
                .input('email', sql.VarChar, email || null)
                .input('phone', sql.VarChar, phone)
                .query(`INSERT INTO Customer (FullName, Email, PhoneNumber, Password, IsAdmin) VALUES (@name, @email, @phone, '123456', 0)`);
            return res.json({ success: true, message: 'Thêm khách hàng thành công!' });
        }

        const newId = dbData.customers.length > 0 ? Math.max(...dbData.customers.map(c => c.customerId || c.id || 0)) + 1 : 1;
        dbData.customers.push({ customerId: newId, fullName, email, phone, isAdmin: false });
        saveDatabase();
        res.json({ success: true, message: 'Thêm khách hàng thành công!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Admin: Xóa khách hàng
app.delete('/api/admin/customers/:id', async (req, res) => {
    const { id } = req.params;
    try {
        if (useMSSQL) {
            await mssqlPool.request()
                .input('id', sql.Int, id)
                .query('DELETE FROM Customer WHERE CustomerID = @id');
            return res.json({ success: true, message: 'Xóa khách hàng thành công!' });
        }

        dbData.customers = dbData.customers.filter(c => (c.customerId || c.id) != id);
        saveDatabase();
        res.json({ success: true, message: 'Xóa khách hàng thành công!' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống hoặc khách hàng đang có vé!' });
    }
});

app.put('/api/admin/customers/:id', async (req, res) => {
    const { id } = req.params;
    const { fullName, email, phone } = req.body;
    try {
        if (useMSSQL) {
            await mssqlPool.request()
                .input('id', sql.Int, id)
                .input('name', sql.NVarChar, fullName)
                .input('email', sql.VarChar, email || null)
                .input('phone', sql.VarChar, phone)
                .query(`UPDATE Customer SET FullName = @name, Email = @email, PhoneNumber = @phone WHERE CustomerID = @id`);
            return res.json({ success: true, message: 'Cập nhật thành công!' });
        }

        const c = dbData.customers.find(x => (x.customerId || x.id) == id);
        if (c) {
            if (fullName) c.fullName = fullName;
            if (email !== undefined) c.email = email;
            if (phone) c.phone = phone;
            saveDatabase();
            return res.json({ success: true, message: 'Cập nhật thành công!' });
        }
        res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng!' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Admin: Cập nhật Trạng Thái Vé
app.put('/api/admin/bookings/:code', async (req, res) => {
    const { code } = req.params;
    const { paymentStatus } = req.body;
    try {
        if (useMSSQL) {
            await mssqlPool.request()
                .input('code', sql.VarChar, code)
                .input('status', sql.NVarChar, paymentStatus)
                .query(`UPDATE Booking SET PaymentStatus = @status WHERE BookingCode = @code`);
            return res.json({ success: true, message: 'Cập nhật thành công!' });
        }
        const b = dbData.bookings.find(x => x.bookingCode === code);
        if (b) {
            b.paymentStatus = paymentStatus;
            saveDatabase();
            return res.json({ success: true, message: 'Cập nhật thành công!' });
        }
        res.status(404).json({ success: false, message: 'Không tìm thấy vé!' });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Admin: Export Báo Cáo
app.get('/api/admin/export', async (req, res) => {
    try {
        let bookings = [];
        if (useMSSQL) {
            const result = await mssqlPool.request().query(`
                SELECT bk.BookingCode, bk.CustomerName, bk.CustomerPhone, bk.TotalAmount, bk.PaymentStatus, bk.CreatedAt,
                       t.DeparturePoint, t.DestinationPoint
                FROM Booking bk JOIN Trip t ON bk.TripID = t.TripID
                ORDER BY bk.CreatedAt DESC
            `);
            bookings = result.recordset;
        } else {
            bookings = dbData.bookings;
        }

        let csv = 'Mã Vé,Tên Khách Hàng,SĐT,Tuyến Đường,Tổng Tiền,Trạng Thái,Ngày Tạo\n';
        bookings.forEach(b => {
            const route = b.DeparturePoint ? `${b.DeparturePoint}-${b.DestinationPoint}` : 'N/A';
            const amount = b.TotalAmount || b.totalAmount || 0;
            const status = b.PaymentStatus || b.paymentStatus || '';
            const created = b.CreatedAt || b.createdAt || '';
            const name = (b.CustomerName || b.customerName || '').replace(/,/g, '');
            const phone = b.CustomerPhone || b.customerPhone || '';
            csv += `${b.BookingCode || b.bookingCode},${name},${phone},${route},${amount},${status},${created}\n`;
        });

        res.header('Content-Type', 'text/csv; charset=utf-8');
        res.attachment('baocao_doanhthu.csv');
        // Prepend BOM for Excel UTF-8 display
        res.send('\\uFEFF' + csv);
    } catch (e) {
        res.status(500).send('Lỗi xuất báo cáo');
    }
});

// Admin: Reset dữ liệu embedded (tạo lại từ đầu)
app.post('/api/admin/reset-data', (req, res) => {
    if (useMSSQL) return res.status(400).json({ success: false, message: 'Đang dùng SQL Server, hãy chạy lại file BusTicketDB.sql trong SSMS!' });
    try {
        if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
        dbData.trips = generateInitialTrips();
        dbData.bookings = generateSeedBookings();
        saveDatabase();
        res.json({ success: true, message: `Đã reset dữ liệu! ${dbData.trips.length} chuyến xe, ${dbData.bookings.length} vé mẫu.` });
    } catch (err) {
        console.error('Lỗi POST /api/admin/reset-data:', err);
        res.status(500).json({ success: false, message: 'Lỗi hệ thống!' });
    }
});

// =======================================================================
// KHỞI ĐỘNG SERVER
// =======================================================================
loadDatabase();
initMSSQL().then(() => {
    app.listen(PORT, () => {
        console.log(`=======================================================`);
        console.log(`🚀 HỆ THỐNG ĐẶT VÉ XE KHÁCH YOLO BUS LINES`);
        console.log(`📡 Server đang chạy tại: http://localhost:${PORT}`);
        console.log(`🏢 Trụ sở chính: 1 Võ Văn Ngân, TP. Thủ Đức, TP.HCM`);
        console.log(`📞 Hotline CSKH: 0963076842 | ✉️ Email: hien05082006@gmail.com`);
        console.log(`💾 Database: ${useMSSQL ? 'SQL Server (BusTicketDB)' : 'Embedded Data Engine'}`);
        console.log(`📊 Admin Dashboard API: http://localhost:${PORT}/`);
        console.log(`=======================================================`);
    });
});