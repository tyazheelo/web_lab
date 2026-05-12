import express from 'express'
import bodyParser from 'body-parser'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'node:url'
import {getById, addToy, updateToy, deleteToyById, filename } from './js/toy-store.js';
import {getAll} from './js/store.js';
import {addUser, isPasswordCorrect} from './js/user-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');

const uploadDir = path.join(__dirname, 'public', 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const uniqueSuffix = Math.random().toString(36).substring(2, 10);
    cb(null, `${timestamp}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, true);
  }
});

app.get('/', (req, res) =>{
    try{
        res.render('index.ejs', {title: "Магазин игрушек"});
    }
    catch{
        res.sendStatus(404);
    }
});

app.get('/chat', (req, res) => {
    try{
        res.render('chat.ejs', {title: "Магазин игрушек"});
    }
    catch{
        res.sendStatus(404);
    }
});

app.get('/api/items', async (req, res) => {
    try{
        const items = await getAll(filename);
        res.json(items);
    }
    catch{
        res.sendStatus(404);
    }
    
});

app.get('/api/items/:id', async (req, res) => {
    try
    {
        const item = await getById(req.params.id);
        res.json(item);
    }
    catch
    {
        res.sendStatus(404);
    }
});

app.post('/api/items', async (req, res) => {
    try{
        await addToy(req.body);
        res.sendStatus(201);
    }
    catch
    {
        res.sendStatus(400);
    }
});

app.put('/api/items/:id', async(req, res) => {
    try{
        const id = req.params.id;
        const updatedFields = req.body;
        await updateToy(id, updatedFields);
        res.sendStatus(200);
    }
    catch
    {
        res.sendStatus(400);
    }
});

app.delete('/api/items/:id', async(req,res) => {
    try
    {
        await deleteToyById(req.params.id);
        res.sendStatus(204);
    }
    catch
    {
        res.sendStatus(404);
    }
});

app.post('/api/users/register', async (req, res) => {
   try{
        await addUser(req.body);
        res.sendStatus(201);
   }
   catch(error)
   {
       res.status(400).json({success: false, message: error.message});
   }
});

app.post('/api/users/login', async(req, res) => {
    try{
        await isPasswordCorrect(req.body);
        res.status(200).json({success: true, message: 'Login successful'});
    }
    catch (error) {
        res.status(401).json({success: false, message: error.message});
    }
});

app.post('/upload', upload.array('files'), (req, res) => {
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Нет файлов для загрузки' });
    }

    const files = req.files.map(file => ({
        originalName: file.originalname,
        filename: file.filename,
        url: `/uploads/${file.filename}`,
        size: file.size,
        mimetype: file.mimetype
    }));

    res.json({ files });
});

export { app };