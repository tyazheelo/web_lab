import express from 'express'
import bodyParser from 'body-parser'
import { getAll, getById, addToy, updateToy, deleteToyById } from './store.js';


const app = express();

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', 'ejs');

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
        res.render('chat.ejs', {title: "Магазин игрушек", username: req.user?.username || 'Guest'});
    }
    catch{
        res.sendStatus(404);
    }
});

app.get('/api/items', async (req, res) => {
    try{
        const items = await getAll();
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

//curl -X POST http://localhost:3000/api/items -H "Content-Type: application/json" -d "{\"name\":\"Моя игрушка\",\"cost\":250,\"type\":\"Эко-игрушки\"}"

app.post('/api/items', async (req, res) => {
    try{
        const { name, cost, type, description } = req.body;
        await addToy(req.body);
        res.sendStatus(201);
    }
    catch
    {
        res.sendStatus(400);
    }
});
//curl -X PUT http://localhost:3000/api/items/eco-3 -H "Content-Type: application/json" -d "{\"name\": \"Тедди\"}"
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

//curl -X DELETE http://localhost:3000/api/items/eco-3

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

export { app };