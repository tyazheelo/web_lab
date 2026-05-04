import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filename = path.join(__dirname, path.join('database', 'db.json'));


const save = async (data) => {
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
};

const readData = async () => {
    const data = await fs.readFile(filename, 'utf-8');
    return JSON.parse(data);
};

const getAll = async () => {
    const data = await readData();
    return data || [];
};

const getById = async (id) => {
    const items = await getAll();
    return items.find(item => item.id === id);
};

const addToy = async (itemData) => {
    const { name, cost, type, description } = itemData;
    const items = await getAll();
    const id = await generateNewId(type, items);
    
    const newItem = {
        name: name,
        type: type,
        cost: cost,
        description: description || '', 
        id: id
    };
    
    items.push(newItem);
    
    items.sort((a, b) => {
        const [typeA, numA] = a.id.split('-');
        const [typeB, numB] = b.id.split('-');
        
        if (a.type !== b.type) {
            return b.type.localeCompare(a.type);
        }
        return parseInt(numA, 10) - parseInt(numB, 10);
    });
    
    await save(items);
};

const updateToy = async (id, updatedFields) => {
    const items = await getAll();
    const index = items.findIndex(item => item.id === id);
    
    if (index === -1) {
        return null;
    }
    
    items[index] = { ...items[index], ...updatedFields };
    await save(items);
};

const deleteToyById = async (id) => {
    const items = await getAll();
    const index = items.findIndex(item => item.id === id);
    
    if (index === -1) {
       throw new Error(`Игрушка с id "${id}" не найдена`);
    }
    
    items.splice(index, 1);
    await save(items);
};

const generateNewId = async (type, items) => {
    const sameTypeItems = items.filter(item => item.type === type);
    
    const numbers = sameTypeItems.map(item => {
        const parts = item.id.split('-');
        const numberStr = parts[1];
        return parseInt(numberStr, 10);
    });
    
    const maxNum = numbers.length > 0 ? Math.max(...numbers) : 0;
    const newNumber = maxNum + 1;
    
    return `${getShortType(type)}-${newNumber}`;
};


const getShortType = (type) =>
{
    switch(type)
    {
        case "Эко-игрушки":
            return "eco";
        case "Развивающие игрушки":
            return "edu";
        default:
            return "none";
    }
}
export {
    getAll,
    getById,
    addToy,
    updateToy,
    deleteToyById
};