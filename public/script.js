// Main Script File


// Variables, constants and event listener declarations
// Authentication
const authenticationForms = document.getElementById('auth-forms');
const logoutButton = document.getElementById('logout-button');
const loginForm = document.getElementById('loginForm');
const registrationForm = document.getElementById('registerForm');

loginForm.addEventListener('submit', handleLogin);
registrationForm.addEventListener('submit', handleRegistration);
logoutButton.addEventListener('click', handleLogout);

// Inventory Management

const addItemButton = document.getElementById('add-item');
const inventoryForm = document.getElementById('inventory-form');
const saveItemButton = document.getElementById('save-item');
const inventoryTable = document.getElementById('inventory-table').querySelector('tbody');
const formTitle = document.getElementById('form-title');

addItemButton.addEventListener('click', () => openForm('Add New Item'));

// Employee Management
const addEmployeeButton = document.getElementById('add-employee');
const employeeForm = document.getElementById('employee-form');
const saveEmployeeButton = document.getElementById('save-employee');
const employeeTable = document.getElementById('employees-table').querySelector('tbody');
const employeeFormTitle = document.getElementById('employee-form-title');

let editingEmployeeRow = null;

addEmployeeButton.addEventListener('click', () => openEmployeeForm('Add New Employee'));

// User Access Control

let currentUserRole = null;
let editingRow = null;

// Misc + Finances
const overlay = document.getElementById('overlay');
const generateInvoiceButton = document.getElementById('generate-invoice');
const invoiceHistoryTable = document.getElementById('invoice-history-table').querySelector('tbody');

let invoiceItems = [];

const exchangeRates = {
  '£': 1,
  '$': 1.29,
  '€': 1.19,
}


// Other Event Listeners

overlay.addEventListener('click', (e) => {
  if (e.target === overlay) {
    closeForm();
    closeEmployeeForm();
  }
});

window.addEventListener('beforeunload', () => {
  handleLogout();
});

document.querySelectorAll('.edit').forEach(button => {
  button.addEventListener('click', e => {
    const row = e.target.closest('tr');
    openForm('Edit Item', row);
  });
});

document.querySelectorAll('.delete').forEach(button => {
  button.addEventListener('click', e => {
    const row = e.target.closest('tr');
    row.remove();
    deleteItem(row.dataset.id);
  });
});

// Functions

function loadSettings() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.body.className = savedTheme;
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) themeSelect.value = savedTheme;

  const savedFontSize = localStorage.getItem('fontSize');
  if (savedFontSize) document.body.style.fontSize = `${savedFontSize}px`;

  const savedCurrency = localStorage.getItem('currency') || '£';
  const currencySelect = document.getElementById('currency');
  if (currencySelect) {
    currencySelect.value = savedCurrency;
    updateCurrencyDisplay();
  }
}

function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
  const targetSection = document.getElementById(sectionId);
  if (targetSection) {
    targetSection.classList.add('active');
  } else {
    console.error('Section not found:', sectionId);
  }

  if (sectionId === 'employees' && currentUserRole === 'admin') {
    fetchEmployees();
  } else if (sectionId === 'inventory') {
    fetchInventory();
  } else if (sectionId === 'finances') {
    fetchInvoiceHistory();
  }
}

function loadImage(imageName) {
  const imagePath = window.electronAPI.getImagePath(imageName);
  document.getElementById('image').src = imagePath;
}

loadImage('about.jpg')

// Authentication Functions

async function handleRegistration(event) {
  event.preventDefault();
  const username = document.getElementById('registerUsername').value;
  const password = document.getElementById('registerPassword').value;

  try {
    const response = await fetch('http://localhost:3000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    console.log('Registered user:', data);

    if (response.ok) {
      alert('You have registered! Please log in with your details.');
    } else {
      alert('Registration has failed: ' + data.message);
    }
  } catch (error) {
    alert('Error during registration: ' + error.message);
  }

  document.getElementById('registerForm').reset();
}

async function handleLogin(event) {
  event.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const response = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const text = await response.text();
    console.log("Raw Response:", text);
    const data = JSON.parse(text);

    if (response.ok) {
      localStorage.setItem('token', data.token);
      authenticationForms.style.display = 'none';
      logoutButton.style.display = 'block';
      const decodedToken = jwt_decode(data.token);
      console.log("Decoded Token:", decodedToken);
      updateUIForRole(decodedToken.role); 
      await fetchInventory(); 
      if (decodedToken.role === 'admin') {
        fetchEmployees(); 
      }
    } else {
      alert('Login has failed: ' + data.message);
    }
  } catch (error) {
    alert('Error during login: ' + error.message);
  }

  document.getElementById('loginForm').reset();
}

function handleLogout() {
  localStorage.removeItem('token');
  authenticationForms.style.display = 'block';
  logoutButton.style.display = 'none';
  document.getElementById('inventory-table').querySelector('tbody').innerHTML = ''; 
  document.getElementById('employees-table').querySelector('tbody').innerHTML = ''; 
  currentUserRole = null;
  updateUIForRole(null); 
}

// Inventory Functions

async function fetchInventory() {
  const token = localStorage.getItem('token');
  console.log('Fetching inventory with token:', token);
  try {
    const response = await fetch('http://localhost:3000/api/inventory', {
      headers: { 'Authorization': token }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Inventory fetch failed:', errorText);
      alert('Failed to load inventory: ' + errorText);
      return;
    }

    const items = await response.json();
    inventoryTable.innerHTML = '';
    const currencySymbol = localStorage.getItem('currency') || '£';
    const rate = exchangeRates[currencySymbol];
    items.forEach(item => {
      const rawPrice = item.price != null ? String(item.price).replace(/[^0-9.]/g, '') : '0';
      const basePrice = parseFloat(rawPrice) || 0;
      const convertedPrice = basePrice * rate;
      const stock = parseInt(item.stock) || 0;
      const row = inventoryTable.insertRow();
      row.dataset.id = item.id;

      let rowHTML = `
        <td>${item.name}</td>
        <td>${currencySymbol}${convertedPrice.toFixed(2)}</td>
        <td>${item.warehouse}</td>
        <td>${item.stock}</td>
        <td class="actions">
          <button class="edit">Edit</button>
          <button class="delete">Delete</button>
        </td>
      `;

      if (currentUserRole === 'admin') {
        rowHTML += `
          <td>
            <input type="number" min="1" max="${stock}" value="1" style="width: 50px;" id="qty-${item.id}">
            <button class="add-to-invoice">Add to Invoice</button>
          </td>
        `;
      } else {
        rowHTML += `<td></td>`; 
      }

      row.innerHTML = rowHTML;

      row.querySelector('.edit').addEventListener('click', () => openForm('Edit Item', row));
      row.querySelector('.delete').addEventListener('click', () => {
        row.remove();
        deleteItem(row.dataset.id);
      });

      if (currentUserRole === 'admin') {
        row.querySelector('.add-to-invoice').addEventListener('click', () => {
          const quantityInput = document.getElementById(`qty-${item.id}`);
          const quantity = parseInt(quantityInput.value) || 1;
          if (quantity > stock) {
            alert(`Quantity exceeds available stock (${stock}).`);
            return;
          }
          addToInvoice({ ...item, price: basePrice }, quantity).catch(err => {
            console.error('Error in adding item to invoice:', err);
            alert('Failed to add to invoice: ' + err.message);
          });
        });
      };
    });
    updateCurrencyDisplay();
  } catch (error) {
    console.error('Error fetching inventory:', error);
    alert('Error fetching inventory: ' + error.message);
  }
}

async function loadInventory() {
  const inventoryData = localStorage.getItem('inventory');
  if (inventoryData) {
    const items = JSON.parse(inventoryData);
    inventoryTable.innerHTML = '';
    const currencySymbol = localStorage.getItem('currency') || '£';
    const rate = exchangeRates[currencySymbol];
    items.forEach(item => {
      const basePrice = parseFloat(item.price) || 0;
      const convertedPrice = basePrice * rate;
      const row = inventoryTable.insertRow();
      row.innerHTML = `
        <td>${item.name}</td>
        <td>${currencySymbol}${convertedPrice.toFixed(2)}</td>
        <td>${item.warehouse}</td>
        <td>${item.stock}</td>
        <td class="actions">
          <button class="edit">Edit</button>
          <button class="delete">Delete</button>
        </td>
      `;
      row.dataset.id = item.id;
      row.querySelector('.edit').addEventListener('click', () => openForm('Edit Item', row));
      row.querySelector('.delete').addEventListener('click', () => {
        row.remove();
        deleteItem(row.dataset.id);
      });
    });
    updateCurrencyDisplay();
  }
}

function openForm(title, row = null) {
  formTitle.textContent = title;
  inventoryForm.style.display = 'block';
  overlay.style.display = 'block';
  const currencySymbol = localStorage.getItem('currency') || '£';

  if (row) {
    document.getElementById('item-name').value = row.cells[0].textContent;
    const priceText = row.cells[1].textContent.replace(currencySymbol, '');
    document.getElementById('item-price').value = parseFloat(priceText) || '';
    document.getElementById('item-warehouse').value = row.cells[2].textContent;
    document.getElementById('item-stock').value = row.cells[3].textContent;
    editingRow = row;
  } else {
    document.getElementById('item-name').value = '';
    document.getElementById('item-price').value = '';
    document.getElementById('item-warehouse').value = '';
    document.getElementById('item-stock').value = '';
    editingRow = null;
  }
}

function closeForm() {
  inventoryForm.style.display = 'none';
  overlay.style.display = 'none';
}

async function addItem(item) {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:3000/api/inventory', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': token
    },
    body: JSON.stringify(item)
  });
  return await response.json();
}

async function updateItem(id, item) {
  const token = localStorage.getItem('token');
  await fetch(`http://localhost:3000/api/inventory/${id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': token
    },
    body: JSON.stringify(item)
  });
}

async function deleteItem(id) {
  const token = localStorage.getItem('token');
  await fetch(`http://localhost:3000/api/inventory/${id}`, {
    method: 'DELETE',
    headers: { 'Authorization': token }
  });
}

saveItemButton.addEventListener('click', async () => {
  const name = document.getElementById('item-name').value;
  const price = document.getElementById('item-price').value;
  const warehouse = document.getElementById('item-warehouse').value;
  const stock = document.getElementById('item-stock').value;
  const currencySymbol = localStorage.getItem('currency') || '£';
  const rate = exchangeRates[currencySymbol];
  const basePrice = (parseFloat(price) || 0) / rate;

  if (editingRow) {
    editingRow.cells[0].textContent = name;
    editingRow.cells[1].textContent = `${currencySymbol}${(basePrice * rate).toFixed(2)}`;
    editingRow.cells[2].textContent = warehouse;
    editingRow.cells[3].textContent = stock;
    await updateItem(editingRow.dataset.id, { name, price, warehouse, stock });
  } else {
    const newItem = await addItem({ name, price, warehouse, stock });
    const convertedPrice = (parseFloat(newItem.price) || 0) * rate;
    const row = inventoryTable.insertRow();
    row.dataset.id = newItem.id;

    let rowHTML = `
      <td>${newItem.name}</td>
      <td>${currencySymbol}${convertedPrice.toFixed(2)}</td>
      <td>${newItem.warehouse}</td>
      <td>${newItem.stock}</td>
      <td class="actions">
        <button class="edit">Edit</button>
        <button class="delete">Delete</button>
      </td>
    `;

    if (currentUserRole === 'admin') {
      rowHTML += `
        <td>
          <input type="number" min="1" value="1" style="width: 50px;" id="qty-${newItem.id}">
          <button class="add-to-invoice">Add to Invoice</button>
        </td>
      `;
    } else {
      rowHTML += `<td></td>`;
    }

    row.innerHTML = rowHTML;

    row.querySelector('.edit').addEventListener('click', () => openForm('Edit Item', row));
    row.querySelector('.delete').addEventListener('click', () => {
      row.remove();
      deleteItem(row.dataset.id);
    });

    if (currentUserRole === 'admin') {
      row.querySelector('.add-to-invoice').addEventListener('click', () => {
        const quantityInput = document.getElementById(`qty-${newItem.id}`);
        const quantity = parseInt(quantityInput.value) || 1;
        addToInvoice({ ...newItem, price: newItem.price }, quantity);
      });
    }
  }

  closeForm();
});

async function fetchInvoiceHistory() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch('http://localhost:3000/api/invoices', {
      headers: { 'Authorization': token }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Invoice fetch failed:', errorText);
      alert('Failed to load invoices: ' + errorText);
      return;
    }

    const invoices = await response.json();
    invoiceHistoryTable.innerHTML = '';
    const currencySymbol = localStorage.getItem('currency') || '£';
    invoices.forEach(invoice => {
      const row = invoiceHistoryTable.insertRow();
      const total = invoice.total !== null && !isNaN(invoice.total) ? parseFloat(invoice.total) : 0;
      row.innerHTML = `
        <td>${new Date(invoice.createdAt).toLocaleDateString()}</td>
        <td>${invoice.customerName}</td>
        <td>${currencySymbol}${total.toFixed(2)}</td>
        <td><button class="view-invoice" data-pdf="${invoice.pdfPath}">View</button></td>
      `;
      row.querySelector('.view-invoice').addEventListener('click', () => {
        if (window.electronAPI) {
          const absolutePath = invoice.pdfPath.replace(/\//g, '\\'); 
          console.log('Opening PDF:', absolutePath);
          window.electronAPI.openPDF(absolutePath);
        } else {
          const urlPath = invoice.pdfPath
            .replace(__dirname.replace(/\\/g, '/'), '')
            .replace('public', 'http://localhost:3000');
          window.open(urlPath, '_blank');
        }
      });
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    alert('Error fetching invoices: ' + error.message);
  }
}


// Employee Management Functions

async function fetchEmployees() {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch('http://localhost:3000/api/employees', {
      headers: { 'Authorization': token }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Employee fetch failed:', errorText);
      alert('Failed to load employees: ' + errorText);
      return;
    }

    const employees = await response.json();
    employeeTable.innerHTML = '';
    employees.forEach(employee => {
      const row = employeeTable.insertRow();
      row.dataset.id = employee.id;
      row.innerHTML = `
        <td>${employee.username}</td>
        <td>${employee.role}</td>
        <td class="actions">
          <button class="edit">Edit</button>
          <button class="delete">Delete</button>
        </td>
      `;
      row.querySelector('.edit').addEventListener('click', () => openEmployeeForm('Edit Employee', row));
      row.querySelector('.delete').addEventListener('click', async () => {
        if (employee.role === 'admin') {
          alert('Cannot delete an admin account!');
          return;
        }
        if (confirm('Are you sure you want to delete this employee?')) {
          try {
            await deleteEmployee(row.dataset.id);
            row.remove();
          } catch (error) {
            console.error('Error deleting employee:', error);
            alert('Error deleting employee: ' + error.message);
          }
        }
      });
    });
  } catch (error) {
    console.error('Error fetching employees:', error);
    alert('Error fetching employees: ' + error.message);
  }
}

async function addEmployee(employee) {
  const token = localStorage.getItem('token');
  const response = await fetch('http://localhost:3000/api/employees', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': token
    },
    body: JSON.stringify(employee)
  });
  return await response.json();
}

async function updateEmployee(id, employee) {
  const token = localStorage.getItem('token');
  await fetch(`http://localhost:3000/api/employees/${id}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': token
    },
    body: JSON.stringify(employee)
  });
}

async function deleteEmployee(id) {
  const token = localStorage.getItem('token');
  try {
    const response = await fetch(`http://localhost:3000/api/employees/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': token }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Employee delete failed:', errorText);
      throw new Error(errorText || 'Failed to delete employee');
    } 
  } catch (error) {
    throw error; 
  }
}

function openEmployeeForm(title, row) {
  document.getElementById('employee-form-title').textContent = title;
  document.getElementById('employee-username').value = row ? row.cells[0].textContent : '';
  document.getElementById('employee-password').value = '';
  document.getElementById('employee-role').value = row ? row.cells[1].textContent : 'employee';
  employeeForm.style.display = 'block'; 
  overlay.style.display = 'block';
  editingEmployeeRow = row;
}

function closeEmployeeForm() {
  employeeForm.style.display = 'none';
  overlay.style.display = 'none';
}

function updateUIForRole(role) {
  currentUserRole = role;
  console.log('Updating UI for role:', role);

  const showElement = (input) => {
    const element = typeof input === 'string' ? document.querySelector(input) : input;
    if (element) element.style.display = 'block';
  };
  const hideElement = (input) => {
    const element = typeof input === 'string' ? document.querySelector(input) : input;
    if (element) element.style.display = 'none';
  };

  const inventoryTable = document.getElementById('inventory-table');

  hideElement('#add-employee');
  hideElement('#add-item');
  document.querySelectorAll('.actions').forEach(button => hideElement(button));
  document.querySelectorAll('.sidebar a').forEach(link => hideElement(link));

  if (role) {
    showElement('#logout-button');
    hideElement('#auth-forms');
  } else {
    hideElement('#logout-button');
    showElement('#auth-forms');
  }

  if (role === 'admin') {
    showElement('#add-employee');
    showElement('#add-item');
    document.querySelectorAll('.actions').forEach(button => showElement(button));
    ['dashboard', 'finances', 'inventory', 'ship-hub', 'employees', 'about', 'settings', 'profile'].forEach(section => {
      showElement(`[data-section="${section}"]`);
    });
    inventoryTable.classList.remove('inventory-table-hide-invoice');
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.getElementById('dashboard').classList.add('active');
  } else if (role === 'employee') {
    showElement('#add-item');
    document.querySelectorAll('.actions').forEach(button => showElement(button));
    ['dashboard', 'inventory', 'about', 'settings', 'profile'].forEach(section => {
      showElement(`[data-section="${section}"]`);
    });
    inventoryTable.classList.add('inventory-table-hide-invoice');
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.getElementById('dashboard').classList.add('active');
  } else {
    ['dashboard', 'about'].forEach(section => {
      showElement(`[data-section="${section}"]`);
    });
    inventoryTable.classList.add('inventory-table-hide-invoice');
    document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
    document.getElementById('dashboard').classList.add('active');
  }
}

saveEmployeeButton.addEventListener('click', async () => {
  const username = document.getElementById('employee-username').value;
  const password = document.getElementById('employee-password').value;
  const role = document.getElementById('employee-role').value;

  if (!username || !role) {
    alert('Username and role are required');
    return;
  }

  const employee = { username, role };
  if (password) employee.password = password;

  if (editingEmployeeRow) {
    await updateEmployee(editingEmployeeRow.dataset.id, employee);
    editingEmployeeRow.cells[0].textContent = username;
    editingEmployeeRow.cells[1].textContent = role;
  } else {
    const newEmployee = await addEmployee(employee);
    const row = employeeTable.insertRow();
    row.dataset.id = newEmployee.id;
    row.innerHTML = `
      <td>${newEmployee.username}</td>
      <td>${newEmployee.role}</td>
      <td class="actions">
        <button class="edit">Edit</button>
        <button class="delete">Delete</button>
      </td>
    `;
    row.querySelector('.edit').addEventListener('click', () => openEmployeeForm('Edit Employee', row));
    row.querySelector('.delete').addEventListener('click', () => {
      row.remove();
      deleteEmployee(row.dataset.id);
    });
  }

  closeEmployeeForm();
  await fetchEmployees();
});

employeeForm.addEventListener('click', (event) => {
  event.stopPropagation();
});


// Finance Functions

function tableVisibility() {
  const invoiceTable = document.getElementById('invoice-items-table');
  const emptyMessage = document.getElementById('empty-message');
  const invoiceItemsBody = invoiceTable.querySelector('tbody');

  if (invoiceItemsBody.children.length === 0) {
    invoiceTable.style.display = 'none';
    emptyMessage.style.display = 'block';
  } else {
    invoiceTable.style.display = 'table';
    emptyMessage.style.display = 'none';
  } 
}

async function addToInvoice(item, quantity) {
  const price = parseFloat(item.price);
  const stock = parseInt(item.stock) || 0;
  console.log(`Adding to invoice: ${item.name}, Price: ${price}, Quantity: ${quantity}`);
  if (isNaN(price) || price < 0) {
    console.warn(`Invalid price for ${item.name}: ${item.price}`);
    return;
  }
  if (isNaN(quantity) || quantity < 1) {
    console.warn(`Invalid quantity for ${item.name}: ${quantity}`);
    quantity = 1; 
  }
  if (quantity > item.stock) {
    alert(`Quantity exceeds available stock (${item.stock}).`);
    return;
  };

  const newStock = stock - quantity;
  try {
    await updateItem(item.id, { name: item.name, price: item.price, warehouse: item.warehouse, stock: newStock });
    console.log(`Stock updated for ${item.name}: ${newStock}`);
  } catch (error) {
    console.error(`Error updating stock:`, error);
    alert(`Error updating stock for ${item.name}: ${error.message}`);
    return;
  }

  invoiceItems.push({
    id: item.id,
    name: item.name,
    price: price,
    quantity: quantity,
    lineTotal: price * quantity 
  });
  updateInvoiceTable();
  fetchInventory();
}

function updateInvoiceTable() {
  const invoiceTableBody = document.querySelector('#invoice-items-table tbody');
  invoiceTableBody.innerHTML = '';
  const currencySymbol = localStorage.getItem('currency') || '£';
  const rate = exchangeRates[currencySymbol];

  invoiceItems.forEach((item, index) => {
    const convertedPrice = item.price * rate;
    const convertedLineTotal = item.lineTotal * rate;
    const row = invoiceTableBody.insertRow();
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${currencySymbol}${convertedPrice.toFixed(2)} x ${item.quantity}</td>
      <td>${currencySymbol}${convertedLineTotal.toFixed(2)}</td>
      <td><button onclick="removeInvoiceItem(${index})">Remove</button></td>
    `;
  });

  const total = invoiceItems.reduce((sum, item) => sum + item.lineTotal, 0) * rate;
  console.log('Invoice total:', total);
  document.getElementById('invoice-total').textContent = `${currencySymbol}${total.toFixed(2)}`;

  tableVisibility();
}

async function removeInvoiceItem(index) {
  const removedItem = invoiceItems[index];
  if (!removedItem) {
    console.error('No item found at index:', index);
    return;
  }
  try {
    const itemResponse = await fetch(`http://localhost:3000/api/inventory/${removedItem.id}`, {
      headers: { 'Authorization': localStorage.getItem('token') }
    });
    if (!itemResponse.ok) {
      const errorText = await itemResponse.text();
      console.error('Failed to fetch item:', errorText);
      alert('Failed to fetch item: ' + errorText);
      return;
    }
    const currentItem = await itemResponse.json();
    const currentStock = parseInt(currentItem.stock) || 0;
    const newStock = currentStock + removedItem.quantity;

    await updateItem(removedItem.id, {
      name: removedItem.name,
      price: removedItem.price,
      warehouse: removedItem.warehouse,
      stock: newStock
    })
    console.log(`Stock updated for ${removedItem.name}: ${newStock}`);
  } catch (error) {
    console.error(`Error updating stock for ${removedItem.name}:`, error);
    alert(`Error updating stock for ${removedItem.name}: ` + error.message);
    return;
  }
  invoiceItems.splice(index, 1);
  updateInvoiceTable();
  tableVisibility();
  await fetchInventory();
}

generateInvoiceButton.addEventListener('click', async () => {
  const customerName = document.getElementById('invoice-customer').value;
  const invoiceCurrency = document.getElementById('invoice-currency').value;
  if (!customerName || invoiceItems.length === 0) {
    alert('Please enter a customer name and add items to the invoice.');
    return;
  }

  const token = localStorage.getItem('token');
  const currencySymbol = invoiceCurrency;
  const rate = exchangeRates[currencySymbol];

  const convertedItems = invoiceItems.map(item => ({
    ...item,
    price: item.price * rate,
    lineTotal: item.lineTotal * rate
  }));

  console.log('Generating invoice with token:', token);
  console.log('Invoice items being sent:', convertedItems);
  try {
    const response = await fetch('http://localhost:3000/api/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token,
      },
      body: JSON.stringify({ customerName, items: convertedItems, currency: currencySymbol }),
    });

    const responseText = await response.text();
    console.log('Response status:', response.status, 'Body:', responseText);

    if (response.ok) {
      const data = JSON.parse(responseText);
      alert('Invoice generated successfully! Check the invoices folder.');
      console.log('PDF Path:', data.pdfPath);
      if (window.electronAPI) {
        const absolutePath = data.pdfPath.replace(/\//g, '\\'); 
        console.log('Opening generated PDF:', absolutePath);
        window.electronAPI.openPDF(absolutePath);
      } else {
        console.warn('electronAPI not available');
      }
      invoiceItems = [];
      updateInvoiceTable();
      document.getElementById('invoice-customer').value = '';
      fetchInvoiceHistory();
    } else {
      alert('Failed to generate invoice: ' + responseText);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Error: ' + error.message);
  }
});

// Misc

document.getElementById('save-settings')?.addEventListener('click', () => {
  const theme = document.getElementById('theme-select').value;
  localStorage.setItem('theme', theme);
  document.body.className = theme;

  const fontSize = document.getElementById('font-size').value;
  document.body.style.fontSize = `${fontSize}px`;
  localStorage.setItem('fontSize', fontSize);

  const currency = document.getElementById('currency').value;
  localStorage.setItem('currency', currency);
  updateCurrencyDisplay();

  const status = document.getElementById('settings-status');
  status.style.display = 'block';
  setTimeout(() => status.style.display = 'none', 2000);
});

document.getElementById('currency').addEventListener('change', (e) => {
  const currency = e.target.value;
  localStorage.setItem('currency', currency);
    updateCurrencyDisplay();
});

function updateCurrencyDisplay() {
  const currencySymbol = localStorage.getItem('currency') || '£';
  const rate = exchangeRates[currencySymbol];

  document.querySelectorAll('#inventory-table td:nth-child(2)').forEach(cell => {
    const value = parseFloat(cell.textContent.replace(/[^0-9.]/g, ''));
    const baseValue = value / (exchangeRates[cell.textContent[0]] || 1);
    cell.textContent = `${currencySymbol}${(baseValue * rate).toFixed(2)}`;
  });

  document.querySelectorAll('#invoice-items-table td:nth-child(2)').forEach(cell => {
    const [pricePart, quantityPart] = cell.textContent.split(' x ');
    const value = parseFloat(pricePart.replace(/[^0-9.]/g, '')) || 0;
    const baseValue = value / (exchangeRates[cell.textContent[0]] || 1);
    cell.textContent = `${currencySymbol}${(baseValue * rate).toFixed(2)} x ${quantityPart}`;
  });

  document.querySelectorAll('#invoice-items-table td:nth-child(3)').forEach(cell => {
    const value = parseFloat(cell.textContent.replace(/[^0-9.]/g, ''));
    const baseValue = value / (exchangeRates[cell.textContent[0]] || 1);
    cell.textContent = `${currencySymbol}${(baseValue * rate).toFixed(2)}`;
  });

  const total = document.getElementById('invoice-total');
  const totalValue = parseFloat(total.textContent.replace(/[^0-9.]/g, '')) || 0;
  const baseTotal = totalValue / (exchangeRates[total.textContent[0]] || 1);
  total.textContent = `${currencySymbol}${(baseTotal * rate).toFixed(2)}`;
}


// DOMContentLoaded

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('token');
  if (token) {
    authenticationForms.style.display = 'none';
    logoutButton.style.display = 'block';
    const decodedToken = jwt_decode(token);
    updateUIForRole(decodedToken.role);
    fetchInventory();
    if (decodedToken.role === 'admin') fetchEmployees();
  } else {
    updateUIForRole(null);
  }
  loadSettings();

  document.querySelectorAll('.sidebar a').forEach(link => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const sectionId = link.getAttribute('data-section');
      console.log('Switching to section:', sectionId);
      showSection(sectionId);
    });
  });

  tableVisibility();
});