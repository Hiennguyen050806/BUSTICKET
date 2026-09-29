const fs = require('fs');

let content = fs.readFileSync('admin.js', 'utf8');

content = content.replace(
    '<button class="action-btn" title="Chỉnh sửa"><i class="fa-solid fa-pen-to-square"></i></button>',
    '<button class="action-btn" title="Chỉnh sửa" onclick="openTripModal(\'${t.TripID || t.tripId}\')"><i class="fa-solid fa-pen-to-square"></i></button>'
);

content = content.replace(
    '<td>${c.totalBookings} vé</td>\r\n                        <td style="color: var(--yolo-green); font-weight: 600;">${formatMoney(c.totalSpent)}</td>\r\n                    </tr>',
    '<td>${c.totalBookings} vé</td>\r\n                        <td style="color: var(--yolo-green); font-weight: 600;">${formatMoney(c.totalSpent)}</td>\r\n                        <td>\r\n                            <button class="action-btn" title="Chỉnh sửa" onclick="openCustomerModal(\'${c.CustomerID || c.customerId}\', \'${c.FullName || c.fullName}\', \'${c.PhoneNumber || c.phone}\', \'${c.Email || c.email}\')"><i class="fa-solid fa-pen-to-square"></i></button>\r\n                            <button class="action-btn delete" title="Xóa" onclick="deleteCustomer(\'${c.CustomerID || c.customerId}\')"><i class="fa-solid fa-trash"></i></button>\r\n                        </td>\r\n                    </tr>'
);

// Fallback for \n if \r\n is not used
content = content.replace(
    '<td>${c.totalBookings} vé</td>\n                        <td style="color: var(--yolo-green); font-weight: 600;">${formatMoney(c.totalSpent)}</td>\n                    </tr>',
    '<td>${c.totalBookings} vé</td>\n                        <td style="color: var(--yolo-green); font-weight: 600;">${formatMoney(c.totalSpent)}</td>\n                        <td>\n                            <button class="action-btn" title="Chỉnh sửa" onclick="openCustomerModal(\'${c.CustomerID || c.customerId}\', \'${c.FullName || c.fullName}\', \'${c.PhoneNumber || c.phone}\', \'${c.Email || c.email}\')"><i class="fa-solid fa-pen-to-square"></i></button>\n                            <button class="action-btn delete" title="Xóa" onclick="deleteCustomer(\'${c.CustomerID || c.customerId}\')"><i class="fa-solid fa-trash"></i></button>\n                        </td>\n                    </tr>'
);


if (!content.includes('async function deleteCustomer')) {
    content = content.replace(
        '} catch (err) {\r\n        console.error(err);\r\n    }\r\n    hideLoading();\r\n}',
        `} catch (err) {\r\n        console.error(err);\r\n    }\r\n    hideLoading();\r\n}\r\n\r\nasync function deleteCustomer(id) {\r\n    if (!confirm(\`Bạn có chắc chắn muốn xóa khách hàng #\${id} không?\`)) return;\r\n    try {\r\n        const res = await fetch(\`\${API_BASE}/customers/\${id}\`, { method: 'DELETE' });\r\n        const json = await res.json();\r\n        if (json.success) {\r\n            loadCustomers();\r\n        } else {\r\n            alert(json.message);\r\n        }\r\n    } catch (err) {\r\n        alert('Lỗi khi xóa!');\r\n    }\r\n}`
    );
    // fallback for \n
    content = content.replace(
        '} catch (err) {\n        console.error(err);\n    }\n    hideLoading();\n}',
        `} catch (err) {\n        console.error(err);\n    }\n    hideLoading();\n}\n\nasync function deleteCustomer(id) {\n    if (!confirm(\`Bạn có chắc chắn muốn xóa khách hàng #\${id} không?\`)) return;\n    try {\n        const res = await fetch(\`\${API_BASE}/customers/\${id}\`, { method: 'DELETE' });\n        const json = await res.json();\n        if (json.success) {\n            loadCustomers();\n        } else {\n            alert(json.message);\n        }\n    } catch (err) {\n        alert('Lỗi khi xóa!');\n    }\n}`
    );
}

fs.writeFileSync('admin.js', content, 'utf8');
console.log('Patched admin.js successfully');
