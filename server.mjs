// Backend Server

// Import Dependencies

import express from 'express';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Sequelize, DataTypes } from 'sequelize';
import cors from 'cors';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Declaring Variables

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;
const secretKey = 'test_key';

// Database Setup

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: 'database.sqlite'
});

// Database Models

const Inventory = sequelize.define('Inventory', {
  id: { type: DataTypes.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  price: { type: DataTypes.STRING, allowNull: false },
  warehouse: { type: DataTypes.STRING, allowNull: false },
  stock: { type: DataTypes.STRING, allowNull: false }
});

const User = sequelize.define('User', {
  id: { type: DataTypes.STRING, primaryKey: true, defaultValue: Sequelize.UUIDV4 },
  username: { type: DataTypes.STRING, allowNull: false, unique: true },
  password: { type: DataTypes.STRING, allowNull: false },
  role: { 
    type: DataTypes.STRING, 
    allowNull: false, 
    defaultValue: 'employee',
    validate: { isIn: [['admin', 'employee']] }
  }
});

const Invoice = sequelize.define('Invoice', {
  id: { type: DataTypes.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
  customerName: { type: DataTypes.STRING, allowNull: false },
  total: { type: DataTypes.FLOAT, allowNull: false },
  items: { type: DataTypes.JSON, allowNull: false },
  pdfPath: { type: DataTypes.STRING, allowNull: false }
});

// Database Hooks

User.beforeCreate(async (user) => {
  console.log('BeforeCreate: User:', user.username, 'Password (pre-hash):', user.password);
  user.password = await bcrypt.hash(user.password, 10);
  console.log('BeforeCreate: Hashed password:', user.password);
});

User.beforeUpdate(async (user) => {
  console.log('BeforeUpdate: User:', user.username, 'Password changed:', user.changed('password'), 'Current password:', user.password);
  if (user.changed('password') && user.password) {
    console.log('BeforeUpdate: Hashing password:', user.password);
    user.password = await bcrypt.hash(user.password, 10);
    console.log('BeforeUpdate: Hashed password:', user.password);
  } else {
    console.log('BeforeUpdate: No password change detected or password is null');
  }
});

// Synchronise before continuing

sequelize.sync({ alter: true }).then(() => console.log('Database synced'));

// Middleware Setup

app.use(bodyParser.json());
app.use(cors({
  origin: 'http://localhost:3001',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logs all incoming requests (Used for testing)

app.use((req, res, next) => {
  console.log(`Incoming request: ${req.method} ${req.url}`);
  next();
});

// Authentication

function authenticateToken(req, res, next) {
  console.log('Authenticating:', req.method, req.url);
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user; 
    next();
  });
}

// More Testing

app.get('/test', (req, res) => {
  console.log('GET /test hit');
  res.json({ message: 'Server is alive!' });
});

// API Routes (Authentication)

app.post('/api/register', async (req, res) => {
  console.log('POST /api/register hit');
  try {
    const { username, password } = req.body;
    const user = await User.create({ username, password });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  console.log('POST /api/login hit');
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, secretKey, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/employees', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const employees = await User.findAll();
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/employees', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const { username, password, role } = req.body;
    const user = await User.create({ username, password, role });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


app.put('/api/employees/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    console.log('PUT /api/employees/:id - Access denied, user role:', req.user.role);
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    console.log('PUT /api/employees/:id - Request body:', req.body);
    const user = await User.findOne({ where: { id: req.params.id } });
    if (!user) {
      console.log('PUT /api/employees/:id - Employee not found for ID:', req.params.id);
      return res.status(404).json({ message: 'Employee not found' });
    }

    console.log('PUT /api/employees/:id - Current user data:', user.toJSON());
    const { username, password, role } = req.body;

    if (username) {
      console.log('Updating username to:', username);
      user.username = username;
    }
    if (role) {
      console.log('Updating role to:', role);
      user.role = role;
    }
    if (password) {
      console.log('Password provided:', password);
      user.password = password; 
    }

    console.log('User data before save:', user.toJSON());
    await user.save(); 
    console.log('User data after save (post-hook):', user.toJSON());

    // Used for manually hashing password if previous method fails (which happened a lot in testing)
    if (password && user.password === password) {
      console.log('Fallback: Password still plain text, forcing hash');
      user.password = await bcrypt.hash(password, 10);
      await user.save();
      console.log('Fallback: User data after manual hash:', user.toJSON());
    }

    res.json(user);
  } catch (error) {
    console.error('Error in PUT /api/employees/:id:', error);
    res.status(500).json({ message: error.message });
  }
});


app.delete('/api/employees/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  try {
    const user = await User.findOne({ where: { id: req.params.id } });
    if (!user) {
      return res.status(404).json({ message: 'Employee not found' });
    }
    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Cannot delete an admin account!' });
    }
    const deleted = await User.destroy({ where: { id: req.params.id } });
    if (deleted) {
      res.sendStatus(204);
    } else {
      res.status(404).json({ message: 'Employee not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// API routes (Inventory)

app.get('/api/inventory', authenticateToken, async (req, res) => {
  console.log('GET /api/inventory hit');
  try {
    const items = await Inventory.findAll();
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.get('/api/inventory/:id', authenticateToken, async (req, res) => {
  console.log('GET /api/inventory/${req.params.id} hit');
  try {
    const item = await Inventory.findOne({ where: { id: req.params.id } });
    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error fetching inventory item:', error);
    res.status(500).json({ message: error.message });
  }
});

app.post('/api/inventory', async (req, res) => {
  console.log('POST /api/inventory hit');
  try {
    const { name, price, warehouse, stock } = req.body;
    const newItem = await Inventory.create({ name, price, warehouse, stock });
    res.json(newItem);
  } catch (error) {
    res.status(500).json({ message: 'Error creating inventory item', error });
  }
});

app.put('/api/inventory/:id', authenticateToken, async (req, res) => {
  console.log('PUT /api/inventory/:id hit');
  try {
    const [updated] = await Inventory.update(req.body, { where: { id: req.params.id } });
    if (updated) {
      const updatedItem = await Inventory.findOne({ where: { id: req.params.id } });
      res.json(updatedItem);
    } else {
      res.status(404).json({ message: 'Item not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.delete('/api/inventory/:id', authenticateToken, async (req, res) => {
  console.log('DELETE /api/inventory/:id hit');
  try {
    const deleted = await Inventory.destroy({ where: { id: req.params.id } });
    if (deleted) {
      res.sendStatus(204);
    } else {
      res.status(404).json({ message: 'Item not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// API routes (Finances)

app.post('/api/invoices', authenticateToken, async (req, res) => {
  console.log('POST /api/invoices hit with:', req.body);
  const { customerName, items, currency} = req.body;
  if (!customerName || !items || items.length === 0 || !currency) {
    return res.status(400).json({ message: 'Customer name, items and currency are required' });
  }

  const validatedItems = items.map(item => {
    const price = parseFloat(item.price) || 0;
    const quantity = parseInt(item.quantity) || 1;
    console.log(`Validated item: ${item.name}, Price: ${price}, Quantity: ${quantity}`);
    return { ...item, price, quantity };
  });
  const total = validatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  console.log('PDF Total:', total);

  const pdfDir = path.join(__dirname, 'public', 'invoices');
  if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });

  const pdfFileName = `invoice-${Date.now()}.pdf`;
  const pdfPath = path.join(pdfDir, pdfFileName);
  const relativePdfPath = `invoices/${pdfFileName}`;

  const doc = new PDFDocument({size: 'A4', margin: 50});
  doc.pipe(fs.createWriteStream(pdfPath));

  doc.fontSize(25).font('Helvetica-Bold').text('Invoice', { align: 'center' });
  doc.fontSize(15).font('Helvetica').text('ShipShape Systems Invoice System', { align: 'center' });
  doc.moveDown(2);

  doc.fontSize(14).font('Helvetica-Bold').text('ShipShape Systems', { align: 'center' });
  doc.fontSize(12).font('Helvetica').text('1 ShipShape Way, Plymouth UK, PL1 1AA', { align: 'center' });
  doc.text('VAT Number: GB123456789', { align: 'center' });
  doc.text('Company Number: 07398 746806', { align: 'center' });
  doc.moveDown(1);

  doc.fontSize(12).text(`Customer: ${customerName}`, 50, doc.y, { align: 'left' });
  doc.text(`Invoice Number: ${Date.now()}`, 50, doc.y + 15, { align: 'left' });
  doc.text(`Invoice Date: ${new Date().toLocaleDateString()}`, 50, doc.y + 15, { align: 'left' });
  doc.moveDown(2);

  const tableTop = doc.y;
  doc.fontSize(12).font('Helvetica-Bold');
  doc.text('Item', 50, tableTop, { width: 200, align: 'left' });
  doc.text('Price', 250, tableTop, { width: 100, align: 'right' });
  doc.text('Quantity', 350, tableTop, { width: 100, align: 'right' });
  doc.text('Total', 450, tableTop, { width: 100, align: 'right' });

  doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();

  let yPosition = tableTop + 25;
  validatedItems.forEach((item, index) => {
    const lineTotal = item.price * item.quantity;
    doc.fontSize(10).font('Helvetica');
    doc.text(`${index + 1}. ${item.name}`, 50, yPosition, { width: 200, align: 'left' });
    doc.text(`${currency}${item.price.toFixed(2)}`, 250, yPosition, { width: 100, align: 'right' });
    doc.text(`${item.quantity}`, 350, yPosition, { width: 100, align: 'right' });
    doc.text(`${currency}${lineTotal.toFixed(2)}`, 450, yPosition, { width: 100, align: 'right' });
    yPosition += 20;
  });

  doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();

  doc.fontSize(12).font('Helvetica-Bold').text('Total:', 350, yPosition + 20, { align: 'left' });
  doc.fontSize(12).font('Helvetica').text(`${currency}${total.toFixed(2)}`, 450, yPosition + 20, { align: 'right' });
  doc.moveDown(2);

  doc.fontSize(12).font('Helvetica').text('Thank you for your custom!', { align: 'center' });
 
  doc.end();

  try {
    const invoice = await Invoice.create({
      customerName,
      total,
      items: validatedItems,
      pdfPath: relativePdfPath
    });
    res.json({ invoice, pdfPath: pdfPath });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ message: 'Error generating invoice', error: error.message });
  }
});

app.get('/api/invoices', authenticateToken, async (req, res) => {
  console.log('GET /api/invoices hit');
  try {
    const invoices = await Invoice.findAll({
      attributes: ['id', 'customerName', 'total', 'pdfPath', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    res.json(invoices.map(invoice => ({
      id: invoice.id,
      customerName: invoice.customerName,
      total: invoice.total !== null ? parseFloat(invoice.total) : 0,
      pdfPath: path.join(__dirname, 'public', invoice.pdfPath),
      createdAt: invoice.createdAt
    })));
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ message: 'Error fetching invoices', error: error.message });
  }
});

app.use(express.static('public'));
app.use('/invoices', express.static(path.join(__dirname, 'public', 'invoices')));

// More testing 

app.use((req, res) => {
  console.log('Unhandled request:', req.method, req.url);
  res.status(404).json({ message: 'Route not found' });
});

// Starts server

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});